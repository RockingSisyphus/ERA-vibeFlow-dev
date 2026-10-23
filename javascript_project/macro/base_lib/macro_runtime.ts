import { createEraMacroRegex, containsEraMacro, containsEraLazyMacroToken, createLazyTokenRegex, decodeLazyMacro } from "./syntax/macro_syntax.ts";
import { stripEraTechnicalBlocks } from "./syntax/technical_blocks.ts";
import {
  isPresentMacroStoredStat,
  type JsonValue,
} from "@era/vibeflow-contracts";
import { lodashCompatibleGet } from "./lodash_get_compatible.ts";

import type { MacroStoredStat, MacroSnapshot, MacroOccurrence, MacroOccurrencePlan, MacroResolution, ResolvedMacroOccurrences } from "@era/vibeflow-contracts";
import {unescapeEraData, removeMetaFields} from "../../../base_lib/data_view/data_view.ts";

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
