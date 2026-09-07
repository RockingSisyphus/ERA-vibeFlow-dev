// Standalone browser probe of the production runtime, not a mocked UI success test.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const harness =
  process.env.ERA_HARNESS_PACKAGE ??
  '/home/example/projects/酒馆开发目录/测试工具链/ST-Test-Harness/package.json';
const require = createRequire(harness);
const { build } = require('esbuild');
const { chromium } = require('playwright');
const output = await build({
  entryPoints: [fileURLToPath(new URL('../src/ERA变量框架/service/external-statusbar-frame.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'ExternalRuntime',
});
const server = createServer((request, response) => {
  if(request.url === '/library.js') {
    response.writeHead(200, {'Content-Type':'text/javascript'});
    response.end('window.localLibrary={sum:(a,b)=>a+b};');
  } else {
    response.writeHead(200, {'Content-Type':'text/html'});
    response.end('<div id="content"></div>');
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.addScriptTag({ content: output.outputFiles[0].text });
  await page.evaluate(() => {
    let state = { status: 'ready', statData: { hp: 10 }, statWithoutMeta: { hp: 10 } };
    const listeners = new Set();
    window.publish = hp => {
      state = { ...state, statData: { hp }, statWithoutMeta: { hp } };
      for (const fn of listeners) fn(state);
    };
    const era = {
      get: () => structuredClone(state),
      ready: async () => structuredClone(state),
      subscribe: fn => {
        listeners.add(fn);
        fn(state);
        return () => listeners.delete(fn);
      },
      commit: async () => ({}),
      sync: async () => state,
      history: { atMessage: async () => state },
    };
    window.listenerCount = () => listeners.size;
    window.probeErrors = [];
    window.mountProbe = () =>
      ExternalRuntime.mountExternalFrame(
        document.getElementById('content'),
        '<script src="/library.js"></script><style>.panel{display:grid;background:rgb(10,20,30);padding:12px}#host{width:{{ERA:hp}}px}</style><section class="panel"><span id="hp">{{ERA:hp}}</span><input id="field" value="initial"><span id="host">{{user}}</span></section><script>window.libraryResult=localLibrary.sum(ERA.get().statData.hp,2);window.firstLine=ERA.get().statData.hp;window.loads=(window.loads||0)+1;ERA.subscribe(s=>window.latest=s.statData.hp);document.getElementById("field").addEventListener("click",()=>window.clicked=true);</script>',
        {
          era,
          helper: { _private: true, getVariables: () => ({}) },
          getContext: () => ({ name1: 'test' }),
          macros: text => text.replace('{{user}}', 'tester'),
        },
        error => window.probeErrors.push(String(error)),
      );
    window.runtime = window.mountProbe();
  });
  await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow?.latest === 10);
  const first = await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    const win = frame.contentWindow;
    window.firstFrame = frame;
    window.firstRoot = win.document.querySelector('section');
    win.document.getElementById('field').value = 'edited';
    win.document.getElementById('field').click();
    return {
      hp: win.document.getElementById('hp').textContent,
      firstLine: win.firstLine,
      libraryResult: win.libraryResult,
      layout: win.getComputedStyle(window.firstRoot).display,
      clicked: win.clicked,
      privateExposed: '_private' in win.TavernHelper,
      mountWidth: win.getComputedStyle(win.document.getElementById('host')).width,
    };
  });
  assert.deepEqual(first, {
    hp: '10',
    firstLine: 10,
    libraryResult: 12,
    layout: 'grid',
    clicked: true,
    privateExposed: false,
    mountWidth: '10px',
  });
  const updated = await page.evaluate(() => {
    window.publish(7);
    const frame = document.querySelector('iframe');
    const win = frame.contentWindow;
    return {
      sameFrame: frame === window.firstFrame,
      sameRoot: win.document.querySelector('section') === window.firstRoot,
      hp: win.document.getElementById('hp').textContent,
      latest: win.latest,
      loads: win.loads,
      value: win.document.getElementById('field').value,
      mountWidth: win.getComputedStyle(win.document.getElementById('host')).width,
    };
  });
  assert.deepEqual(updated, {
    sameFrame: true,
    sameRoot: true,
    hp: '7',
    latest: 7,
    loads: 1,
    value: 'edited',
    mountWidth: '10px',
  });
  assert.equal(
    await page.evaluate(() => {
      window.runtime.stop();
      return window.listenerCount();
    }),
    0,
  );
  await page.evaluate(() => {
    window.runtime = window.mountProbe();
  });
  await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow?.latest === 7);
  assert.deepEqual(
    await page.evaluate(() => ({ errors: window.probeErrors, frames: document.querySelectorAll('iframe').length })),
    { errors: [], frames: 1 },
  );
  const disposed = await page.evaluate(async () => {
    window.runtime.stop();
    let listener;
    let stopped = 0;
    const loading = { status: 'loading' };
    const runtime = ExternalRuntime.mountExternalFrame(
      document.getElementById('content'),
      '<p>pending</p>',
      {
        era: {
          get: () => loading,
          subscribe: fn => {
            listener = fn;
            return () => {
              stopped++;
            };
          },
          commit: async () => ({}),
          sync: async () => loading,
          history: { atMessage: async () => loading },
        },
        helper: {},
        getContext: () => ({}),
        macros: value => value,
      },
      error => {
        throw error;
      },
    );
    const old = runtime.frame.contentWindow.ERA;
    const pending = old.ready().then(
      () => 'unexpected-ready',
      error => error.message,
    );
    runtime.stop();
    listener?.({ status: 'ready' });
    let rejected = false;
    try {
      old.get();
    } catch {
      rejected = true;
    }
    return { pending: await pending, rejected, stopped };
  });
  // One subscription feeds macro presentation; the other owns the author's ready wait.
  assert.deepEqual(disposed, { pending: 'ERA_EXTERNAL_INSTANCE_DISPOSED', rejected: true, stopped: 2 });
  console.log(
    JSON.stringify({
      status: 'passed',
      engine: 'Chromium',
      checks: [
        'pre-script-facade',
        'author-loaded-local-library',
        'native-css-script-events',
        'macro-before-visible',
        'same-iframe-root-form',
        'subscription-cleanup',
        'explicit-remount',
        'pending-ready-disposed-and-late-event-ignored',
      ],
    }),
  );
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
