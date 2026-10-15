/** 使用正式 AOT 入口运行酒馆能力、时序与资源归属回归；每组独立进程。 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const groups = [
  'entry-probe',
  'models-preserved',
  'message-entry-preserved',
  'io-entry-preserved',
  'character-entry-preserved',
  'sidecar-entry-preserved',
  'agent-context-entry-preserved',
  'agent-session-entry-preserved',
  'session-write-entry-preserved',
  'functions-entry-preserved',
  'caller-lifetime-preserved',
  'subscription-entry-preserved',
  'receipt-entry-preserved',
  'notification-runtime-preserved',
  'browser-ops-preserved',
  'startup-preserved',
  'edge-probe',
];
const selected = process.argv.slice(2);
for (const name of selected) if (!groups.includes(name)) throw new Error(`未知探针组：${name}`);
const output = resolve(
  process.env.ERA_NATIVE_PROBE_OUT ?? `artifact/native-tavern/${new Date().toISOString().replaceAll(':', '-')}`,
);
mkdirSync(output, { recursive: true });
const results = [];
for (const name of selected.length ? selected : groups) {
  const probe = fileURLToPath(new URL(`../tests/native-tavern/${name}.mjs`, import.meta.url));
  const result = spawnSync(process.execPath, [probe], { encoding: 'utf8', env: process.env });
  writeFileSync(resolve(output, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
  const record = {
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message,
  };
  results.push(record);
  console.log(JSON.stringify(record));
}
writeFileSync(
  resolve(output, 'summary.json'),
  JSON.stringify({ status: results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', results }, null, 2) + '\n',
);
process.exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
