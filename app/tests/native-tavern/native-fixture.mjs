import assert from 'node:assert/strict';
import { fileURLToPath, URL as ResourceURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { importGeneratedService } = require('../../scripts/import-generated-service.mjs');
import { setTimeout as delay } from 'node:timers/promises';
const bundleRoot = new ResourceURL(process.env.ERA_NATIVE_AOT_ROOT ?? '../../../generated/', import.meta.url);
const { runWorkflow: sync } = require(fileURLToPath(new ResourceURL('era-tavern/sync/workflow.js', bundleRoot).href));
const { runWorkflowAsync: asyncEntry } = require(
  fileURLToPath(new ResourceURL('era-tavern/async/workflow.js', bundleRoot).href),
);
const { runWorkflowAsync: realService } = await stageService();
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
  let client,
    session,
    disposed = 0;
  const service = async (_inputs, { signal, capabilities }) => {
    caps = capabilities;
    if (serviceEntry) {
      if (options.readyOnEntry) ready.resolve();
      return await serviceEntry(_inputs, { signal, capabilities });
    }
    if (options.manualStartup) capabilities['era.tavern.identity'].read({});
    else capabilities['era.tavern.startup_gate'].activate({ route: 'allow', warn: false });
    ready.resolve();
    await new Promise(resolve => {
      signal.addEventListener('abort', resolve, { once: true });
      if (signal.aborted) resolve();
    });
  };
  const recordingAsync = (inputs, runOptions) =>
    asyncEntry(inputs, runOptions.entry === 'runtime' ? { ...runOptions, ...options.runtimeOptions } : runOptions);
  const recordingSync = inputs => {
    session = inputs.request.session ?? session;
    return sync(inputs);
  };
  const work = runEra(
    { sync: recordingSync, async: recordingAsync, service },
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
