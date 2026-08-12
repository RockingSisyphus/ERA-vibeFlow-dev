import { describe, expect, it } from 'vitest';

import { loadPolicy } from '../config.ts';
import { structureFindings } from '../structure.ts';
import type { FunctionFact, ParsedFile } from '../types.ts';

const policy = await loadPolicy(process.cwd());

describe('structure code-line metrics', () => {
  it('文件和函数规模门禁使用非注释代码行，而不是物理行数', () => {
    const compactFunction = functionFact({ lines: 180, codeLines: 60 });
    const commentHeavy = parsedFile({
      lines: 900,
      codeLines: 300,
      functions: [compactFunction],
      functionCount: 1,
    });

    const findings = structureFindings([commentHeavy], policy);

    expect(findings.map(finding => finding.ruleId)).not.toContain('STRUCT_FILE_LINES');
    expect(findings.map(finding => finding.ruleId)).not.toContain('STRUCT_FUNCTION_LINES');
  });

  it('非注释代码本身越过阈值时仍然报错', () => {
    const longFunction = functionFact({ lines: 140, codeLines: 81 });
    const codeHeavy = parsedFile({
      lines: 700,
      codeLines: 501,
      functions: [longFunction],
      functionCount: 1,
    });

    expect(structureFindings([codeHeavy], policy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'STRUCT_FILE_LINES',
          severity: 'error',
          observed: 501,
        }),
        expect.objectContaining({
          ruleId: 'STRUCT_FUNCTION_LINES',
          severity: 'warning',
          observed: 81,
        }),
      ]),
    );
  });

  it('重复实现的最小长度也只按非注释代码行判断', () => {
    const fingerprint = 'same-normalized-ast';
    const first = parsedFile({
      path: 'src/ERA变量框架/first.ts',
      moduleName: 'src/ERA变量框架/first',
      functions: [functionFact({ objectId: 'first#copy', lines: 30, codeLines: 9, astFingerprint: fingerprint })],
      functionCount: 1,
    });
    const second = parsedFile({
      path: 'src/ERA变量框架/second.ts',
      moduleName: 'src/ERA变量框架/second',
      functions: [functionFact({ objectId: 'second#copy', lines: 30, codeLines: 9, astFingerprint: fingerprint })],
      functionCount: 1,
    });

    expect(structureFindings([first, second], policy).map(finding => finding.ruleId)).not.toContain(
      'STRUCT_DUPLICATE_FUNCTION',
    );
  });

  it('原始文件大小在 120,000 字节内允许，超过一个字节即报错', () => {
    const atLimit = parsedFile({ path: 'src/ERA变量框架/at-limit.ts', bytes: 120_000 });
    const overLimit = parsedFile({ path: 'src/ERA变量框架/over-limit.ts', bytes: 120_001 });

    expect(structureFindings([atLimit], policy).map(finding => finding.ruleId)).not.toContain('STRUCT_FILE_BYTES');
    expect(structureFindings([overLimit], policy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'STRUCT_FILE_BYTES',
          severity: 'error',
          observed: 120_001,
          limit: 120_000,
          debt: 1,
        }),
      ]),
    );
  });
});

function functionFact(overrides: Partial<FunctionFact> = {}): FunctionFact {
  return {
    objectId: 'example#function:execute',
    name: 'execute',
    qualifiedName: 'execute',
    kind: 'function',
    exported: false,
    async: false,
    range: [0, 100],
    bodyRange: [10, 100],
    lineStart: 1,
    lineEnd: 20,
    codeLines: 10,
    lines: 20,
    branches: 0,
    maxNestingDepth: 0,
    requiredParams: 0,
    parameterNames: [],
    astFingerprint: 'unique',
    ...overrides,
  };
}

function parsedFile(overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    path: 'src/ERA变量框架/example.ts',
    absolutePath: '/repo/src/ERA变量框架/example.ts',
    moduleName: 'src/ERA变量框架/example',
    kind: 'ts',
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
    imports: [],
    identifierUses: [],
    declaredNames: [],
    internal: { ast: { type: 'Program', body: [] }, scriptRanges: [[0, 0]] },
    ...overrides,
  };
}
