import type { DependencyGraph, FindingSeed, ImportFact, ParsedFile, QualityPolicy } from './types.ts';

function normalizePath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/[?#].*$/, '');
}

function directoryName(filePath: string): string {
  const normalized = normalizePath(filePath).replace(/\/+$/, '');
  const separator = normalized.lastIndexOf('/');
  return separator === -1 ? '.' : normalized.slice(0, separator);
}

function expandBraces(pattern: string): string[] {
  const opening = pattern.indexOf('{');
  if (opening === -1) {
    return [pattern];
  }

  const closing = pattern.indexOf('}', opening + 1);
  if (closing === -1) {
    return [pattern];
  }

  const before = pattern.slice(0, opening);
  const after = pattern.slice(closing + 1);
  return pattern
    .slice(opening + 1, closing)
    .split(',')
    .flatMap(choice => expandBraces(`${before}${choice}${after}`));
}

function globToRegExp(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index += 1;
        if (pattern[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

/** Match a repository-relative POSIX path against the limited glob syntax used by the policy. */
export function matchesPathPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizePath(filePath);
  return expandBraces(normalizePath(pattern)).some(expanded => globToRegExp(expanded).test(normalizedPath));
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, 'en');
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

interface FileIndex {
  byPath: Map<string, ParsedFile>;
  byAbsolutePath: Map<string, ParsedFile>;
  byModuleName: Map<string, ParsedFile>;
}

function createFileIndex(files: ParsedFile[]): FileIndex {
  return {
    byPath: new Map(files.map(file => [normalizePath(file.path), file])),
    byAbsolutePath: new Map(files.map(file => [normalizePath(file.absolutePath), file])),
    byModuleName: new Map(files.map(file => [file.moduleName, file])),
  };
}

function resolveImportedFile(imported: ParsedFile['imports'][number], index: FileIndex): ParsedFile | undefined {
  if (imported.external || imported.resource) {
    return undefined;
  }

  if (imported.targetPath) {
    const targetPath = normalizePath(imported.targetPath);
    const direct = index.byPath.get(targetPath) ?? index.byAbsolutePath.get(targetPath);
    if (direct) {
      return direct;
    }

    const absoluteSuffixMatch = [...index.byAbsolutePath.entries()].find(([absolutePath]) =>
      absolutePath.endsWith(`/${targetPath}`),
    );
    if (absoluteSuffixMatch) {
      return absoluteSuffixMatch[1];
    }
  }

  if (imported.targetModule) {
    return index.byModuleName.get(imported.targetModule);
  }
  return index.byModuleName.get(imported.sourceModule);
}

function stronglyConnectedComponents(adjacency: Record<string, string[]>): string[][] {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const inStack = new Set<string>();
  const components: string[][] = [];

  const visit = (node: string): void => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    inStack.add(node);

    for (const target of adjacency[node] ?? []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(target)!));
      } else if (inStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(target)!));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) {
      return;
    }

    const component: string[] = [];
    let popped: string;
    do {
      popped = stack.pop()!;
      inStack.delete(popped);
      component.push(popped);
    } while (popped !== node);
    component.sort(compareStrings);
    components.push(component);
  };

  for (const node of Object.keys(adjacency).sort(compareStrings)) {
    if (!indices.has(node)) {
      visit(node);
    }
  }
  return components.sort((left, right) => compareStrings(left[0]!, right[0]!));
}

function representativeCycle(component: string[], adjacency: Record<string, string[]>): string[] {
  if (component.length === 1) {
    const node = component[0]!;
    return (adjacency[node] ?? []).includes(node) ? [node, node] : [];
  }

  const members = new Set(component);
  const candidates: string[][] = [];
  for (const start of component) {
    const search = (node: string, route: string[], seen: Set<string>): string[] | undefined => {
      for (const target of (adjacency[node] ?? []).filter(candidate => members.has(candidate)).sort(compareStrings)) {
        if (target === start) {
          return [...route, start];
        }
        if (seen.has(target)) {
          continue;
        }
        const found = search(target, [...route, target], new Set([...seen, target]));
        if (found) {
          return found;
        }
      }
      return undefined;
    };
    const found = search(start, [start], new Set([start]));
    if (found) {
      candidates.push(found);
    }
  }

  return (
    candidates.sort(
      (left, right) => left.length - right.length || compareStrings(left.join('\0'), right.join('\0')),
    )[0] ?? []
  );
}

