/** 从同一工作树构建主 Service、同步宏和三个酒馆入口，调用官方 VibeFlow 编译器。 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateBindings } from '../../javascript_project/tavern/scripts/generate-bindings.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reports = fileURLToPath(new URL('../../reports/native-workflows/', import.meta.url));
mkdirSync(reports, { recursive: true });
const reportRoot=mkdtempSync(reports+'build-')+'/';
console.log('Build reports: '+reportRoot);
function execute(command, args, name) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(`${reportRoot}${name}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} 构建失败，详见 ${reportRoot}${name}.log`);
  console.log(`${name}: complete`);
}
mkdirSync(`${root}javascript_project/tavern/generated`, { recursive: true });
const declaration = JSON.parse(readFileSync(`${root}javascript_project/tavern/bindings.jsonc`, 'utf8'));
writeFileSync(`${root}javascript_project/tavern/generated/bindings.mjs`, generateBindings(declaration));
console.log('bindings: complete');
for (const entry of ['sync', 'async', 'runtime'])
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
      `generated/era-tavern/${entry}`,
      '--entry-name',
      'workflow.js',
      '--replace',
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
    'generated/era-service',
    '--entry-name',
    'workflow.js',
    '--replace',
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
    'generated/era-macro',
    '--entry-name',
    'era-macro.js',
    '--replace',
  ],
  'macro',
);
