import type { DependencyGraph, FindingSeed, IdentifierUse, ImportFact, ParsedFile, QualityPolicy } from './types.ts';
import { matchesPathPattern } from './graph.ts';

export type SideEffectCapability = 'TAVERN_HELPER' | 'DOM_UI' | 'STORAGE' | 'NETWORK' | 'CLOCK_RANDOM' | 'SYSTEM_CLOCK';

export interface EffectEvidence {
  capability: SideEffectCapability;
  path: string;
  line: number;
  column: number;
  objectId: string;
  identifier: string;
}

export interface EffectPath {
  capability: SideEffectCapability;
  modules: string[];
  evidence: EffectEvidence;
}

export interface EffectAnalysis {
  direct: Record<string, EffectEvidence[]>;
  effective: Record<string, SideEffectCapability[]>;
  shortestPaths: Record<string, EffectPath[]>;
}

interface ReachableEffectGroup {
  capability: SideEffectCapability;
  sourcePath: string;
  sourceObjectId: string;
  modules: string[];
  evidence: EffectEvidence[];
}

const CAPABILITY_ORDER: SideEffectCapability[] = [
  'TAVERN_HELPER',
  'DOM_UI',
  'STORAGE',
  'NETWORK',
  'CLOCK_RANDOM',
  'SYSTEM_CLOCK',
];

const STANDARD_GLOBALS = new Set([
  'AbortController',
  'Array',
  'BigInt',
  'Boolean',
  'Date',
  'Error',
  'EvalError',
  'Infinity',
  'Intl',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'Reflect',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'URIError',
  'URL',
  'URLSearchParams',
  'WeakMap',
  'WeakSet',
  'atob',
  'btoa',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'globalThis',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'require',
  'structuredClone',
  'undefined',
  'unescape',
]);

// These are injected pure libraries in the Tavern build and do not represent an
// observable boundary by themselves.
const PURE_INJECTED_GLOBALS = new Set([
  '_',
  'YAML',
  'compareVersions',
  'computed',
  'dedent',
  'klona',
  'lodash',
  'markRaw',
  'nextTick',
  'reactive',
  'readonly',
  'ref',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'toRaw',
  'unref',
  'watch',
  'watchEffect',
  'yaml',
  'z',
]);

const TAVERN_GLOBALS = new Set([
  'Mvu',
  'SillyTavern',
  'TavernHelper',
  'errorCatched',
  'eventClearAll',
  'eventEmit',
  'eventMakeFirst',
  'eventMakeLast',
  'eventOff',
  'eventOn',
  'eventOnce',
  'eventRemoveListener',
  'eventTypesIn',
  'getCharWorldbookNames',
  'getCharacterCardFields',
  'getCurrentCharacterName',
  'getCurrentMessageId',
  'getIframeName',
  'getLastMessageId',
  'getScriptId',
  'iframe_events',
  'injectPrompts',
  'registerMacroLike',
  'removeInjects',
  'substitudeMacros',
  'tavern_events',
  'triggerSlash',
  'unregisterMacroLike',
]);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, 'en');
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function stableEvidenceSort(left: EffectEvidence, right: EffectEvidence): number {
  return (
    CAPABILITY_ORDER.indexOf(left.capability) - CAPABILITY_ORDER.indexOf(right.capability) ||
    left.line - right.line ||
    left.column - right.column ||
    compareStrings(left.identifier, right.identifier) ||
    compareStrings(left.objectId, right.objectId)
  );
}

function stableFindingSort(left: FindingSeed, right: FindingSeed): number {
  return (
    compareStrings(left.path, right.path) ||
    left.line - right.line ||
    left.column - right.column ||
    compareStrings(left.ruleId, right.ruleId) ||
    compareStrings(left.objectId, right.objectId)
  );
}