function findLongestAcyclicChain(adjacency: Record<string, string[]>, components: string[][]): string[] {
  const componentByNode = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    component.forEach(node => componentByNode.set(node, componentIndex));
  });

  // Cyclic components are already reported separately. Ignoring their internal edges keeps
  // chain length deterministic and prevents a cycle from masquerading as arbitrary depth.
  const acyclicAdjacency = Object.fromEntries(
    Object.entries(adjacency).map(([source, targets]) => [
      source,
      targets.filter(target => componentByNode.get(source) !== componentByNode.get(target)),
    ]),
  );
  const memo = new Map<string, string[]>();
  const longestFrom = (node: string): string[] => {
    const cached = memo.get(node);
    if (cached) {
      return cached;
    }
    const suffixes = (acyclicAdjacency[node] ?? []).map(longestFrom);
    const bestSuffix = suffixes.sort(
      (left, right) => right.length - left.length || compareStrings(left.join('\0'), right.join('\0')),
    )[0];
    const result = bestSuffix ? [node, ...bestSuffix] : [node];
    memo.set(node, result);
    return result;
  };

  return (
    Object.keys(adjacency)
      .sort(compareStrings)
      .map(longestFrom)
      .sort((left, right) => right.length - left.length || compareStrings(left.join('\0'), right.join('\0')))[0] ?? []
  );
}

function createDirectoryMetrics(
  runtime: Record<string, string[]>,
  typeOnly: Record<string, string[]>,
): Pick<DependencyGraph, 'directoryFanIn' | 'directoryFanOut'> {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const source of Object.keys(runtime).sort(compareStrings)) {
    const sourceDirectory = directoryName(source);
    outgoing.set(sourceDirectory, outgoing.get(sourceDirectory) ?? new Set());
    incoming.set(sourceDirectory, incoming.get(sourceDirectory) ?? new Set());
    const targets = new Set([...(runtime[source] ?? []), ...(typeOnly[source] ?? [])]);
    for (const target of targets) {
      const targetDirectory = directoryName(target);
      outgoing.set(targetDirectory, outgoing.get(targetDirectory) ?? new Set());
      incoming.set(targetDirectory, incoming.get(targetDirectory) ?? new Set());
      if (sourceDirectory === targetDirectory) {
        continue;
      }
      outgoing.get(sourceDirectory)!.add(targetDirectory);
      incoming.get(targetDirectory)!.add(sourceDirectory);
    }
  }

  const directoryFanOut = Object.fromEntries(
    [...outgoing.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([directory, targets]) => [directory, targets.size]),
  );
  const directoryFanIn = Object.fromEntries(
    [...incoming.entries()]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([directory, sources]) => [directory, sources.size]),
  );
  return { directoryFanIn, directoryFanOut };
}

export function buildDependencyGraph(files: ParsedFile[]): DependencyGraph {
  const sortedFiles = [...files].sort((left, right) => compareStrings(left.path, right.path));
  const index = createFileIndex(sortedFiles);
  const runtime: Record<string, string[]> = {};
  const typeOnly: Record<string, string[]> = {};

  for (const file of sortedFiles) {
    const source = normalizePath(file.path);
    const runtimeTargets = new Set<string>();
    const typeTargets = new Set<string>();
    for (const imported of file.imports) {
      const targetFile = resolveImportedFile(imported, index);
      if (!targetFile) {
        continue;
      }
      const target = normalizePath(targetFile.path);
      (imported.typeOnly ? typeTargets : runtimeTargets).add(target);
    }
    runtime[source] = [...runtimeTargets].sort(compareStrings);
    typeOnly[source] = [...typeTargets].sort(compareStrings);
  }

  const components = stronglyConnectedComponents(runtime);
  const cycles = components
    .map(component => representativeCycle(component, runtime))
    .filter(cycle => cycle.length > 0)
    .sort((left, right) => compareStrings(left.join('\0'), right.join('\0')));
  const longestRuntimeChain = findLongestAcyclicChain(runtime, components);
  const directoryMetrics = createDirectoryMetrics(runtime, typeOnly);

  return {
    runtime,
    typeOnly,
    longestRuntimeChain,
    cycles,
    ...directoryMetrics,
  };
}

