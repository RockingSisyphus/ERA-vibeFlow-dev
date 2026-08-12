import { describe, expect, it } from 'vitest';

import { addFingerprints } from '../baseline.ts';
import { commentFindings } from '../comments.ts';
import { loadPolicy } from '../config.ts';
import type { CommentFact, FunctionFact, ParsedFile } from '../types.ts';

const policy = await loadPolicy(process.cwd());

describe('ERA 中文注释规则', () => {
  it('同时检查 Vue 各区段的语言与高置信劣质注释', () => {
    const comments: CommentFact[] = [
      comment('english', 'template', '<!-- This comment explains the visible panel -->', 2),
      comment('meta', 'script', '// 中文注释：获取当前值', 4, 'const value = getValue();'),
      comment(
        'disabled',
        'script',
        ['// const value = getValue();', '// if (value) {', '// updateValue(value);', '// return value;', '// }'].join(
          '\n',
        ),
        6,
      ),
      comment('style', 'style', '/* 背景色 */', 13, 'background-color: red;'),
    ];
    const result = commentFindings([parsedFile({ comments })], policy);
    const byRule = new Map(result.findings.map(finding => [finding.ruleId, finding]));

    expect(byRule.get('COMMENT_CHINESE_PRIMARY')?.path).toBe('src/ERA变量框架/example.vue');
    expect(byRule.get('COMMENT_META_WORDING')?.severity).toBe('warning');
    expect(byRule.get('COMMENT_DISABLED_CODE')?.severity).toBe('error');
    expect(byRule.get('COMMENT_WHAT_NARRATION')?.severity).toBe('warning');
    expect(result.metrics).toMatchObject({ total: 4, naturalLanguage: 3, chinese: 2 });
  });

  it('不会让紧邻的设计说明稀释后续注释代码块', () => {
    const comments: CommentFact[] = [
      {
        ...comment('reason', 'script', '/* 因为旧实现会破坏当前时序，所以这里记录废弃原因。 */', 1),
        kind: 'block',
      },
      comment('disabled-1', 'script', '// function oldImplementation() {', 2),
      comment('disabled-gap', 'script', '//', 3),
      comment('disabled-2', 'script', "// logger.warn('旧实现失败，请检查日志。');", 4),
      comment('disabled-3', 'script', '// const value = getValue();', 5),
      comment('disabled-4', 'script', '// return value;', 6),
      comment('disabled-5', 'script', '// }', 7),
    ];

    expect(commentFindings([parsedFile({ comments })], policy).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_DISABLED_CODE',
          severity: 'error',
          line: 2,
        }),
      ]),
    );
  });

  it('豁免许可证、工具指令和成对代码围栏中的示例实现', () => {
    const comments: CommentFact[] = [
      comment('license', 'script', '// SPDX-License-Identifier: MIT', 1),
      comment('directive', 'script', '// eslint-disable-next-line no-console', 2),
      comment('fence-open', 'script', '// ```ts', 3),
      comment('fence-code', 'script', '// const example = getValue();', 4),
      comment('fence-close', 'script', '// ```', 5),
      comment('mixed', 'script', '// API fallback 为了兼容旧数据必须保留', 6),
    ];

    const result = commentFindings([parsedFile({ comments })], policy);
    const rules = result.findings.map(finding => finding.ruleId);

    expect(rules).not.toContain('COMMENT_DISABLED_CODE');
    expect(rules).not.toContain('COMMENT_CHINESE_PRIMARY');
    expect(result.metrics).toMatchObject({ naturalLanguage: 1, chinese: 1 });
  });

  it('短英文说明和伪工具指令不能绕过中文要求', () => {
    const comments: CommentFact[] = [
      comment('short-english', 'script', '// Temporary workaround', 1),
      comment('fake-eslint', 'script', '// eslint This is an English explanation, not a directive', 2),
      comment('fake-prettier', 'script', '// prettier-ignore This is an English explanation', 3),
      comment('real-eslint', 'script', '// eslint-disable-next-line no-console -- browser console is intentional', 4),
      comment('real-prettier', 'script', '// prettier-ignore', 5),
    ];
    const result = commentFindings([parsedFile({ comments })], policy);
    const chineseFindings = result.findings.filter(finding => finding.ruleId === 'COMMENT_CHINESE_PRIMARY');

    expect(chineseFindings.map(finding => finding.line)).toEqual([1, 2, 3]);
    expect(result.metrics).toMatchObject({ naturalLanguage: 3, chinese: 0 });
  });

  it('不允许跨越源码间隔的围栏吞掉后续注释代码', () => {
    const comments: CommentFact[] = [
      comment('fence-open', 'script', '// ```ts', 1),
      comment('not-contiguous', 'script', '// const hidden = getValue();', 4),
      comment('fence-close', 'script', '// ```', 5),
    ];

    expect(commentFindings([parsedFile({ comments })], policy).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_DISABLED_CODE',
          severity: 'warning',
          line: 4,
        }),
      ]),
    );
  });

  it('要求非平凡导出函数具有直接相邻且解释原因的中文 JSDoc', () => {
    const file = parsedFile({
      kind: 'ts',
      path: 'src/ERA变量框架/example.ts',
      comments: [],
      functions: [
        {
          objectId: 'example.ts#exported',
          name: 'exported',
          qualifiedName: 'exported',
          kind: 'function',
          exported: true,
          async: false,
          range: [0, 100],
          bodyRange: [20, 100],
          lineStart: 1,
          lineEnd: 13,
          codeLines: 13,
          lines: 13,
          branches: 1,
          maxNestingDepth: 1,
          requiredParams: 0,
          parameterNames: [],
          astFingerprint: 'fingerprint',
        },
      ],
    });

    expect(commentFindings([file], policy).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_CRITICAL_DOC_MISSING',
          objectId: 'example.ts#exported',
        }),
      ]),
    );
  });

  it('关键函数文档的 50/51 与导出函数 10/11 边界只看代码行', () => {
    const makeFunction = (name: string, exported: boolean, codeLines: number): FunctionFact => ({
      objectId: `example.ts#function:${name}`,
      name,
      qualifiedName: name,
      kind: 'function',
      exported,
      async: false,
      range: [0, 100],
      bodyRange: [10, 100],
      lineStart: 1,
      lineEnd: 200,
      codeLines,
      lines: 200,
      branches: 0,
      maxNestingDepth: 0,
      requiredParams: 0,
      parameterNames: [],
      astFingerprint: name,
    });
    const file = parsedFile({
      kind: 'ts',
      path: 'src/ERA变量框架/example.ts',
      functions: [
        makeFunction('internalAtLimit', false, 50),
        makeFunction('internalOverLimit', false, 51),
        makeFunction('exportedAtLimit', true, 10),
        makeFunction('exportedOverLimit', true, 11),
      ],
    });

    const missing = commentFindings([file], policy)
      .findings.filter(finding => finding.ruleId === 'COMMENT_CRITICAL_DOC_MISSING')
      .map(finding => finding.objectId)
      .sort();

    expect(missing).toEqual(['example.ts#function:exportedOverLimit', 'example.ts#function:internalOverLimit']);
  });

  it('函数内动态加载两类副作用模块时必须有中文约束 JSDoc', () => {
    const functionObjectId = 'example.ts#function:loadAdapters';
    const file = parsedFile({
      kind: 'ts',
      path: 'src/ERA变量框架/example.ts',
      functions: [
        {
          objectId: functionObjectId,
          name: 'loadAdapters',
          qualifiedName: 'loadAdapters',
          kind: 'function',
          exported: false,
          async: true,
          range: [0, 100],
          bodyRange: [10, 100],
          lineStart: 1,
          lineEnd: 5,
          codeLines: 5,
          lines: 5,
          branches: 0,
          maxNestingDepth: 0,
          requiredParams: 0,
          parameterNames: [],
          astFingerprint: 'fingerprint',
        },
      ],
      imports: [
        {
          rawSpecifier: 'socket.io-client',
          sourceModule: 'socket.io-client',
          localNames: [],
          external: true,
          typeOnly: false,
          dynamic: true,
          sideEffectOnly: true,
          resource: false,
          line: 2,
          column: 10,
        },
        {
          rawSpecifier: './panel.scss',
          sourceModule: './panel.scss',
          localNames: [],
          targetPath: 'src/ERA变量框架/panel.scss',
          external: false,
          typeOnly: false,
          dynamic: true,
          sideEffectOnly: true,
          resource: true,
          line: 3,
          column: 10,
        },
      ],
    });

    expect(commentFindings([file], policy).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_CRITICAL_DOC_MISSING',
          objectId: functionObjectId,
          details: { reasons: ['跨越 2 类副作用'] },
        }),
      ]),
    );
  });

  it('校验 JSDoc 参数、空标签、TODO 上下文、陈旧引用和导出类型契约', () => {
    const functionObjectId = 'example.ts#function:execute';
    const comments: CommentFact[] = [
      {
        ...comment(
          'jsdoc',
          'script',
          [
            '/**',
            ' * 为了避免调用方破坏时序，这里必须说明参数契约。',
            ' * @param stale',
            ' * @param stale',
            ' * @returns',
            ' * @returns',
            ' */',
          ].join('\n'),
          1,
        ),
        kind: 'jsdoc',
        attachedObjectId: functionObjectId,
      },
      comment('todo', 'script', '// TODO: finish later', 8),
      comment('history', 'script', '// 新增回退处理', 9),
      comment('stale', 'script', '// 详细契约参见 missing-contract.ts', 10),
    ];
    const file = parsedFile({
      kind: 'ts',
      path: 'src/ERA变量框架/example.ts',
      comments,
      functions: [
        {
          objectId: functionObjectId,
          name: 'execute',
          qualifiedName: 'execute',
          kind: 'function',
          exported: true,
          async: false,
          range: [0, 120],
          bodyRange: [60, 120],
          lineStart: 1,
          lineEnd: 14,
          codeLines: 14,
          lines: 14,
          branches: 1,
          maxNestingDepth: 1,
          requiredParams: 1,
          parameterNames: ['value'],
          astFingerprint: 'fingerprint',
          leadingCommentId: 'jsdoc',
        },
      ],
      types: [
        {
          objectId: 'example.ts#type:Contract',
          name: 'Contract',
          kind: 'interface',
          exported: true,
          memberCount: 3,
          range: [130, 180],
          lineStart: 16,
        },
      ],
    });

    const seeds = commentFindings([file], policy).findings;
    const rules = seeds.map(finding => finding.ruleId);

    expect(() => addFingerprints(seeds)).not.toThrow();
    expect(rules.filter(rule => rule === 'COMMENT_JSDOC_PARAM_MISMATCH')).toHaveLength(1);
    expect(rules).toEqual(
      expect.arrayContaining([
        'COMMENT_JSDOC_EMPTY_TAG',
        'COMMENT_JSDOC_PARAM_MISMATCH',
        'COMMENT_TODO_CONTEXT',
        'COMMENT_DEVELOPMENT_HISTORY',
        'COMMENT_STALE_FILE_REFERENCE',
        'COMMENT_EXPORTED_TYPE_DOC',
      ]),
    );
  });

  it('报告挂在不同对象上的长篇重复说明', () => {
    const prose = '// 为了避免回滚期间破坏消息时序，这段说明描述稳定契约和失败处理边界。';
    const firstComment = {
      ...comment('first', 'script', prose, 2),
      attachedObjectId: 'first#owner',
    };
    const secondComment = {
      ...comment('second', 'script', prose, 2),
      attachedObjectId: 'second#owner',
    };
    const findings = commentFindings(
      [
        parsedFile({ path: 'src/ERA变量框架/first.ts', kind: 'ts', comments: [firstComment] }),
        parsedFile({ path: 'src/ERA变量框架/second.ts', kind: 'ts', comments: [secondComment] }),
      ],
      policy,
    ).findings.filter(finding => finding.ruleId === 'COMMENT_DUPLICATE_PROSE');

    expect(findings).toHaveLength(2);
    expect(findings.map(finding => finding.objectId).sort()).toEqual(['first#owner', 'second#owner']);
  });

  it('URL 不会掩盖同条注释中的陈旧路径，错误目录也不能靠同名文件通过', () => {
    const referenced = parsedFile({
      path: 'src/ERA变量框架/current/log.ts',
      kind: 'ts',
    });
    const source = parsedFile({
      path: 'src/ERA变量框架/example.ts',
      kind: 'ts',
      comments: [
        comment(
          'mixed-reference',
          'script',
          '// 可参考 https://example.com/guide.ts，但旧路径 old/wrong/log.ts 已不再有效。',
          2,
        ),
      ],
    });

    const stale = commentFindings([source, referenced], policy).findings.filter(
      finding => finding.ruleId === 'COMMENT_STALE_FILE_REFERENCE',
    );

    expect(stale).toMatchObject([{ observed: 'old/wrong/log.ts' }]);
  });
});

function comment(
  id: string,
  section: CommentFact['section'],
  raw: string,
  lineStart: number,
  followingCode?: string,
): CommentFact {
  const lineEnd = lineStart + raw.split('\n').length - 1;
  return {
    id,
    kind: section === 'template' ? 'html' : section === 'style' ? 'css' : 'line',
    section,
    text: raw,
    raw,
    range: [lineStart * 10, lineEnd * 10 + 8],
    lineStart,
    lineEnd,
    column: 1,
    ...(followingCode ? { followingCode } : {}),
  };
}

function parsedFile(overrides: Partial<ParsedFile>): ParsedFile {
  const path = overrides.path ?? 'src/ERA变量框架/example.vue';
  return {
    path,
    absolutePath: `${process.cwd()}/${path}`,
    moduleName: path,
    kind: 'vue',
    text: '',
    bytes: 0,
    codeLines: 0,
    lines: 20,
    scriptCodeLines: 0,
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
    internal: { ast: { body: [] }, scriptRanges: [] },
    ...overrides,
  };
}
