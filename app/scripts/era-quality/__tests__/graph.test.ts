import { describe, expect, it } from 'vitest';

import { loadPolicy } from '../config.ts';
import { analyzeEffects, effectFindings } from '../effects.ts';
import { architectureFindings, buildDependencyGraph, dependencyFindings, matchesPathPattern } from '../graph.ts';
import type { IdentifierUse, ImportFact, ParsedFile, QualityPolicy } from '../types.ts';

function imported(targetPath: string, typeOnly = false): ImportFact {
  return {
    rawSpecifier: targetPath,
    sourceModule: targetPath.replace(/\.(?:ts|vue)$/u, ''),
    localNames: [],
    targetModule: targetPath.replace(/\.(?:ts|vue)$/u, ''),
    targetPath,
    external: false,
    typeOnly,
    dynamic: false,
    sideEffectOnly: false,
    resource: false,
    line: 2,
    column: 3,
  };
}

function externalImported(rawSpecifier: string, localName: string, sideEffectOnly = false): ImportFact {
  return {
    rawSpecifier,
    sourceModule: rawSpecifier,
    localNames: [localName],
    external: true,
    typeOnly: false,
    dynamic: false,
    sideEffectOnly,
    resource: false,
    line: 1,
    column: 1,
  };
}

function identifier(
  name: string,
  qualifiedName = name,
  line = 3,
  locallyBound = false,
  importSource?: string,
): IdentifierUse {
  return {
    name,
    qualifiedName,
    kind: 'call',
    bindingKind: importSource ? 'import' : locallyBound ? 'local' : 'ambient',
    ...(importSource ? { importSource } : {}),
    line,
    column: 5,
    locallyBound,
  };
}

function parsedFile(
  filePath: string,
  options: {
    imports?: ImportFact[];
    identifierUses?: IdentifierUse[];
    declaredNames?: string[];
    ast?: unknown;
  } = {},
): ParsedFile {
  return {
    path: filePath,
    absolutePath: `/repo/${filePath}`,
    moduleName: filePath.replace(/\.(?:ts|vue)$/u, '').replace(/\/index$/u, ''),
    kind: filePath.endsWith('.vue') ? 'vue' : 'ts',
    text: '',
    bytes: 0,
    codeLines: 10,
    lines: 20,
    scriptCodeLines: 10,
    functionCount: 0,
    classCount: 0,
    exportCount: 0,
    branchCount: 0,
    maxNestingDepth: 0,
    comments: [],
    functions: [],
    types: [],
    imports: options.imports ?? [],
    identifierUses: options.identifierUses ?? [],
    declaredNames: options.declaredNames ?? [],
    internal: {
      ast: options.ast ?? { type: 'Program', body: [] },
      scriptRanges: [],
    },
  };
}

async function testPolicy(overrides: Partial<QualityPolicy> = {}): Promise<QualityPolicy> {
  const loaded = await loadPolicy(process.cwd());
  return { ...loaded, ...overrides };
}