function importLocation(files: ParsedFile[], source: string, target: string): { line: number; column: number } {
  const index = createFileIndex(files);
  const file = index.byPath.get(normalizePath(source));
  const imported = file?.imports.find(candidate => resolveImportedFile(candidate, index)?.path === target);
  return { line: imported?.line ?? 1, column: imported?.column ?? 1 };
}

function representativeFile(files: ParsedFile[], directory: string): string {
  return (
    files
      .map(file => normalizePath(file.path))
      .filter(filePath => directoryName(filePath) === directory)
      .sort(compareStrings)[0] ?? directory
  );
}

export function dependencyFindings(files: ParsedFile[], graph: DependencyGraph, policy: QualityPolicy): FindingSeed[] {
  const findings: FindingSeed[] = [];

  for (const [source, target] of cyclicRuntimeEdges(graph.runtime)) {
    const location = importLocation(files, source, target);
    findings.push({
      ruleId: 'DEPENDENCY_CYCLE',
      severity: 'error',
      category: 'dependency',
      objectType: 'dependency-edge',
      objectId: `${source} -> ${target}`,
      path: source,
      line: location.line,
      column: location.column,
      observed: true,
      limit: false,
      debt: 1,
      message: `运行时依赖边 ${source} → ${target} 位于依赖环中。`,
      suggestedFix: '提取共同契约或反转依赖，使运行时依赖保持单向。',
      evidenceKey: `${source}>${target}`,
      details: { edge: [source, target] },
    });
  }

  const bidirectionalPairs = new Set<string>();
  for (const source of Object.keys(graph.runtime).sort(compareStrings)) {
    for (const target of graph.runtime[source] ?? []) {
      if (!(graph.runtime[target] ?? []).includes(source)) {
        continue;
      }
      const pair = [source, target].sort(compareStrings);
      const pairKey = pair.join('\0');
      if (bidirectionalPairs.has(pairKey)) {
        continue;
      }
      bidirectionalPairs.add(pairKey);
      const location = importLocation(files, pair[0]!, pair[1]!);
      findings.push({
        ruleId: 'BIDIRECTIONAL_DEPENDENCY',
        severity: 'error',
        category: 'dependency',
        objectType: 'module-pair',
        objectId: pair.join(' <-> '),
        path: pair[0]!,
        line: location.line,
        column: location.column,
        observed: true,
        limit: false,
        debt: 1,
        message: `模块存在双向运行时依赖：${pair.join(' ↔ ')}`,
        suggestedFix: '将共享类型或协调逻辑下沉到第三个模块，移除其中一个运行时方向。',
        evidenceKey: pair.join('<>'),
        details: { modules: pair },
      });
    }
  }

  const chainLength = graph.longestRuntimeChain.length;
  if (chainLength >= policy.thresholds.warnDependencyChain) {
    const isError = chainLength > policy.thresholds.maxDependencyChain;
    const limit = isError ? policy.thresholds.maxDependencyChain : policy.thresholds.warnDependencyChain;
    findings.push({
      ruleId: 'DEPENDENCY_CHAIN',
      severity: isError ? 'error' : 'warning',
      category: 'dependency',
      objectType: 'dependency-chain',
      objectId: 'runtime-dependency-chain',
      path: graph.longestRuntimeChain[0] ?? files[0]?.path ?? '.',
      line: 1,
      column: 1,
      observed: chainLength,
      limit,
      debt: chainLength - policy.thresholds.warnDependencyChain + 1,
      message: `最长运行时依赖链包含 ${chainLength} 个模块：${graph.longestRuntimeChain.join(' → ')}`,
      suggestedFix: '合并无独立职责的转发层，或引入稳定的边界接口缩短依赖链。',
      evidenceKey: graph.longestRuntimeChain.join('>'),
      details: { chain: graph.longestRuntimeChain },
    });
  }

  const directoryRules: Array<{
    ruleId: string;
    metric: Record<string, number>;
    limit: number;
    label: string;
    fix: string;
  }> = [
    {
      ruleId: 'DIRECTORY_FAN_OUT',
      metric: graph.directoryFanOut,
      limit: policy.thresholds.maxDirectoryFanout,
      label: '扇出',
      fix: '收紧目录职责，避免一个目录直接了解过多其他子系统。',
    },
    {
      ruleId: 'DIRECTORY_FAN_IN',
      metric: graph.directoryFanIn,
      limit: policy.thresholds.maxDirectoryFanin,
      label: '扇入',
      fix: '拆分过度集中的目录接口，并为高复用能力提供稳定的适配层。',
    },
  ];
  for (const rule of directoryRules) {
    for (const [directory, observed] of Object.entries(rule.metric).sort(([left], [right]) =>
      compareStrings(left, right),
    )) {
      if (observed <= rule.limit) {
        continue;
      }
      findings.push({
        ruleId: rule.ruleId,
        severity: 'warning',
        category: 'dependency',
        objectType: 'directory',
        objectId: directory,
        path: representativeFile(files, directory),
        line: 1,
        column: 1,
        observed,
        limit: rule.limit,
        debt: observed - rule.limit,
        message: `目录 ${directory} 的依赖${rule.label}为 ${observed}，超过上限 ${rule.limit}。`,
        suggestedFix: rule.fix,
        evidenceKey: `${directory}:${observed}`,
      });
    }
  }

  return findings.sort(stableFindingSort);
}

