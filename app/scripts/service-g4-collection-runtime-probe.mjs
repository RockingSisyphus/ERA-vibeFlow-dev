/// <reference types="node" />

import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(import.meta.dirname, '../..');
const buildRoot = process.env.ERA_SERVICE_BUILD_DIR ?? resolve(projectRoot, 'generated/era-service');
const generatedModuleUrl = pathToFileURL(resolve(buildRoot, 'workflow.js'));
const manifestPath = resolve(buildRoot, 'vibeflow-build.json');
const reportPath = resolve(projectRoot, 'reports/service-g4-collection-runtime.json');

/** 与 G3 探针一致：保持生成物字节不变，但从 app 包解析运行时依赖。 */
async function importGeneratedWorkflow() {
  const directory = await mkdtemp(resolve(import.meta.dirname, '.era-generated-workflow-'));
  process.once('exit', () => rmSync(directory, { recursive: true, force: true }));
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

function json(value) {
  return { kind: 'json', value };
}

function event(sequence, type, occurredAt, options = {}) {
  return {
    schemaVersion: 1,
    eventId: `g4:event:${sequence}`,
    sequence,
    type,
    occurredAt,
    source: options.source ?? (type.startsWith('era.') ? 'era-api' : 'tavern'),
    args: options.args ?? [],
    encodedBytes: options.encodedBytes ?? 64,
  };
}

function timer(sequence, dueAt, token) {
  return event(sequence, 'era.service.collection_timer', dueAt, {
    source: 'timer',
    args: [json(token)],
  });
}

function createTavernCapabilities() {
  let chatVariables = { stat_data: {}, ERAMetaData: { SelectedMks: [], EditLogs: {} } };
  let working = null;
  let mainGreeting = 'G4 窗口探针消息';
  const messages = [{ message_id: 0, role: 'assistant', is_user: false, message: mainGreeting }];
  return {
    'era.tavern.variables': {
      read: () => ({ variables: structuredClone(chatVariables) }),
      commit: input => {
        chatVariables = {
          ...chatVariables,
          ...(Object.hasOwn(input, 'stat') ? { stat_data: structuredClone(input.stat) } : {}),
          ...(Object.hasOwn(input, 'meta') ? { ERAMetaData: structuredClone(input.meta) } : {}),
        };
        return { status: 'committed', variables: structuredClone(chatVariables) };
      },
    },
    'era.tavern.messages': {
      read_context: async () => ({ messages: structuredClone(messages) }),
      update_content: async input => {
        const update = Array.isArray(input.updates) ? input.updates[0] : input;
        const target = messages.find(item => item.message_id === (update.message_id ?? update.messageId));
        if (!target) return { status: 'not-written', written: false };
        if (typeof update.message === 'string') target.message = update.message;
        else if (typeof update.content === 'string') target.message = update.content;
        if (Array.isArray(update.swipes)) target.swipes = structuredClone(update.swipes);
        return { status: 'committed' };
      },
      refresh: async () => ({ status: 'completed' }),
    },
    'era.tavern.worldbook': {
      read: async () => ({ names: [], bindings: { primary: null, additional: [] }, entries: [] }),
      create: async () => ({ status: 'created' }),
      bind: async () => ({ status: 'bound' }),
      replace_entries: async () => ({ status: 'committed' }),
    },
    'era.tavern.regex': {
      read: async () => ({ enabled: false, regexes: [] }),
      upsert: async () => ({ status: 'committed' }),
    },
    'era.tavern.character': {
      patch_external_statusbar: async () => { throw new Error('G4 窗口探针不应执行外置配置写入'); },
      patch_single_floor: async () => { throw new Error('G4 窗口探针不应执行单层配置写入'); },
      read_greeting_refresh_context: () => ({ group: false, tainted: false, length: 2, first: null }),
      apply_greeting_refresh: async () => ({ status: "refreshed", reason: "fixture" }),
      read_main_greeting: async input => ({
        ...input,
        status: 'ready',
        characterId: 'g4-card',
        firstMessage: mainGreeting,
      }),
      write_main_greeting: async input => {
        if (typeof input.next === 'string') {
          mainGreeting = input.next;
        }
        return { ...input, status: 'updated' };
      },
    },
    'era.tavern.identity': {
      read: () => ({
        characterName: 'G4 窗口探针角色',
        isGroup: false,
        characterId: 'g4-card',
        groupId: null,
        chatId: 'g4-chat',
        scriptId: 'era-g4',
        lifecycleToken: 1,
      }),
    },
    'era.tavern.installation_scope': {
      read: () => ({ scriptId: 'era-g4', scopes: ['character'], readStatus: 'complete' }),
    },
    'era.tavern.agent': {
      read_context: async () => ({ status: 'ready', context: null }),
      write_configuration: async () => ({ status: 'committed' }),
      capture_preset: () => ({ status: 'captured', preset: null }),
      read_connection_state: () => ({ entryCount: 0, entryExists: false, profile: null }),
      read_configuration_sources: () => ({ presetNames: [], currentPresetName: null, connectionProfiles: [] }),
      upsert_connection_profile: async () => ({ status: 'created' }),
      delete_connection_profile: async () => ({ status: 'deleted' }),
      clear_connection_profile_key: async () => ({ status: 'cleared' }),
      list_connection_models: async () => ({ models: [] }),
      list_connection_models_draft: async () => ({ models: [] }),
      generate: async () => ({ status: 'completed', text: '{}' }),
      generate_story: async () => ({ status: 'completed', text: '' }),
      await_native_completion: async () => ({ status: 'completed', messageId: 0 }),
      inject_once: () => ({ status: 'injected' }),
      read_session_binding: () => ({ active: false, previous: null }),
      write_session: () => ({ status: 'committed' }),
      clear_session: () => ({ status: 'cleared' }),
      write_message: async () => ({ status: 'committed' }),
      create_error_message: async () => ({ status: 'committed' }),
      stop_native_generation: () => ({ status: 'stopped' }),
    },
    'era.tavern.startup_gate': { activate: () => ({ activated: true }), dormant: () => ({ activated: false }) },
    'era.tavern.sidecar': (() => {
      const records = new Map();
      const current = { identity: { characterId: 'g4-card', groupId: null, chatId: 'g4-chat' }, meta: {}, stat: {} };
      return {
        read_working: () => ({ working: structuredClone(working) }),
        write_working: input => {
          if (input.expectedVersion !== undefined && input.expectedVersion !== (working?.version ?? 0)) {
            throw new Error('ERA_WORKING_STATE_CHANGED');
          }
          working = { ...structuredClone(input), version: (working?.version ?? 0) + 1 };
          return { working: structuredClone(working) };
        },
        read_current: async () => structuredClone(current),
        read_record: async input => {
          const record = records.get(input.sidecarId);
          return record === undefined ? { status: 'missing' } : { status: 'found', record };
        },
        write_record: async input => {
          records.set(input.sidecarId, structuredClone(input.record));
          return { status: 'committed' };
        },
        commit_metadata: async input => {
          current.meta = { SidecarId: input.sidecarId };
          current.stat = null;
          return { status: 'committed' };
        },
        publish_snapshot: input => ({ status: 'published', snapshot: structuredClone(input.snapshot ?? null) }),
        create_id: () => ({ sidecarId: 'era_chat_g4-probe-12345678' }),
        present_prompt: () => ({ status: 'presented' }),
        clear_prompt: () => ({ status: 'cleared' }),
      };
    })(),
    'era.tavern.functions': {
      begin: () => ({ status: 'started' }),
      next: async () => ({ kind: 'done', error: null }),
      acknowledge: () => ({ status: 'acknowledged' }),
      release: () => ({ released: true }),
    },
    'era.lifecycle.admission': { schedule: () => ({ status: 'scheduled' }), cancel: () => ({ status: 'cancelled' }) },
  };
}

class FakePort {
  frames = [];
  queue = [];
  pendingReceive = null;
  frameWaiters = [];

  receive(_input, context = {}) {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve({ value: queued });
    assert(this.pendingReceive === null, '工作流同时创建了多个 receive。');
    return new Promise((resolveReceive, rejectReceive) => {
      const signal = context.signal;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const onAbort = () => {
        cleanup();
        this.pendingReceive = null;
        rejectReceive(signal?.reason);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.pendingReceive = {
        resolve: value => {
          cleanup();
          this.pendingReceive = null;
          resolveReceive({ value });
        },
      };
    });
  }

  send(input) {
    this.frames.push(input.value);
    const ready = this.frameWaiters.filter(waiter => this.frames.length >= waiter.count);
    this.frameWaiters = this.frameWaiters.filter(waiter => this.frames.length < waiter.count);
    for (const waiter of ready) waiter.resolve();
    return null;
  }

  push(value) {
    if (this.pendingReceive !== null) {
      this.pendingReceive.resolve(value);
      return;
    }
    this.queue.push(value);
  }

  async exchange(value, expectedKinds) {
    const start = this.frames.length;
    this.push(value);
    await this.waitForFrameCount(start + expectedKinds.length);
    const frames = this.frames.slice(start);
    const kinds = frames.map(frame => frame.kind);
    assert(
      JSON.stringify(kinds) === JSON.stringify(expectedKinds),
      `事件 ${value.sequence} 的帧顺序异常：${JSON.stringify(kinds)}`,
    );
    return frames;
  }

  waitForFrameCount(count) {
    if (this.frames.length >= count) return Promise.resolve();
    return new Promise((resolveWait, rejectWait) => {
      const timeout = setTimeout(() => {
        this.frameWaiters = this.frameWaiters.filter(waiter => waiter.resolve !== resolveReady);
        rejectWait(new Error(`等待 ${count} 个输出帧超时，实际 ${this.frames.length} 个。`));
      }, 2_000);
      const resolveReady = () => {
        clearTimeout(timeout);
        resolveWait();
      };
      this.frameWaiters.push({ count, resolve: resolveReady });
    });
  }
}

function scheduledCommand(frame, expectedDueAt) {
  assert(frame.kind === 'collection-control', '首帧必须是 collection-control。');
  const command = frame.commands.find(item => item.kind === 'schedule');
  assert(command !== undefined, '事件窗口必须声明 schedule。');
  assert(command.dueAt === expectedDueAt, `绝对截止时间应为 ${expectedDueAt}。`);
  return command;
}

function assertBatch(frame, expectedSequences) {
  assert(frame.kind === 'batch-result', '末帧必须是 batch-result。');
  assert(frame.throughSequence === expectedSequences.at(-1), 'throughSequence 与来源末尾不一致。');
  const actual = frame.settlements.map(item => item.sequence);
  assert(JSON.stringify(actual) === JSON.stringify(expectedSequences), `结算来源异常：${JSON.stringify(actual)}`);
  assert(new Set(actual).size === actual.length, '一个批次内出现重复结算。');
}

const stagedWorkflow = await importGeneratedWorkflow();
const workflow = stagedWorkflow.workflow;
assert(workflow.VIBEFLOW_WORKFLOW_ABI === 'vibeflow.workflow.v5', 'Workflow ABI 不是 v5。');

const controller = new AbortController();
const port = new FakePort();
const execution = workflow.runWorkflowAsync(
  {},
  {
    signal: controller.signal,
    capabilities: {
      'vibeflow.port': {
        receive: port.receive.bind(port),
        send: port.send.bind(port),
      },
      ...createTavernCapabilities(),
    },
  },
);

const firstFrames = await port.exchange(event(1, 'message_received', 1_000), ['collection-control']);
const firstSchedule = scheduledCommand(firstFrames[0], 1_100);
const firstClose = await port.exchange(timer(2, 1_100, firstSchedule.token), ['collection-control', 'batch-result']);
assertBatch(firstClose[1], [1, 2]);

const swipeFrames = await port.exchange(event(3, 'message_swiped', 2_000), ['collection-control']);
const swipeSchedule = scheduledCommand(swipeFrames[0], 2_500);
const comboFrames = await port.exchange(event(4, 'generation_started', 2_600), ['collection-control', 'batch-result']);
assert(
  comboFrames[0].commands.some(item => item.kind === 'cancel' && item.token === swipeSchedule.token),
  '600ms swipe 组合必须取消旧 timer。',
);
assertBatch(comboFrames[1], [3, 4]);

const updatedFrames = await port.exchange(event(5, 'message_updated', 3_000), ['collection-control']);
const updatedSchedule = scheduledCommand(updatedFrames[0], 4_500);
const updatedClose = await port.exchange(timer(6, 4_500, updatedSchedule.token), [
  'collection-control',
  'batch-result',
]);
assertBatch(updatedClose[1], [5, 6]);

const apiFrames = await port.exchange(event(7, 'era.facade.sync', 5_000), ['collection-control', 'batch-result']);
assertBatch(apiFrames[1], [7]);

const dryRunFrames = await port.exchange(
  event(8, 'generation_started', 6_000, {
    args: [json('normal'), json({}), json(true)],
  }),
  ['collection-control', 'batch-result'],
);
assertBatch(dryRunFrames[1], [8]);

const lateFrames = await port.exchange(event(9, 'message_received', 7_000), ['collection-control']);
const lateSchedule = scheduledCommand(lateFrames[0], 7_100);
const staleFrames = await port.exchange(timer(10, 7_050, 'stale-token'), ['collection-control']);
assert(staleFrames[0].commands.length === 0, '迟到 token 不得取消或关闭有效窗口。');
const lateClose = await port.exchange(timer(11, 7_100, lateSchedule.token), ['collection-control', 'batch-result']);
assertBatch(lateClose[1], [9, 10, 11]);

const frameIds = port.frames.map(frame => frame.frameId);
assert(new Set(frameIds).size === frameIds.length, '输出 frameId 必须唯一。');
const allSettled = port.frames
  .filter(frame => frame.kind === 'batch-result')
  .flatMap(frame => frame.settlements.map(item => item.sequence));
assert(
  JSON.stringify(allSettled) === JSON.stringify(Array.from({ length: 11 }, (_, index) => index + 1)),
  `跨批次结算必须严格覆盖 1..11：${JSON.stringify(allSettled)}`,
);

controller.abort(new Error('G4 fake Port probe complete'));
let executionCode = null;
try {
  await execution;
} catch (error) {
  executionCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
}
assert(executionCode === 'VF_ABORTED', `永久 workflow 取消码异常：${String(executionCode)}`);

const manifest = await readFile(manifestPath);
const report = {
  status: 'PASS',
  workflowAbi: workflow.VIBEFLOW_WORKFLOW_ABI,
  generatedModule: generatedModuleUrl.pathname,
  buildManifestSha256: createHash('sha256').update(manifest).digest('hex'),
  scenarios: [
    '100ms 默认窗口与匹配 timer',
    '500ms swipe 窗口与 600ms 组合边界',
    '1500ms message_updated 窗口',
    '0ms API',
    'dry-run generation',
    '迟到 token 与唯一结算',
  ],
  frameKinds: port.frames.map(frame => frame.kind),
  frameIds,
  settlementSequences: allSettled,
  executionCode,
};

await mkdir(resolve(reportPath, '..'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await stagedWorkflow.cleanup();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
