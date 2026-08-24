/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const generatedModuleUrl = new URL('../../generated/era-service/workflow.js', import.meta.url);
const reportUrl = new URL('../../reports/service-performance.json', import.meta.url);
const warmupEvents = Number(process.env.ERA_PERF_WARMUP_EVENTS ?? 10_000);
const measuredEvents = Number(process.env.ERA_PERF_MEASURED_EVENTS ?? 50_000);
const batchSize = Number(process.env.ERA_PERF_BATCH_SIZE ?? 128);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function percentile95(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

function createAdapter() {
  let listener = null;
  let chatVariables = { stat_data: {}, ERAMetaData: { SelectedMks: [], EditLogs: {} } };
  return {
    subscribe(nextListener) {
      assert(listener === null, '性能探针检测到重复 Host 监听器。');
      listener = nextListener;
      return () => {
        listener = null;
      };
    },
    emit(event) {
      assert(listener !== null, '性能探针发出事件时 Host 尚未启动。');
      return listener(event);
    },
    notify() {},
    variables: {
      read() {
        return { variables: structuredClone(chatVariables) };
      },
      commit(input) {
        chatVariables = {
          ...chatVariables,
          ...(Object.hasOwn(input, 'stat') ? { stat_data: structuredClone(input.stat) } : {}),
          ...(Object.hasOwn(input, 'meta') ? { ERAMetaData: structuredClone(input.meta) } : {}),
        };
        return { status: 'committed', variables: structuredClone(chatVariables) };
      },
    },
    messages: {
      read_context: async () => ({ messages: [] }),
      update_content: async () => ({ status: 'committed' }),
      refresh: async () => ({ status: 'completed' }),
    },
    worldbook: {
      read: async () => ({ names: [], bindings: { primary: null, additional: [] }, entries: [] }),
      create: async () => ({ status: 'created' }),
      bind: async () => ({ status: 'bound' }),
      replace_entries: async () => ({ status: 'committed' }),
    },
    regex: {
      read: async () => ({ enabled: false, regexes: [] }),
      upsert: async () => ({ status: 'committed' }),
    },
    identity: { read: () => ({ characterName: '性能探针角色', isGroup: false }) },
    installation_scope: { read: () => ({ scriptId: 'era-performance', scopes: ['character'], readStatus: 'complete' }) },
    sidecar: {
      read_current: async () => ({ identity: null, meta: null, stat: null }),
      read_record: async () => ({ status: 'missing' }),
      write_record: async () => ({ status: 'committed' }),
      commit_metadata: async () => ({ status: 'committed' }),
      create_id: () => ({ sidecarId: 'era_chat_performance-12345678' }),
      present_prompt: () => ({ status: 'presented' }),
      clear_prompt: () => ({ status: 'cleared' }),
    },
    warn() {},
  };
}

async function runEvents(adapter, count, collectDurations, heapCheckpoints) {
  const batchDurations = [];
  let nextHeapCheckpoint = 10_000;
  for (let offset = 0; offset < count; offset += batchSize) {
    const currentBatch = Math.min(batchSize, count - offset);
    const startedAt = performance.now();
    const receipts = [];
    for (let index = 0; index < currentBatch; index += 1) {
      const admission = adapter.emit({
        type: 'era.facade.sync',
        source: 'era-api',
        args: [],
        occurredAt: offset + index,
      });
      assert(admission.accepted, `第 ${offset + index + 1} 个性能事件未被接纳：${admission.code ?? ''}`);
      receipts.push(admission.done);
    }
    const outcomes = await Promise.all(receipts);
    assert(
      outcomes.every(outcome => outcome.status === 'completed'),
      '性能事件存在非 completed 结算。',
    );
    if (collectDurations) batchDurations.push((performance.now() - startedAt) / currentBatch);

    const completed = offset + currentBatch;
    if (heapCheckpoints && completed >= nextHeapCheckpoint) {
      globalThis.gc?.();
      heapCheckpoints.push({ completed, heapUsed: process.memoryUsage().heapUsed });
      nextHeapCheckpoint += 10_000;
    }
  }
  return batchDurations;
}

assert(Number.isSafeInteger(warmupEvents) && warmupEvents >= 0, 'ERA_PERF_WARMUP_EVENTS 必须是非负整数。');
assert(Number.isSafeInteger(measuredEvents) && measuredEvents > 0, 'ERA_PERF_MEASURED_EVENTS 必须是正整数。');
assert(Number.isSafeInteger(batchSize) && batchSize > 0 && batchSize <= 128, 'ERA_PERF_BATCH_SIZE 必须在 1..128。');
assert(typeof globalThis.gc === 'function', '服务性能门禁必须使用 node --expose-gc 运行。');

const workflow = await import(generatedModuleUrl.href);
const adapter = createAdapter();
globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__ = adapter;
const host = workflow.createWorkflowHost();
await host.start();
const execution = host.runWorkflowAsync({});

await runEvents(adapter, warmupEvents, false, null);
globalThis.gc();
const heapBaseline = process.memoryUsage().heapUsed;
const heapCheckpoints = [];
const measuredStartedAt = performance.now();
const perEventDurations = await runEvents(adapter, measuredEvents, true, heapCheckpoints);
const measuredDurationMs = performance.now() - measuredStartedAt;
globalThis.gc();
const heapFinal = process.memoryUsage().heapUsed;
const stopStartedAt = performance.now();
await host.stop();
const stopMs = performance.now() - stopStartedAt;
let executionCode = null;
try {
  await execution;
} catch (error) {
  executionCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
}
delete globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__;

const retainedHeapBytes = heapFinal - heapBaseline;
const passed = retainedHeapBytes <= 10 * 1024 * 1024 && stopMs <= 1_000 && executionCode === 'VF_ABORTED';
const report = {
  status: passed ? 'PASS' : 'FAIL',
  warmupEvents,
  measuredEvents,
  batchSize,
  measuredDurationMs,
  eventsPerSecond: measuredEvents / (measuredDurationMs / 1_000),
  perEventP95Ms: percentile95(perEventDurations),
  heapBaseline,
  heapFinal,
  retainedHeapBytes,
  retainedHeapLimitBytes: 10 * 1024 * 1024,
  heapCheckpoints,
  resourceCleanupGate: 'app/tests/service/host-core.test.ts',
  stopMs,
  executionCode,
};

await mkdir(new URL('.', reportUrl), { recursive: true });
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!passed) process.exitCode = 1;
