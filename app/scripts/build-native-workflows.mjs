/** 按依赖顺序重建公开包与四个原生入口，全部成功后安装AOT候选。 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRuntimePackages } from './build-runtime-packages.mjs';
import { generateBindings } from '../../javascript_project/tavern/scripts/generate-bindings.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reports = fileURLToPath(new URL('../../reports/native-workflows/', import.meta.url));
mkdirSync(reports, { recursive: true });
const reportRoot = mkdtempSync(reports + 'build-') + '/';
console.log('Build reports: ' + reportRoot);
const temporary = reportRoot + 'tmp';
mkdirSync(temporary);
const buildEnv = { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary };
const pending = [];
function candidate(destination) {
  const staged = reportRoot + 'candidate-' + pending.length;
  pending.push({ staged, destination: root + destination });
  return staged;
}
function execute(command, args, name) {
  const result = spawnSync(command, args, { cwd: root, env: buildEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`${reportRoot}${name}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} 构建失败，详见 ${reportRoot}${name}.log`);
  console.log(`${name}: complete`);
}
try {
  buildRuntimePackages();
  mkdirSync(`${root}javascript_project/tavern/generated`, { recursive: true });
  const declaration = JSON.parse(readFileSync(`${root}javascript_project/tavern/bindings.jsonc`, 'utf8'));
  writeFileSync(`${root}javascript_project/tavern/generated/bindings.mjs`, generateBindings(declaration));
  console.log('bindings: complete');
  for (const entry of ['sync', 'async'])
    execute(
      'python',
      [
        'run.py',
        'build',
        '--workspace',
        'vibeflow_config.jsonc',
        '--config',
        `javascript_project/tavern/configs/era.tavern.${entry}.jsonc`,
        '--target',
        'browser',
        '--profile',
        'single-esm',
        '--out-dir',
        candidate(`generated/era-tavern/${entry}`),
        '--entry-name',
        'workflow.js',
      ],
      `tavern-${entry}`,
    );
  execute(
    'python',
    [
      'run.py',
      'build',
      '--workspace',
      'vibeflow_config.jsonc',
      '--config',
      'javascript_project/service/configs/era.service.jsonc',
      '--target',
      'browser',
      '--profile',
      'single-esm',
      '--out-dir',
      candidate('generated/era-service'),
      '--entry-name',
      'workflow.js',
    ],
    'service',
  );
  execute(
    'python',
    [
      'run.py',
      'build',
      '--workspace',
      'vibeflow_config.jsonc',
      '--config',
      'javascript_project/macro/configs/era.macro.jsonc',
      '--target',
      'browser',
      '--profile',
      'single-esm',
      '--out-dir',
      candidate('generated/era-macro'),
      '--entry-name',
      'era-macro.js',
    ],
    'macro',
  );

  // 所有入口构建成功后才安装候选；旧ABI产物不作为构建失败的回退。
  for (const { staged, destination } of pending) {
    rmSync(destination, { recursive: true, force: true });
    renameSync(staged, destination);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
  for (const { staged } of pending) rmSync(staged, { recursive: true, force: true });
}