describe('dependency graph', () => {
  it('separates type edges, reports runtime cycles, and keeps ordering stable', async () => {
    const files = [
      parsedFile('src/a/index.ts', {
        imports: [imported('src/b.ts'), imported('src/contracts.ts', true)],
      }),
      parsedFile('src/b.ts', { imports: [imported('src/a/index.ts')] }),
      parsedFile('src/contracts.ts'),
    ];
    const graph = buildDependencyGraph(files);
    const policy = await testPolicy();
    const findings = dependencyFindings(files, graph, policy);

    expect(graph.runtime['src/a/index.ts']).toEqual(['src/b.ts']);
    expect(graph.typeOnly['src/a/index.ts']).toEqual(['src/contracts.ts']);
    expect(graph.cycles).toEqual([['src/a/index.ts', 'src/b.ts', 'src/a/index.ts']]);
    expect(findings.map(finding => finding.ruleId)).toEqual([
      'BIDIRECTIONAL_DEPENDENCY',
      'DEPENDENCY_CYCLE',
      'DEPENDENCY_CYCLE',
    ]);
    expect(findings.filter(finding => finding.ruleId === 'DEPENDENCY_CYCLE').map(finding => finding.objectId)).toEqual([
      'src/a/index.ts -> src/b.ts',
      'src/b.ts -> src/a/index.ts',
    ]);
  });

  it('matches braces and double-star paths, including a zero-directory match', () => {
    expect(
      matchesPathPattern(
        'src/ERA变量框架/events/catalog.ts',
        'src/ERA变量框架/events/{catalog,merger,types,scheduler}.ts',
      ),
    ).toBe(true);
    expect(matchesPathPattern('src/ERA变量框架/core/timetravel.ts', 'src/ERA变量框架/core/**')).toBe(true);
  });

  it('applies forbidden architecture edges to type-only imports', async () => {
    const files = [
      parsedFile('src/core/domain.ts', {
        imports: [imported('src/ui/view.vue', true), imported('src/ui/view.vue', false)],
      }),
      parsedFile('src/ui/view.vue'),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        forbiddenImports: [{ from: 'src/core/**', to: ['src/ui/**'] }],
      },
    };

    expect(architectureFindings(files, graph, policy)).toMatchObject([
      {
        ruleId: 'FORBIDDEN_ARCHITECTURE_IMPORT',
        path: 'src/core/domain.ts',
        line: 2,
        details: { typeOnly: false, importCount: 2 },
      },
    ]);
  });

  it('按 6 与 10 个模块的阈值区分最长依赖链告警和错误', async () => {
    const policy = await testPolicy();
    const chain = (length: number) =>
      Array.from({ length }, (_, index) =>
        parsedFile(`src/chain-${index}.ts`, {
          imports: index + 1 < length ? [imported(`src/chain-${index + 1}.ts`)] : [],
        }),
      );

    const warningFiles = chain(6);
    const warning = dependencyFindings(warningFiles, buildDependencyGraph(warningFiles), policy).find(
      finding => finding.ruleId === 'DEPENDENCY_CHAIN',
    );
    expect(warning).toMatchObject({
      severity: 'warning',
      objectId: 'runtime-dependency-chain',
      observed: 6,
      limit: 6,
      debt: 1,
    });

    const errorFiles = chain(11);
    const error = dependencyFindings(errorFiles, buildDependencyGraph(errorFiles), policy).find(
      finding => finding.ruleId === 'DEPENDENCY_CHAIN',
    );
    expect(error).toMatchObject({
      severity: 'error',
      objectId: 'runtime-dependency-chain',
      observed: 11,
      limit: 10,
      debt: 6,
    });
  });
});

