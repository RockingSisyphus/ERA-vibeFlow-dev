/// <reference types="node" />

// eslint-disable-next-line import-x/no-nodejs-modules
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { runEraMacroWorkflow, type MacroStoredStatInput } from '../../src/ERA变量框架/macro/vibeflow-adapter';
import { parseEraMacroText, type EraMacroSnapshot } from '../../src/ERA变量框架/macro/syntax';

type OracleCase = {
  name: string;
  substring: string;
  storedStat: MacroStoredStatInput;
  expected: string;
};

type OracleCorpus = {
  baselineCommit: string;
  cases: OracleCase[];
};

const corpus = JSON.parse(readFileSync(new URL('./oracle-corpus.json', import.meta.url), 'utf8')) as OracleCorpus;

function unescapeText(value: string): string {
  return value.replace(/__DOT__|__DQUOTE__|__SQUOTE__/g, placeholder => {
    if (placeholder === '__DOT__') return '.';
    if (placeholder === '__DQUOTE__') return '"';
    return "'";
  });
}

function prepareBaselineValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(prepareBaselineValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [unescapeText(key), prepareBaselineValue(child)]),
    );
  }
  return typeof value === 'string' ? unescapeText(value) : value;
}

function removeMetaFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeMetaFields);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('$'))
        .map(([key, child]) => [key, removeMetaFields(child)]),
    );
  }
  return value;
}

function baselineSnapshot(storedStat: MacroStoredStatInput): EraMacroSnapshot {
  if (storedStat.kind === 'missing') {
    return { statWithMeta: null, statWithoutMeta: undefined };
  }
  const statWithMeta = prepareBaselineValue(storedStat.value);
  return { statWithMeta, statWithoutMeta: removeMetaFields(statWithMeta) };
}

describe(`Macro AOT 对冻结基线 ${corpus.baselineCommit} 的差分`, () => {
  for (const testCase of corpus.cases) {
    it(testCase.name, () => {
      const originalInput = structuredClone(testCase.storedStat);
      const legacy = parseEraMacroText(testCase.substring, baselineSnapshot(testCase.storedStat));
      const replacement = runEraMacroWorkflow(testCase.substring, testCase.storedStat);

      expect(legacy).toBe(testCase.expected);
      expect(replacement).toBe(testCase.expected);
      expect(replacement).toBe(legacy);
      expect(testCase.storedStat).toEqual(originalInput);
    });
  }

  it('连续与交错调用不共享正则状态且同步返回字符串', () => {
    const first = corpus.cases[1];
    const second = corpus.cases[16];

    for (let index = 0; index < 100; index += 1) {
      const firstResult = runEraMacroWorkflow(first.substring, first.storedStat);
      const secondResult = runEraMacroWorkflow(second.substring, second.storedStat);
      expect(firstResult).toBe(first.expected);
      expect(secondResult).toBe(second.expected);
      expect(typeof firstResult).toBe('string');
      expect(firstResult).not.toBeInstanceOf(Promise);
    }
  });
});