function cyclicRuntimeEdges(runtime: Record<string, string[]>): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  const reaches = (start: string, goal: string): boolean => {
    const queue = [start];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === goal) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      queue.push(...(runtime[current] ?? []));
    }
    return false;
  };

  for (const source of Object.keys(runtime).sort(compareStrings)) {
    for (const target of [...(runtime[source] ?? [])].sort(compareStrings)) {
      if (reaches(target, source)) {
        result.push([source, target]);
      }
    }
  }
  return result;
}

export function architectureFindings(
  files: ParsedFile[],
  _graph: DependencyGraph,
  policy: QualityPolicy,
): FindingSeed[] {
  const findings: FindingSeed[] = [];
  const index = createFileIndex(files);
  const emittedEdges = new Set<string>();

  for (const file of [...files].sort((left, right) => compareStrings(left.path, right.path))) {
    const source = normalizePath(file.path);
    for (const boundary of policy.architecture.forbiddenImports) {
      if (!matchesPathPattern(source, boundary.from)) {
        continue;
      }
      const groups = new Map<
        string,
        { target: string; matchedPattern: string; imports: ImportFact[]; limit: string; fromPattern: string }
      >();
      for (const imported of file.imports) {
        const targetFile = resolveImportedFile(imported, index);
        const target =
          targetFile !== undefined
            ? normalizePath(targetFile.path)
            : !imported.external && !imported.resource && imported.targetPath
              ? normalizePath(imported.targetPath)
              : undefined;
        if (!target) {
          continue;
        }
        const matchedPattern = boundary.to.find(pattern => matchesPathPattern(target, pattern));
        if (!matchedPattern) {
          continue;
        }
        const edgeKey = `${source}\0${target}`;
        const group = groups.get(edgeKey) ?? {
          target,
          matchedPattern,
          imports: [],
          limit: boundary.to.join(', '),
          fromPattern: boundary.from,
        };
        group.imports.push(imported);
        groups.set(edgeKey, group);
      }

      for (const [edgeKey, group] of groups) {
        if (emittedEdges.has(edgeKey)) {
          continue;
        }
        emittedEdges.add(edgeKey);
        const imports = [...group.imports].sort(
          (left, right) =>
            left.line - right.line ||
            left.column - right.column ||
            compareStrings(left.rawSpecifier, right.rawSpecifier),
        );
        const firstImport = imports[0]!;
        const typeOnly = imports.every(imported => imported.typeOnly);
        findings.push({
          ruleId: 'FORBIDDEN_ARCHITECTURE_IMPORT',
          severity: 'error',
          category: 'architecture',
          objectType: 'import',
          objectId: `${source} -> ${group.target}`,
          path: source,
          line: firstImport.line,
          column: firstImport.column,
          observed: group.target,
          limit: group.limit,
          debt: 1,
          message: `架构边界禁止 ${source} 依赖 ${group.target}${typeOnly ? '（仅类型导入也不例外）' : ''}。`,
          suggestedFix: '把共享契约下沉到允许的稳定层，或通过入口/适配器反转该依赖。',
          evidenceKey: `${source}>${group.target}`,
          details: {
            fromPattern: group.fromPattern,
            toPattern: group.matchedPattern,
            typeOnly,
            importCount: imports.length,
          },
        });
      }
    }
  }

  return findings.sort(stableFindingSort);
}