describe('side-effect analysis', () => {
  it('ignores a locally shadowed global and propagates the shortest runtime path', async () => {
    const files = [
      parsedFile('src/pure.ts', { imports: [imported('src/adapter.ts')] }),
      parsedFile('src/adapter.ts', {
        identifierUses: [identifier('getVariables'), identifier('fetch', 'fetch', 4, true)],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: ['src/pure.ts'],
        schedulerPath: 'src/scheduler.ts',
      },
    };
    const analysis = analyzeEffects(files, graph, policy);
    const findings = effectFindings(files, graph, policy);

    expect(analysis.effective['src/adapter.ts']).toEqual(['STORAGE']);
    expect(findings).toMatchObject([
      {
        ruleId: 'PURE_MODULE_SIDE_EFFECT',
        objectId: 'src/pure.ts#STORAGE#src/adapter.ts#src/adapter.ts',
        details: { path: ['src/pure.ts', 'src/adapter.ts'] },
      },
    ]);
  });

  it('permits clock access only inside the scheduler SYSTEM_CLOCK initializer', async () => {
    const systemClockAst = {
      type: 'Program',
      body: [
        {
          type: 'ExportNamedDeclaration',
          declaration: {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: 'SYSTEM_CLOCK' },
                init: { loc: { start: { line: 2 }, end: { line: 5 } } },
              },
            ],
          },
        },
      ],
    };
    const files = [
      parsedFile('src/scheduler.ts', {
        ast: systemClockAst,
        identifierUses: [identifier('now', 'Date.now', 3), identifier('setTimeout', 'globalThis.setTimeout', 8)],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: [],
        schedulerPath: 'src/scheduler.ts',
        schedulerClockObject: 'SYSTEM_CLOCK',
      },
    };

    expect(analyzeEffects(files, graph, policy).effective['src/scheduler.ts']).toEqual([
      'CLOCK_RANDOM',
      'SYSTEM_CLOCK',
    ]);
    expect(effectFindings(files, graph, policy)).toMatchObject([
      {
        ruleId: 'SCHEDULER_EFFECT_BOUNDARY',
        observed: 'CLOCK_RANDOM',
        line: 8,
      },
    ]);
  });

  it('嵌套同名变量不能伪装成 scheduler 的 SYSTEM_CLOCK 适配器', async () => {
    const nestedClockAst = {
      type: 'Program',
      body: [
        {
          type: 'FunctionDeclaration',
          body: {
            type: 'BlockStatement',
            body: [
              {
                type: 'VariableDeclaration',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: { type: 'Identifier', name: 'SYSTEM_CLOCK' },
                    init: { loc: { start: { line: 3 }, end: { line: 5 } } },
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const files = [
      parsedFile('src/scheduler.ts', {
        ast: nestedClockAst,
        identifierUses: [identifier('Date', 'Date.now', 4)],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: [],
        schedulerPath: 'src/scheduler.ts',
        schedulerClockObject: 'SYSTEM_CLOCK',
      },
    };

    expect(effectFindings(files, graph, policy)).toEqual([
      expect.objectContaining({
        ruleId: 'SCHEDULER_EFFECT_BOUNDARY',
        observed: 'CLOCK_RANDOM',
        line: 4,
      }),
    ]);
  });

  it('把有别名的外部副作用库视为能力，同时继续忽略普通局部同名变量', async () => {
    const files = [
      parsedFile('src/pure.ts', {
        imports: [externalImported('axios', 'request')],
        identifierUses: [
          identifier('request', 'request.get', 3, true, 'axios'),
          identifier('fetch', 'fetch', 4, true),
          identifier('request', 'request.get', 5, true),
        ],
        declaredNames: ['request', 'fetch'],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: ['src/pure.ts'],
      },
    };

    expect(analyzeEffects(files, graph, policy).effective['src/pure.ts']).toEqual(['NETWORK']);
    expect(effectFindings(files, graph, policy)).toMatchObject([
      {
        ruleId: 'PURE_MODULE_SIDE_EFFECT',
        observed: 'NETWORK',
        details: { evidence: { identifier: 'request.get' } },
      },
    ]);
  });

  it('把已知副作用库和样式的裸运行时导入视为直接能力', async () => {
    const styleImport: ImportFact = {
      ...externalImported('./panel.scss', '', true),
      localNames: [],
      external: false,
      resource: true,
      rawSpecifier: './panel.scss',
      sourceModule: './panel.scss',
      line: 2,
    };
    const files = [
      parsedFile('src/pure.ts', {
        imports: [{ ...externalImported('socket.io-client', '', true), localNames: [] }, styleImport],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: ['src/pure.ts'],
      },
    };

    expect(effectFindings(files, graph, policy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ observed: 'NETWORK', debt: 1 }),
        expect.objectContaining({ observed: 'DOM_UI', debt: 1 }),
      ]),
    );
  });

  it('运行时 re-export 仍会加载已知副作用模块', async () => {
    const runtimeReexport = {
      ...externalImported('socket.io-client', '', true),
      localNames: [],
    };
    const typeReexport = { ...runtimeReexport, typeOnly: true, sideEffectOnly: false, line: 2 };
    const files = [
      parsedFile('src/pure.ts', {
        imports: [runtimeReexport, typeReexport],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: ['src/pure.ts'],
      },
    };

    expect(effectFindings(files, graph, policy)).toEqual([expect.objectContaining({ observed: 'NETWORK', debt: 1 })]);
  });

  it('同一源对象新增同类副作用会增加 debt，未知 ambient Tavern API 也不会漏检', async () => {
    const files = [
      parsedFile('src/pure.ts', {
        identifierUses: [
          identifier('getVariables', 'getVariables', 2),
          identifier('localStorage', 'localStorage.getItem', 3),
          identifier('deleteCharacter', 'deleteCharacter', 4),
          identifier('eval', 'eval', 5),
          identifier('queueMicrotask', 'queueMicrotask', 6),
          identifier('setImmediate', 'setImmediate', 7),
          identifier('FinalizationRegistry', 'FinalizationRegistry', 8),
          identifier('WeakRef', 'WeakRef', 9),
        ],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        purePaths: ['src/pure.ts'],
      },
    };
    const findings = effectFindings(files, graph, policy);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ observed: 'STORAGE', debt: 2 }),
        expect.objectContaining({ observed: 'TAVERN_HELPER', debt: 2 }),
        expect.objectContaining({ observed: 'CLOCK_RANDOM', debt: 4 }),
      ]),
    );
  });

  it('未扫描的项目 d.ts 仍受 type-only 架构方向约束', async () => {
    const files = [
      parsedFile('src/core/consumer.ts', {
        imports: [imported('src/events/secret.d.ts', true)],
      }),
    ];
    const graph = buildDependencyGraph(files);
    const basePolicy = await testPolicy();
    const policy = {
      ...basePolicy,
      architecture: {
        ...basePolicy.architecture,
        forbiddenImports: [{ from: 'src/core/**', to: ['src/events/**'] }],
      },
    };

    expect(architectureFindings(files, graph, policy)).toEqual([
      expect.objectContaining({
        ruleId: 'FORBIDDEN_ARCHITECTURE_IMPORT',
        observed: 'src/events/secret.d.ts',
        details: expect.objectContaining({ typeOnly: true }),
      }),
    ]);
  });
});
