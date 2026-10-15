/// <reference types="node" />

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { nativeG3 } from '../tests/native-tavern/g3-fixture.mjs';
import { realService } from '../tests/native-tavern/native-fixture.mjs';

const progressUrl = new URL('../../reports/service-idle-soak.progress.jsonl', import.meta.url);
const reportUrl = new URL('../../reports/service-idle-soak.json', import.meta.url);
const durationMs = Number(process.env.ERA_SOAK_MS ?? 2 * 60 * 60 * 1_000);
const sampleIntervalMs = Number(process.env.ERA_SOAK_SAMPLE_MS ?? 60_000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

assert(Number.isSafeInteger(durationMs) && durationMs > 0, 'ERA_SOAK_MS 必须是正整数。');
assert(Number.isSafeInteger(sampleIntervalMs) && sampleIntervalMs > 0, 'ERA_SOAK_SAMPLE_MS 必须是正整数。');
await mkdir(new URL('.', reportUrl), { recursive: true });
await writeFile(progressUrl, '', 'utf8');

const workflow = { runWorkflowAsync: realService };
const counters = { subscriptions: 0, unsubscriptions: 0 };
const native = await nativeG3(workflow);
const owner = native.owner;
const initialResources = native.snapshot();
counters.subscriptions = initialResources.registrations;
for (const [name, fn] of Object.entries(owner.api)) {
  if (typeof fn !== 'function' || !/^(get|set|replace|update|event|refresh|fetch|create)/.test(name)) continue;
  owner.api[name] = (...args) => {
    const key = name === 'eventRemoveListener' ? 'listenerRemovals' : name;
    counters[key] = (counters[key] ?? 0) + 1;
    return fn(...args);
  };
}
const execution = owner.work;
const startedAt = Date.now();
const startedHeap = process.memoryUsage().heapUsed;
const samples = [];

while (Date.now() - startedAt < durationMs) {
  const remaining = durationMs - (Date.now() - startedAt);
  await delay(Math.min(sampleIntervalMs, remaining));
  globalThis.gc?.();
  const sample = {
    time: new Date().toISOString(),
    stage: 'idle-soak',
    elapsedMs: Date.now() - startedAt,
    durationMs,
    progress: Math.min(1, (Date.now() - startedAt) / durationMs),
    heapUsed: process.memoryUsage().heapUsed,
    counters: { ...counters },
  };
  samples.push(sample);
  await appendFile(progressUrl, `${JSON.stringify(sample)}\n`, 'utf8');
}

const idleCounters = { ...counters };
const stopStartedAt = performance.now();
native.owner.page.dispatchEvent(new Event('pagehide'));
let executionCode = null;
try {
  await execution;
} catch (error) {
  executionCode = error && typeof error === 'object' && 'code' in error ? error.code : 'UNCLASSIFIED_ERROR';
}
const stopMs = performance.now() - stopStartedAt;
const finalResources = native.snapshot();
counters.unsubscriptions = finalResources.removals;
globalThis.gc?.();
const finishedHeap = process.memoryUsage().heapUsed;

const unexpectedActivity = Object.entries(idleCounters).filter(
  ([name, value]) => !['subscriptions', 'unsubscriptions'].includes(name) && value !== 0,
);
const passed =
  Date.now() - startedAt >= durationMs &&
  counters.subscriptions === 1 &&
  counters.unsubscriptions === 1 &&
  initialResources.listenerCount > 0 &&
  finalResources.listenerCount === 0 &&
  counters.listenerRemovals === initialResources.listenerCount &&
  unexpectedActivity.length === 0 &&
  stopMs <= 1_000 &&
  executionCode === null;
const report = {
  status: passed ? 'PASS' : 'FAIL',
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  requestedDurationMs: durationMs,
  sampleIntervalMs,
  samples: samples.length,
  startedHeap,
  finishedHeap,
  retainedHeapBytes: finishedHeap - startedHeap,
  counters,
  idleCounters,
  initialResources,
  finalResources,
  unexpectedActivity,
  stopMs,
  executionCode,
};
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!passed) process.exitCode = 1;
