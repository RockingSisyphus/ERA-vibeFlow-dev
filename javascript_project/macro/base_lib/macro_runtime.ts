import { createEraMacroRegex, containsEraMacro, containsEraLazyMacroToken, createLazyTokenRegex, decodeLazyMacro } from "./macro_syntax.ts";
import { stripEraTechnicalBlocks } from "./technical_blocks.ts";
import {
  isPresentMacroStoredStat,
  type JsonValue,
} from "@era/vibeflow-contracts";
import { lodashCompatibleGet } from "./lodash_get_compatible.ts";

export type MacroStoredStat =
  | { readonly kind: "present"; readonly value: unknown }
  | { readonly kind: "missing" }
  | { readonly kind: "projection-only" }
  | { readonly kind: "view"; readonly mode: "raw" | "lazy" | "prompt"; readonly statWithMeta: unknown; readonly statWithoutMeta: unknown };

export type MacroSnapshot = (
  | {
      readonly kind: "present";
      readonly statWithMeta: unknown;
      readonly statWithoutMeta: unknown;
    }
  | { readonly kind: "missing" }) & { readonly mode?: "raw" | "lazy" };

export interface MacroOccurrence {
  readonly decoded?: string | null;
  readonly substring: string;
  readonly path: string;
  readonly withMeta: boolean;
  readonly start: number;
  readonly end: number;
}

export type MacroOccurrencePlan = {
  readonly original: string;
  readonly snapshot: MacroSnapshot;
  readonly occurrences: readonly MacroOccurrence[];
};

export type MacroResolution =
  | {
      readonly kind: "preserve";
      readonly start: number;
      readonly end: number;
      readonly substring: string;
    }
  | {
      readonly kind: "missing";
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly kind: "value";
      readonly start: number;
      readonly end: number;
      readonly value: unknown;
    };

export type ResolvedMacroOccurrences = {
  readonly original: string;
  readonly resolutions: readonly MacroResolution[];
};

function unescapeText(value: string): string {
  return value.replace(
    /__DOT__|__DQUOTE__|__SQUOTE__/g,
    placeholder => {
      switch (placeholder) {
        case "__DOT__":
          return ".";
        case "__DQUOTE__":
          return '"';
        case "__SQUOTE__":
          return "'";
        default:
          return placeholder;
      }
    },
  );
}

function unescapeEraData(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(unescapeEraData);
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      result[unescapeText(key)] = unescapeEraData(child);
    }
    return result;
  }

  return typeof value === "string" ? unescapeText(value) : value;
}

function removeMetaFields(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(removeMetaFields);
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      if (!key.startsWith("$")) {
        result[key] = removeMetaFields(child);
      }
    }
    return result;
  }

  return value;
}

/** 在原检测节点准备实际文本，提示只展开延迟标记。 */
export function prepareMacroText(text: string, state: MacroStoredStat): { text: string; contains: boolean } {
  const prompt = state.kind === "projection-only" || (state.kind === "view" && state.mode === "prompt");
  const prepared = prompt ? stripEraTechnicalBlocks(text) : text;
  const contains = state.kind === "projection-only" ? false
    : state.kind === "view" && state.mode !== "raw" ? containsEraLazyMacroToken(prepared) : containsEraMacro(prepared);
  return { text: prepared, contains };
}

export function buildMacroSnapshot(storedStat: MacroStoredStat): MacroSnapshot {
  if (storedStat.kind === "view") {
    return { kind: "present", statWithMeta: storedStat.statWithMeta, statWithoutMeta: storedStat.statWithoutMeta, mode: storedStat.mode === "raw" ? "raw" : "lazy" };
  }
  if (storedStat.kind === "missing" || storedStat.kind === "projection-only") {
    return { kind: "missing" };
  }
  if (!isPresentMacroStoredStat(storedStat)) {
    throw new TypeError("宏状态必须是可移植 JSON 值");
  }

  const statWithMeta = unescapeEraData(storedStat.value);
  return {
    kind: "present",
    statWithMeta,
    statWithoutMeta: removeMetaFields(statWithMeta),
  };
}

export function scanMacroOccurrences(
  original: string,
  snapshot: MacroSnapshot,
): MacroOccurrencePlan {
  const occurrences: MacroOccurrence[] = [];
  const lazy = snapshot.mode === "lazy";
  const expression = lazy ? createLazyTokenRegex() : createEraMacroRegex();

  for (let match = expression.exec(original); match !== null; match = expression.exec(original)) {
    const substring = match[0];
    occurrences.push({
      ...(lazy ? { decoded: decodeLazyMacro(match[1]) } : {}),
      substring,
      path: (match[2] ?? "").trim(),
      withMeta: match[1] !== undefined,
      start: match.index,
      end: match.index + substring.length,
    });
  }

  return { original, snapshot, occurrences };
}

export function resolveMacroOccurrences(
  plan: MacroOccurrencePlan,
): ResolvedMacroOccurrences {
  const resolutions = plan.occurrences.map<MacroResolution>(occurrence => {
    if (occurrence.decoded !== undefined) {
      if (occurrence.decoded === null) return { kind: "preserve", start: occurrence.start, end: occurrence.end, substring: occurrence.substring };
      const rawSnapshot: MacroSnapshot = { ...plan.snapshot, mode: "raw" };
      const decoded = formatResolvedMacros(resolveMacroOccurrences(scanMacroOccurrences(occurrence.decoded, rawSnapshot)));
      return { kind: "value", start: occurrence.start, end: occurrence.end, value: decoded };
    }

    if (plan.snapshot.kind === "missing") {
      return {
        kind: "preserve",
        start: occurrence.start,
        end: occurrence.end,
        substring: occurrence.substring,
      };
    }

    const source = occurrence.withMeta
      ? plan.snapshot.statWithMeta
      : plan.snapshot.statWithoutMeta;
    if (source === null || source === undefined) {
      return {
        kind: "preserve",
        start: occurrence.start,
        end: occurrence.end,
        substring: occurrence.substring,
      };
    }
    const value =
      occurrence.path === "$ALLDATA"
        ? source
        : lodashCompatibleGet(source, occurrence.path);

    if (value === undefined) {
      return {
        kind: "missing",
        start: occurrence.start,
        end: occurrence.end,
      };
    }

    return {
      kind: "value",
      start: occurrence.start,
      end: occurrence.end,
      value: value as JsonValue,
    };
  });

  return { original: plan.original, resolutions };
}

function formatMacroValue(value: unknown): string {
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value) ?? "";
  }
  return String(value);
}

export function formatResolvedMacros(
  resolved: ResolvedMacroOccurrences,
): string {
  let cursor = 0;
  let replacement = "";

  for (const resolution of resolved.resolutions) {
    replacement += resolved.original.slice(cursor, resolution.start);
    if (resolution.kind === "preserve") {
      replacement += resolution.substring;
    } else if (resolution.kind === "value") {
      replacement += formatMacroValue(resolution.value);
    }
    cursor = resolution.end;
  }

  return replacement + resolved.original.slice(cursor);
}
