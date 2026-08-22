/// <reference types="node" />

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const generatedModuleUrl = new URL('../../generated/era-service/workflow.js', import.meta.url);
const progressUrl = new URL('../../reports/service-idle-soak.progress.jsonl', import.meta.url);
const reportUrl = new URL('../../reports/service-idle-soak.json', import.meta.url);
const durationMs = Number(process.env.ERA_SOAK_MS ?? 2 * 60 * 60 * 1_000);
const sampleIntervalMs = Number(process.env.ERA_SOAK_SAMPLE_MS ?? 60_000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createAdapter(counters) {
  let listener = null;
  const count = name => {
    counters[name] = (counters[name] ?? 0) + 1;
  };
  const operation = name => async () => {
    count(name);
    return {};
  };
  return {
    subscribe(nextListener) {
      assert(listener === null, '长稳探针检测到重复 Host 监听器。');
      listener = nextListener;
      count('subscriptions');
      return () => {
        if (listener !== null) count('unsubscriptions');
        listener = null;
      };
    },
    notify: operation('notifications'),
    variables: { read: operation('variableReads'), commit: operation('variableCommits') },
    messages: {
      read_context: operation('messageReads'),
      update_content: operation('messageWrites'),
      refresh: operation('messageRefreshes'),
    },
    worldbook: {
      read: operation('worldbookReads'),
      create: operation('worldbookCreates'),
      bind: operation('worldbookBinds'),
      replace_entries: operation('worldbookWrites'),
    },
    regex: { read: operation('regexReads'), upsert: operation('regexWrites') },
    identity: {
      read() {
        count('identityReads');
        return { characterName: '长稳探针角色', isGroup: false };
      },
    },
    installation_scope: { read: () => ({ scriptId: 'era-idle-soak', scopes: ['character'], readStatus: 'complete' }) },
    sidecar: {
      read_current: async () => {
        count('sidecarReads');
        return { identity: null, meta: null, stat: null };
      },
      read_record: operation('sidecarRecordReads'),
      write_record: operation('sidecarRecordWrites'),
      commit_metadata: operation('sidecarMetadataCommits'),
      create_id: () => ({ sidecarId: 'era_chat_idle-soak-12345678' }),
      present_prompt: operation('sidecarPrompts'),
      clear_prompt: operation('sidecarPromptClears'),
    },
    warn() {
      count('warnings');
    },
  };
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

assert(Number.isSafeInteger(durationMs) && durationMs > 0, 'ERA_SOAK_MS 必须是正整数。');
assert(Number.isSafeInteger(sampleIntervalMs) && sampleIntervalMs > 0, 'ERA_SOAK_SAMPLE_MS 必须是正整数。');
await mkdir(new URL('.', reportUrl), { recursive: true });
await writeFile(progressUrl, '', 'utf8');

const workflow = await import(generatedModuleUrl.href);
const counters = {};
const adapter = createAdapter(counters);
globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__ = adapter;
const host = workflow.createWorkflowHost();
await host.start();
const execution = host.runWorkflowAsync({});
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

const stopStartedAt = performance.now();
await host.stop();
const stopMs = performance.now() - stopStartedAt;
let executionCode = null;
try {
  await execution;
} catch (error) {
  executionCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
}
globalThis.gc?.();
const finishedHeap = process.memoryUsage().heapUsed;
delete globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__;

const unexpectedActivity = Object.entries(counters).filter(
  ([name, value]) => !['subscriptions', 'unsubscriptions'].includes(name) && value !== 0,
);
const passed =
  Date.now() - startedAt >= durationMs &&
  counters.subscriptions === 1 &&
  counters.unsubscriptions === 1 &&
  unexpectedActivity.length === 0 &&
  stopMs <= 1_000 &&
  executionCode === 'VF_ABORTED';
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
  unexpectedActivity,
  stopMs,
  executionCode,
};
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!passed) process.exitCode = 1;
