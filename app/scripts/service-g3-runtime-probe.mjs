/// <reference types="node" />

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const generatedModuleUrl = new URL('../../generated/era-service/workflow.js', import.meta.url);
const reportUrl = new URL('../../reports/service-g3-runtime.json', import.meta.url);

/**
 * 生成的 Service workflow 位于仓库根目录，而它的 browser runtime 依赖属于
 * app 包。为让 Node 探针按与 webpack 相同的 package root 解析这些依赖，临时
 * 复制完全相同的生成物到 app 下再导入；绝不改写或重新打包 workflow 内容。
 */
async function importGeneratedWorkflow() {
  const directory = await mkdtemp(resolve(import.meta.dirname, '.era-generated-workflow-'));
  const stagedPath = resolve(directory, 'workflow.mjs');
  await writeFile(stagedPath, await readFile(generatedModuleUrl), 'utf8');
  return {
    workflow: await import(pathToFileURL(stagedPath).href),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createAdapter() {
  let listener = null;
  let registrations = 0;
  let removals = 0;
  const notifications = [];
  const warnings = [];
  let chatVariables = { stat_data: {}, ERAMetaData: { SelectedMks: [], EditLogs: {} } };
  let scriptVariables = {};
  const sidecarRecords = new Map();
  const sidecarCurrent = {
    identity: { characterId: 'probe-card', groupId: null, chatId: 'probe-chat' },
    meta: {},
    stat: {},
  };
  const messages = [{ message_id: 0, role: 'assistant', is_user: false, message: '运行时探针消息' }];
  return {
    adapter: {
      subscribe(nextListener) {
        assert(listener === null, 'Host 重复注册了事件监听器。');
        listener = nextListener;
        registrations += 1;
        return () => {
          if (listener === null) return;
          listener = null;
          removals += 1;
        };
      },
      notify(notification) {
        notifications.push(notification);
      },
      variables: {
        read(input) {
          return { variables: structuredClone(input.scope?.type === 'script' ? scriptVariables : chatVariables) };
        },
        commit(input) {
          if (input.scope?.type === 'script') {
            scriptVariables = structuredClone(input.variables ?? scriptVariables);
            return { status: 'committed', variables: structuredClone(scriptVariables) };
          }
          chatVariables = {
            ...chatVariables,
            ...(Object.hasOwn(input, 'stat') ? { stat_data: structuredClone(input.stat) } : {}),
            ...(Object.hasOwn(input, 'meta') ? { ERAMetaData: structuredClone(input.meta) } : {}),
          };
          return { status: 'committed', variables: structuredClone(chatVariables) };
        },
      },
      messages: {
        read_context: async input => {
          assert(input.projection === 'era-active-message-v1', '消息读取必须请求严格 ERA 投影。');
          return {
            schemaVersion: 2,
            messages: messages.map(message => ({
              schemaVersion: 1,
              messageId: message.message_id,
              role: message.role,
              activeText: message.message,
              swipeIndex: null,
            })),
          };
        },
        update_content: async input => {
          const update = Array.isArray(input.updates) ? input.updates[0] : input;
          const message = messages.find(item => item.message_id === (update.message_id ?? update.messageId));
          if (!message) return { status: 'not-written', written: false };
          if (typeof update.message === 'string') message.message = update.message;
          else if (typeof update.content === 'string') message.message = update.content;
          if (Array.isArray(update.swipes)) message.swipes = structuredClone(update.swipes);
          return { status: 'committed' };
        },
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
      identity: { read: () => ({ characterName: '运行时探针角色', isGroup: false }) },
      installation_scope: {
        read: () => ({ scriptId: 'era-probe', scopes: ['character'], readStatus: 'complete' }),
      },
      sidecar: {
        read_current: async () => structuredClone(sidecarCurrent),
        read_record: async input => {
          const record = sidecarRecords.get(input.sidecarId);
          return record === undefined ? { status: 'missing' } : { status: 'found', record };
        },
        write_record: async input => {
          sidecarRecords.set(input.sidecarId, structuredClone(input.record));
          return { status: 'committed' };
        },
        commit_metadata: async input => {
          sidecarCurrent.meta = { SidecarId: input.sidecarId };
          sidecarCurrent.stat = null;
          return { status: 'committed' };
        },
        create_id: () => ({ sidecarId: 'era_chat_probe-12345678' }),
        present_prompt: () => ({ status: 'presented' }),
        clear_prompt: () => ({ status: 'cleared' }),
      },
      warn(message, details) {
        warnings.push({ message, details });
      },
    },
    emit(event) {
      assert(listener !== null, 'Host 尚未注册事件监听器。');
      return listener(event);
    },
    snapshot() {
      return { registrations, removals, notifications: notifications.length, warnings: warnings.length };
    },
  };
}

async function probeGeneratedHost(workflow) {
  const fake = createAdapter();
  globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__ = fake.adapter;
  const beforeCreate = fake.snapshot();
  const host = workflow.createWorkflowHost();
  const afterCreate = fake.snapshot();
  await host.start();
  const afterStart = fake.snapshot();
  const traceEvents = [];
  const execution = host.runWorkflowAsync({}, { trace: 'full', onTrace: event => traceEvents.push(event) });
  const workflowStopped = execution.then(
    () => ({ kind: 'stopped', error: null }),
    error => ({ kind: 'stopped', error }),
  );
  // staged_startup 的唯一订阅由 workflow allow 分支完成，而不是 host.start。
  for (let index = 0; index < 20 && fake.snapshot().registrations === 0; index += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const afterActivation = fake.snapshot();
  if (afterActivation.registrations === 0) {
    const stopped = await Promise.race([
      workflowStopped,
      new Promise(resolve => setTimeout(() => resolve({ kind: 'pending' }), 10)),
    ]);
    throw new Error(
      `workflow allow 未登记 Tavern 监听器：${JSON.stringify(stopped)}，trace=${JSON.stringify(traceEvents.slice(-30))}`,
    );
  }

  const outcomes = [];
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    const type =
      sequence === 1
        ? 'message_received'
        : sequence === 2
          ? 'era:getCurrentVars'
          : sequence === 3
            ? 'era:insertByObject'
            : 'era:forceSync';
    const admission = fake.emit({
      type,
      source: sequence === 1 ? 'tavern' : 'era-api',
      args:
        sequence === 3
          ? [{ __eraRuntimeProbe: { value: sequence } }]
          : sequence === 4
            ? [{ mode: 'latest' }]
            : [{ sequence }],
      occurredAt: 1_000 + sequence,
    });
    assert(admission.accepted === true, `第 ${sequence} 个事件未被接纳。`);
    const observed = await Promise.race([
      admission.done.then(outcome => ({ kind: 'outcome', outcome })),
      workflowStopped,
    ]);
    if (observed.kind === 'stopped') {
      const error = observed.error instanceof Error ? observed.error : new Error(String(observed.error));
      error.message += `\n最后 trace：${JSON.stringify(traceEvents.slice(-30))}`;
      throw error;
    }
    outcomes.push(observed.outcome);
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
  const afterStop = fake.snapshot();
  delete globalThis.__ERA_VIBEFLOW_SERVICE_ADAPTER__;

  assert(beforeCreate.registrations === 0, '导入前不应注册监听器。');
  assert(afterCreate.registrations === 0, 'createWorkflowHost() 不应注册监听器。');
  assert(afterStart.registrations === 0, 'staged host.start() 不得提前注册 Tavern 监听器。');
  assert(afterActivation.registrations === 1, 'workflow allow 分支必须只注册一套监听器。');
  assert(afterStop.removals === 1, 'host.stop() 必须只注销一次监听器。');
  assert(
    outcomes.every(outcome => outcome.status === 'completed'),
    '真实同步与查询事件必须完整结算。',
  );
  assert(afterStop.notifications >= 5, '写入 API 和 forceSync 必须在真实 Host 路径中发出兼容通知。');
  assert(executionCode === 'VF_ABORTED', `永久 workflow 停止码异常：${String(executionCode)}`);
  assert(stopMs <= 1_000, `Host 停止耗时 ${stopMs}ms，超过 1 秒。`);

  return { beforeCreate, afterCreate, afterStart, afterActivation, afterStop, outcomes, executionCode, stopMs };
}

async function probeWorkflowFrames(workflow) {
  const controller = new AbortController();
  const directAdapter = createAdapter().adapter;
  const events = [
    {
      schemaVersion: 1,
      eventId: 'probe:event:1',
      sequence: 1,
      type: 'era:getCurrentVars',
      occurredAt: 1_001,
      source: 'era-api',
      args: [],
      encodedBytes: 128,
    },
    {
      schemaVersion: 1,
      eventId: 'probe:event:2',
      sequence: 2,
      type: 'era:getCurrentVars',
      occurredAt: 1_002,
      source: 'era-api',
      args: [],
      encodedBytes: 128,
    },
  ];
  const frames = [];
  const watchdog = setTimeout(() => controller.abort(new Error('运行时帧探针超时')), 2_000);
  let receiveIndex = 0;
  const receive = (_input, context) => {
    const event = events[receiveIndex];
    if (event) {
      receiveIndex += 1;
      return Promise.resolve({ value: event });
    }
    return new Promise((_resolve, reject) => {
      const signal = context.signal ?? controller.signal;
      const onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  };
  const send = input => {
    frames.push(input.value);
    if (frames.filter(frame => frame.kind === 'batch-result').length === 2) {
      controller.abort(new Error('运行时帧探针完成'));
    }
    return null;
  };

  let executionCode = null;
  try {
    await workflow.runWorkflowAsync(
      {},
      {
        signal: controller.signal,
        capabilities: {
          'vibeflow.port': { receive, send },
          'era.tavern.variables': directAdapter.variables,
          'era.tavern.messages': directAdapter.messages,
          'era.tavern.worldbook': directAdapter.worldbook,
          'era.tavern.regex': directAdapter.regex,
          'era.tavern.identity': directAdapter.identity,
          'era.tavern.installation_scope': directAdapter.installation_scope,
          'era.tavern.startup_gate': { activate: () => ({ activated: true }), dormant: () => ({ activated: false }) },
          'era.tavern.sidecar': directAdapter.sidecar,
        },
      },
    );
  } catch (error) {
    executionCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
  } finally {
    clearTimeout(watchdog);
  }

  const kinds = frames.map(frame => frame.kind);
  const frameIds = frames.map(frame => frame.frameId);
  const results = frames.filter(frame => frame.kind === 'batch-result');
  assert(
    JSON.stringify(kinds) ===
      JSON.stringify(['collection-control', 'batch-result', 'collection-control', 'batch-result']),
    `帧顺序异常：${JSON.stringify(kinds)}，执行码：${String(executionCode)}`,
  );
  assert(new Set(frameIds).size === frameIds.length, 'frameId 必须全部唯一。');
  assert(
    JSON.stringify(results.map(frame => frame.throughSequence)) === JSON.stringify([1, 2]),
    'throughSequence 顺序异常。',
  );
  assert(
    JSON.stringify(results.flatMap(frame => frame.settlements.map(item => item.sequence))) === JSON.stringify([1, 2]),
    '每个来源必须恰好结算一次。',
  );
  assert(executionCode === 'VF_ABORTED', `fake Port 取消码异常：${String(executionCode)}`);
  return { kinds, frameIds, throughSequences: [1, 2], settlementSequences: [1, 2], executionCode };
}

const stagedWorkflow = await importGeneratedWorkflow();
const workflow = stagedWorkflow.workflow;
assert(workflow.VIBEFLOW_WORKFLOW_ABI === 'vibeflow.workflow.v4', 'Workflow ABI 不是 v4。');
assert(workflow.VIBEFLOW_PLUGIN_ABI === 'vibeflow.plugin.v1', 'Plugin ABI 不是 v1。');

const report = {
  status: 'PASS',
  generatedModule: generatedModuleUrl.pathname,
  abi: workflow.VIBEFLOW_WORKFLOW_ABI,
  pluginAbi: workflow.VIBEFLOW_PLUGIN_ABI,
  host: await probeGeneratedHost(workflow),
  workflow: await probeWorkflowFrames(workflow),
};

await mkdir(new URL('.', reportUrl), { recursive: true });
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await stagedWorkflow.cleanup();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