function rootIdentifier(use: IdentifierUse): string {
  const candidate = use.qualifiedName || use.name;
  return candidate.replace(/^globalThis\./, '').split(/[.[(]/, 1)[0] ?? use.name;
}

function importedModuleCapability(rawSpecifier: string): SideEffectCapability | undefined {
  const specifier = rawSpecifier.replace(/[?#].*$/u, '').toLocaleLowerCase();
  if (/(?:^|\/)(?:axios|socket\.io-client|socket\.io|ws|node-fetch)(?:$|\/)/u.test(specifier)) {
    return 'NETWORK';
  }
  if (/(?:^|\/)(?:jquery|jquery-ui|toastr)(?:$|\/)/u.test(specifier)) {
    return 'DOM_UI';
  }
  return undefined;
}

function nameMatches(use: IdentifierUse, configuredName: string): boolean {
  const candidates = [use.name, use.qualifiedName, use.qualifiedName.replace(/^globalThis\./, '')].filter(Boolean);
  return candidates.some(
    candidate =>
      candidate === configuredName ||
      candidate.startsWith(`${configuredName}.`) ||
      candidate.endsWith(`.${configuredName}`),
  );
}

function matchesAnyName(use: IdentifierUse, configuredNames: string[]): boolean {
  return configuredNames.some(configuredName => nameMatches(use, configuredName));
}

interface LineRange {
  lineStart: number;
  lineEnd: number;
}

function namedInitializerRange(ast: unknown, name: string): LineRange | undefined {
  if (!ast || typeof ast !== 'object' || (ast as { type?: string }).type !== 'Program') {
    return undefined;
  }
  const body = (ast as { body?: unknown[] }).body ?? [];
  const declarations = body.flatMap(statement => {
    if (!statement || typeof statement !== 'object') {
      return [];
    }
    const typedStatement = statement as { type?: string; declaration?: unknown; declarations?: unknown[] };
    const declaration = typedStatement.type === 'ExportNamedDeclaration' ? typedStatement.declaration : typedStatement;
    if (!declaration || typeof declaration !== 'object') {
      return [];
    }
    const variable = declaration as { type?: string; declarations?: unknown[] };
    return variable.type === 'VariableDeclaration' ? (variable.declarations ?? []) : [];
  });
  const matches = declarations.filter(declaration => {
    const node = declaration as { type?: string; id?: { type?: string; name?: string } };
    return node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.id.name === name;
  });
  if (matches.length !== 1) {
    return undefined;
  }
  const initializer = (matches[0] as { init?: { loc?: { start?: { line?: number }; end?: { line?: number } } } }).init;
  const lineStart = initializer?.loc?.start?.line;
  const lineEnd = initializer?.loc?.end?.line;
  return typeof lineStart === 'number' && typeof lineEnd === 'number' ? { lineStart, lineEnd } : undefined;
}

function isTavernGlobal(use: IdentifierUse): boolean {
  const root = rootIdentifier(use);
  if (TAVERN_GLOBALS.has(root)) {
    return true;
  }
  return (
    /^event[A-Z]/.test(root) ||
    /^(?:get|set|replace|insert|delete|create|update)(?:Variables?|ChatMessages?|Worldbook|DisplayedMessage|Preset|Script|Extension)/.test(
      root,
    )
  );
}

function classifyUse(
  file: ParsedFile,
  use: IdentifierUse,
  policy: QualityPolicy,
  systemClockRange: LineRange | undefined,
): SideEffectCapability | undefined {
  const root = rootIdentifier(use);
  // Scope-manager provenance distinguishes a true import from a same-named
  // parameter/local. This also avoids letting one local `fetch` declaration
  // suppress an unrelated ambient fetch elsewhere in the same file.
  if (use.bindingKind === 'local') {
    return undefined;
  }
  if (matchesAnyName(use, policy.capabilities.allowedGlobals)) {
    return undefined;
  }

  const moduleCapability =
    use.bindingKind === 'import' && use.importSource ? importedModuleCapability(use.importSource) : undefined;
  if (moduleCapability) {
    return moduleCapability;
  }
  if (matchesAnyName(use, policy.capabilities.domUi)) {
    return 'DOM_UI';
  }
  if (matchesAnyName(use, policy.capabilities.storage)) {
    return 'STORAGE';
  }
  if (matchesAnyName(use, policy.capabilities.network)) {
    return 'NETWORK';
  }
  if (matchesAnyName(use, policy.capabilities.clockRandom)) {
    const isSystemClockAdapter =
      normalizePath(file.path) === normalizePath(policy.architecture.schedulerPath) &&
      systemClockRange !== undefined &&
      use.line >= systemClockRange.lineStart &&
      use.line <= systemClockRange.lineEnd;
    return isSystemClockAdapter ? 'SYSTEM_CLOCK' : 'CLOCK_RANDOM';
  }
  if (STANDARD_GLOBALS.has(root) || PURE_INJECTED_GLOBALS.has(root)) {
    return undefined;
  }
  if (isTavernGlobal(use) || use.bindingKind === 'ambient') {
    return 'TAVERN_HELPER';
  }
  return undefined;
}

export function classifyDirectCapability(
  file: ParsedFile,
  use: IdentifierUse,
  policy: QualityPolicy,
): SideEffectCapability | undefined {
  const systemClockRange =
    normalizePath(file.path) === normalizePath(policy.architecture.schedulerPath)
      ? namedInitializerRange(file.internal.ast, policy.architecture.schedulerClockObject)
      : undefined;
  return classifyUse(file, use, policy, systemClockRange);
}

export function classifyImportCapability(imported: ImportFact): SideEffectCapability | undefined {
  if (imported.typeOnly || !imported.sideEffectOnly) {
    return undefined;
  }
  const cleanSpecifier = imported.rawSpecifier.replace(/[?#].*$/u, '');
  return (
    importedModuleCapability(imported.rawSpecifier) ??
    (imported.resource && /\.(?:css|scss|sass|less|styl)$/iu.test(cleanSpecifier) ? 'DOM_UI' : undefined)
  );
}

function directEffectsForFile(file: ParsedFile, policy: QualityPolicy): EffectEvidence[] {
  const systemClockRange =
    normalizePath(file.path) === normalizePath(policy.architecture.schedulerPath)
      ? namedInitializerRange(file.internal.ast, policy.architecture.schedulerClockObject)
      : undefined;
  const seen = new Set<string>();
  const effects: EffectEvidence[] = [];

  for (const imported of file.imports) {
    const capability = classifyImportCapability(imported);
    if (!capability) {
      continue;
    }
    const identifier = `import ${JSON.stringify(imported.rawSpecifier)}`;
    const key = `${capability}\0${imported.line}\0${imported.column}\0${identifier}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    effects.push({
      capability,
      path: normalizePath(file.path),
      line: imported.line,
      column: imported.column,
      objectId: normalizePath(file.path),
      identifier,
    });
  }

  for (const use of file.identifierUses) {
    const capability = classifyUse(file, use, policy, systemClockRange);
    if (!capability) {
      continue;
    }
    const identifier = use.qualifiedName || use.name;
    const key = `${capability}\0${use.line}\0${use.column}\0${identifier}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    effects.push({
      capability,
      path: normalizePath(file.path),
      line: use.line,
      column: use.column,
      objectId: use.objectId ?? normalizePath(file.path),
      identifier,
    });
  }
  return effects.sort(stableEvidenceSort);
}

function shortestEffectPath(
  start: string,
  capability: SideEffectCapability,
  runtime: Record<string, string[]>,
  direct: Record<string, EffectEvidence[]>,
): EffectPath | undefined {
  const queue: Array<{ node: string; modules: string[] }> = [{ node: start, modules: [start] }];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const evidence = (direct[current.node] ?? []).find(item => item.capability === capability);
    if (evidence) {
      return { capability, modules: current.modules, evidence };
    }
    for (const target of [...(runtime[current.node] ?? [])].sort(compareStrings)) {
      if (visited.has(target)) {
        continue;
      }
      visited.add(target);
      queue.push({ node: target, modules: [...current.modules, target] });
    }
  }
  return undefined;
}

function reachableEffectGroups(
  start: string,
  runtime: Record<string, string[]>,
  direct: Record<string, EffectEvidence[]>,
): ReachableEffectGroup[] {
  const paths = new Map<string, string[]>([[start, [start]]]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const target of [...(runtime[current] ?? [])].sort(compareStrings)) {
      if (paths.has(target)) {
        continue;
      }
      paths.set(target, [...paths.get(current)!, target]);
      queue.push(target);
    }
  }

  const groups = new Map<string, ReachableEffectGroup>();
  for (const [sourcePath, modules] of [...paths.entries()].sort(([left], [right]) => compareStrings(left, right))) {
    for (const evidence of direct[sourcePath] ?? []) {
      const key = `${evidence.capability}\0${sourcePath}\0${evidence.objectId}`;
      const group = groups.get(key) ?? {
        capability: evidence.capability,
        sourcePath,
        sourceObjectId: evidence.objectId,
        modules,
        evidence: [],
      };
      group.evidence.push(evidence);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map(group => ({ ...group, evidence: [...group.evidence].sort(stableEvidenceSort) }))
    .sort(
      (left, right) =>
        CAPABILITY_ORDER.indexOf(left.capability) - CAPABILITY_ORDER.indexOf(right.capability) ||
        compareStrings(left.sourcePath, right.sourcePath) ||
        compareStrings(left.sourceObjectId, right.sourceObjectId),
    );
}

export function analyzeEffects(files: ParsedFile[], graph: DependencyGraph, policy: QualityPolicy): EffectAnalysis {
  const paths = files.map(file => normalizePath(file.path)).sort(compareStrings);
  const direct: Record<string, EffectEvidence[]> = {};
  const effective: Record<string, SideEffectCapability[]> = {};
  const shortestPaths: Record<string, EffectPath[]> = {};

  for (const file of [...files].sort((left, right) => compareStrings(left.path, right.path))) {
    direct[normalizePath(file.path)] = directEffectsForFile(file, policy);
  }

  for (const filePath of paths) {
    const effectPaths = CAPABILITY_ORDER.map(capability =>
      shortestEffectPath(filePath, capability, graph.runtime, direct),
    ).filter((effectPath): effectPath is EffectPath => effectPath !== undefined);
    shortestPaths[filePath] = effectPaths;
    effective[filePath] = effectPaths.map(effectPath => effectPath.capability);
  }

  return { direct, effective, shortestPaths };
}

function capabilityLabel(capability: SideEffectCapability): string {
  const labels: Record<SideEffectCapability, string> = {
    TAVERN_HELPER: '酒馆助手全局',
    DOM_UI: 'DOM/UI',
    STORAGE: '持久化或聊天写读',
    NETWORK: '网络或模型请求',
    CLOCK_RANDOM: '系统时钟或随机源',
    SYSTEM_CLOCK: 'SYSTEM_CLOCK 时钟适配器',
  };
  return labels[capability];
}

export function effectFindings(files: ParsedFile[], graph: DependencyGraph, policy: QualityPolicy): FindingSeed[] {
  const analysis = analyzeEffects(files, graph, policy);
  const protectedPaths = new Map<string, { scheduler: boolean }>();

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (policy.architecture.purePaths.some(pattern => matchesPathPattern(filePath, pattern))) {
      protectedPaths.set(filePath, { scheduler: false });
    }
  }
  const schedulerPath = normalizePath(policy.architecture.schedulerPath);
  if (files.some(file => normalizePath(file.path) === schedulerPath)) {
    protectedPaths.set(schedulerPath, { scheduler: true });
  }

  const findings: FindingSeed[] = [];
  for (const [filePath, protection] of [...protectedPaths.entries()].sort(([left], [right]) =>
    compareStrings(left, right),
  )) {
    for (const effectGroup of reachableEffectGroups(filePath, graph.runtime, analysis.direct)) {
      if (protection.scheduler && effectGroup.capability === 'SYSTEM_CLOCK') {
        continue;
      }

      const isDirect = effectGroup.modules.length === 1;
      const evidence = effectGroup.evidence[0]!;
      const route = effectGroup.modules.join(' → ');
      const schedulerMessage = protection.scheduler
        ? `调度器除 ${policy.architecture.schedulerClockObject} 外不得访问可观察副作用`
        : '纯逻辑模块不得访问可观察副作用';
      findings.push({
        ruleId: protection.scheduler ? 'SCHEDULER_EFFECT_BOUNDARY' : 'PURE_MODULE_SIDE_EFFECT',
        severity: 'error',
        category: 'side-effect',
        objectType: 'module',
        objectId: `${filePath}#${effectGroup.capability}#${effectGroup.sourcePath}#${effectGroup.sourceObjectId}`,
        path: filePath,
        line: isDirect ? evidence.line : 1,
        column: isDirect ? evidence.column : 1,
        observed: effectGroup.capability,
        limit: protection.scheduler ? 'SYSTEM_CLOCK only' : 'none',
        debt: effectGroup.evidence.length,
        message: `${schedulerMessage}：检测到${capabilityLabel(effectGroup.capability)}（${route}，源对象 ${effectGroup.sourceObjectId} 共 ${effectGroup.evidence.length} 处）。`,
        suggestedFix: protection.scheduler
          ? `把时钟访问封装进 ${policy.architecture.schedulerClockObject}，其他能力通过 executor/回调注入。`
          : '把副作用移到入口或 adapter，并将所需数据或能力作为参数注入纯逻辑。',
        evidenceKey: `${effectGroup.capability}:${effectGroup.sourcePath}:${effectGroup.sourceObjectId}`,
        details: {
          capability: effectGroup.capability,
          path: effectGroup.modules,
          evidence: {
            path: evidence.path,
            line: evidence.line,
            column: evidence.column,
            identifier: evidence.identifier,
          },
          evidences: effectGroup.evidence.map(item => ({
            path: item.path,
            line: item.line,
            column: item.column,
            identifier: item.identifier,
          })),
        },
      });
    }
  }

  return findings.sort(stableFindingSort);
}
