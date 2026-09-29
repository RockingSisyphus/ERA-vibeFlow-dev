
import { writeFile } from 'node:fs/promises';

import { performance } from 'node:perf_hooks';

import _ from 'lodash';

import { runWorkflow } from '../../generated/era-macro/era-macro.js';

const ESCAPES = new Map([
  ['__DOT__', '.'],
  ['__DQUOTE__', '"'],
  ['__SQUOTE__', "'"],
]);

function unescapeText(value) {
  return value.replace(/__DOT__|__DQUOTE__|__SQUOTE__/g, placeholder => ESCAPES.get(placeholder));
}

function unescapeEraData(value) {
  if (Array.isArray(value)) return value.map(unescapeEraData);
  if (_.isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [unescapeText(key), unescapeEraData(child)]));
  }
  return typeof value === 'string' ? unescapeText(value) : value;
}

function removeMetaFields(value) {
  if (Array.isArray(value)) return value.map(removeMetaFields);
  if (_.isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('$'))
        .map(([key, child]) => [key, removeMetaFields(child)]),
    );
  }
  return value;
}

function runBaseline(substring, storedStat) {
  const statWithMeta = unescapeEraData(storedStat);
  const statWithoutMeta = removeMetaFields(statWithMeta);
  return substring.replace(/{{\s*ERA(-withmeta)?\s*:\s*([^}]+?)\s*}}/gi, (matched, withMeta, rawPath) => {
    const source = withMeta ? statWithMeta : statWithoutMeta;
    if (source === null || source === undefined) return matched;
    const path = rawPath.trim();
    const value = path === '$ALLDATA' ? source : _.get(source, path);
    if (value === undefined) return '';
    if (typeof value === 'object' && value !== null) return JSON.stringify(value) ?? '';
    return String(value);
  });
}

function percentile95(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function measure(run, samples) {
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const result = run();
    const elapsed = performance.now() - startedAt;
    if (result !== '成功') throw new Error(`宏性能样本产生了错误结果：${result}`);
    durations.push(elapsed);
  }
  return durations;
}

const storedStat = {
  target: { value: '成功', $meta: { source: 'performance' } },
  payload: {},
};
let index = 0;
while (Buffer.byteLength(JSON.stringify(storedStat), 'utf8') < 100 * 1024) {
  storedStat.payload[`key_${index}`] = `value_${index}_${'x'.repeat(48)}`;
  index += 1;
}

const substring = '{{ERA:target.value}}';
const aotInput = { substring, storedStat: { kind: 'present', value: storedStat } };
const warmupRuns = 30;
const measuredRuns = 120;

for (let warmup = 0; warmup < warmupRuns; warmup += 1) {
  runBaseline(substring, storedStat);
  if (runWorkflow(aotInput).replacement !== '成功') {
    throw new Error('Macro AOT 预热产生了错误结果');
  }
}

const baselineSamples = measure(() => runBaseline(substring, storedStat), measuredRuns);
const aotSamples = measure(() => runWorkflow(aotInput).replacement, measuredRuns);
const baselineP95Ms = percentile95(baselineSamples);
const aotP95Ms = percentile95(aotSamples);
const relativeLimitMs = Math.max(baselineP95Ms * 1.2, baselineP95Ms + 1);
const absoluteLimitMs = 10;
const passed = aotP95Ms <= relativeLimitMs && aotP95Ms <= absoluteLimitMs;

const report = {
  status: passed ? 'PASS' : 'FAIL',
  baselineCommit: '11f9c7d9c7881afa264ed27953a69120c0a7d21e',
  statBytes: Buffer.byteLength(JSON.stringify(storedStat), 'utf8'),
  warmupRuns,
  measuredRuns,
  baselineP95Ms,
  aotP95Ms,
  relativeLimitMs,
  absoluteLimitMs,
};

await writeFile(
  new URL('../../reports/macro-performance.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!passed) process.exitCode = 1;
