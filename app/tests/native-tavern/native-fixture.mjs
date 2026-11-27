import { resourceClient } from './native-resource-client.mjs';
import * as expression from '../../../javascript_project/expression/generated/release/node.js';
import * as compaction from '../../../javascript_project/compaction/generated/release/node.js';
import assert from 'node:assert/strict';
import { fileURLToPath, URL as ResourceURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { importGeneratedService } = require('../../scripts/import-generated-service.mjs');
import { setTimeout as delay } from 'node:timers/promises';
const bundleRoot = new ResourceURL(process.env.ERA_NATIVE_AOT_ROOT ?? '../../../generated/', import.meta.url);
const syncModule = require(fileURLToPath(new ResourceURL('era-tavern/sync/workflow.js', bundleRoot).href));
const loadTavern = name => require(fileURLToPath(new ResourceURL(`era-tavern/${name}/workflow.js`, bundleRoot).href));
const operationModule = loadTavern('operation');
const runtimeModule = loadTavern('runtime');
const parallelReadsModule = loadTavern('parallel_reads');
const serviceModule = await stageService();
const realService = serviceModule.runWorkflowAsync;
// 仅测试原始入口的分段合同：由测试驱动显式启动一次真实异步入口，并复用该次结果。
// 正式生产接线和Service通信不经过此适配。
const prepared = new WeakMap();
const resource = frame => frame?.operationResource ?? frame?.modelResource ?? frame?.publicPromise;
function sync(inputs, options) {
  const output = syncModule.runWorkflow(inputs, options),
    frame = output.result;
  if (!inputs.wire_request && frame?.action === 'capability' && frame.publicPromise && frame.session?.dispatch) {
    const key = resource(frame),
      work = frame.session.dispatch.async(frame);
    prepared.set(key, {
      work,
      session: frame.session,
      action: frame.action,
      family: frame.family,
      operation: frame.operation,
    });
    work.catch(error => {
      (frame.operationResource ?? frame.modelResource)?.completion.reject(error);
    });
  }
  return output;
}
function asyncEntry(inputs, options) {
  const frame = inputs.request,
    key = resource(frame),
    record = key && prepared.get(key);
  return record &&
    record.session === frame.session &&
    record.action === frame.action &&
    record.family === frame.family &&
    record.operation === frame.operation
    ? record.work.then(result => ({ result }))
    : (options.entry === 'runtime' || options.entry === 'protocol_runtime'
      ? runtimeModule
      : options.entry === 'protocol_parallel_reads'
        ? parallelReadsModule
        : operationModule
    ).runWorkflowAsync(inputs, options);
}
const { runEra } = require(
  fileURLToPath(new ResourceURL('../../../javascript_project/tavern/generated/bindings.mjs', import.meta.url).href),
);
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function environment() {
  const page = new EventTarget();
  page.top = page;
  const handlers = new Map(),
    calls = [];
  const register = (type, fn) => {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return { stop: () => handlers.get(type)?.delete(fn) };
  };
  const api = {
    window: page,
    CustomEvent: globalThis.CustomEvent,
    crypto: globalThis.crypto,
    tavern_events: { GENERATION_ENDED: 'generation_ended', GENERATION_AFTER_COMMANDS: 'generation_after_commands' },
    eventOnce: (type, fn) => {
      const once = (...args) => {
        handlers.get(type)?.delete(once);
        return fn(...args);
      };
      return register(type, once);
    },
    eventOn: register,
    eventMakeFirst: register,
    eventMakeLast: register,
    eventRemoveListener: (type, fn) => handlers.get(type)?.delete(fn),
    getButtonEvent: label => 'button:' + label,
    getScriptTrees: ({ type }) => (type === 'character' ? [{ type: 'script', id: 'script', enabled: true }] : []),
    getVariables: () => ({ value: 7 }),
    getCurrentCharacterId: () => 'card',
    getCurrentCharacterName: () => 'Card',
    getScriptId: () => 'script',
    getChatMessages: () => [],
    SillyTavern: { groupId: null, getCurrentChatId: () => 'chat' },
    eventEmit: async (type, ...args) => {
      calls.push([type, ...args]);
      for (const h of handlers.get(type) ?? []) await h(...args);
    },
  };
  return { api, page, handlers, calls };
}
export async function fixture(serviceEntry, options = {}) {
  const env = environment(),
    ready = deferred();
  Object.assign(env.api, options.api);
  if (options.api?.window) {
    Object.assign(env.page, options.api.window);
    env.api.window = env.page;
    if (env.page.top && !env.page.top.dispatchEvent) env.page.top.dispatchEvent = env.page.dispatchEvent.bind(env.page);
  }
  if (options.dynamicApi) {
    env.api = new Proxy(env.api, {
      get: (target, key) => (key !== 'window' && key in options.dynamicApi ? options.dynamicApi[key] : target[key]),
    });
  }
  /** @type {Record<string, any>} */
  let caps = {};
  const publicWaits = new Map();
  let client,
    session,
    disposed = 0,
    activeReceives = 0,
    maxReceives = 0;
  const service = async (inputs, runOptions) => {
    const { signal, workflowSession: native } = runOptions;
    const workflowSession = {
      ...native,
      receive: async (...args) => {
        activeReceives++;
        maxReceives = Math.max(maxReceives, activeReceives);
        try {
          return await native.receive(...args);
        } finally {
          activeReceives--;
        }
      },
    };
    caps = resourceClient(workflowSession, inputs.host_resources, token => {
      const promise = publicWaits.get(token);
      publicWaits.delete(token);
      return promise;
    });
    if (serviceEntry) {
      if (options.readyOnEntry) ready.resolve();
      return (await serviceEntry(inputs, { ...runOptions, workflowSession })) ?? {};
    }
    if (options.manualStartup) caps['era.tavern.identity'].read({});
    else caps['era.tavern.startup_gate'].activate({ route: 'allow', warn: false });
    ready.resolve();
    await new Promise(resolve => {
      signal.addEventListener('abort', resolve, { once: true });
      if (signal.aborted) resolve();
    });
    return {};
  };
  const recordingAsync = (inputs, runOptions) => {
    if (options.observeProtocol && inputs.host_resources) {
      const resources = inputs.host_resources;
      inputs = {
        ...inputs,
        host_resources: {
          ...resources,
          project: request => {
            options.observeProtocol(request);
            return resources.project(request);
          },
        },
      };
    }
    const work = asyncEntry(
      inputs,
      runOptions.entry === 'protocol_runtime' ? { ...runOptions, ...options.runtimeOptions } : runOptions,
    );
    if (options.observeFailure) work.catch(options.observeFailure);
    else if (process.env.ERA_NATIVE_DEBUG_OWNER) work.catch(error => console.dir(error, { depth: 10 }));
    return work;
  };
  const recordingSync = (inputs, runOptions) => {
    const resources = inputs.host_resources;
    if (!resources) return sync(inputs, runOptions);
    return sync({
      ...inputs,
      host_resources: {
        ...resources,
        restore: request => {
          const frame = resources.restore(request);
          session = frame.session ?? session;
          return frame;
        },
        project: request => {
          const output = resources.project(request),
            token = output.result?.pending,
            promise = request.value.publicPromise;
          if (token && promise) {
            publicWaits.set(token, { promise, controller: request.value.operationScope.controller });
            promise.then(
              () => publicWaits.delete(token),
              () => publicWaits.delete(token),
            );
          }
          return output;
        },
      },
    }, runOptions);
  };
  const work = runEra(
    {
      sync: { ...syncModule, runWorkflow: recordingSync },
      operation: { ...operationModule, runWorkflowAsync: recordingAsync },
      runtime: { ...runtimeModule, runWorkflowAsync: recordingAsync },
      parallelReads: { ...parallelReadsModule, runWorkflowAsync: recordingAsync },
      service: { ...serviceModule, runWorkflowAsync: service },
      expression,
      compaction,
    },
    {
      ...options,
      api: env.api,
      eventDefinitions: options.eventDefinitions ?? [],
      onActivated: async (value, signal) => {
        client = value;
        ready.resolve();
        return options.onActivated ? await options.onActivated(value, signal) : () => {};
      },
      onDispose: async () => {
        disposed++;
        await options.onDispose?.();
      },
    },
  );
  work.catch(ready.reject);
  work.then(
    () => publicWaits.clear(),
    () => publicWaits.clear(),
  );
  await ready.promise;
  await delay(0);
  return {
    ...env,
    caps,
    get session() {
      return session;
    },
    direct: frame => sync({ request: { ...frame, session } }).result,
    get client() {
      return client;
    },
    work,
    disposed: () => disposed,
    transport: () => ({ activeReceives, maxReceives }),
  };
}
export { sync, asyncEntry, realService, runEra };

async function stageService() {
  const staged = await importGeneratedService(new ResourceURL('era-service/workflow.js', bundleRoot));
  try {
    return staged.workflow;
  } finally {
    await staged.cleanup();
  }
}
