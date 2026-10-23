/** 测试夹具只调用正式子图；不复制节点算法或手写调度。 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const service = root + 'javascript_project/service/';
const out = root + 'reports/service-test-workflows/';
mkdirSync(out, { recursive: true });
mkdirSync(out + 'tmp', { recursive: true });
const base = JSON.parse(readFileSync(service + 'configs/era.service.jsonc', 'utf8'));
// 普通构建缓存：源码、声明、锁文件或工具链版本变化时重新编译；测试始终执行。
const digest = createHash('sha256');
function addSource(relative) {
  const path = root + relative;
  if (!existsSync(path)) return;
  const entries = readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (
      ['node_modules', 'generated', 'dist', 'vendor', '.git'].includes(entry.name) ||
      entry.name.startsWith('.test-') ||
      entry.name === 'ARCHITECTURE.jsonc'
    )
      continue;
    const child = relative + '/' + entry.name;
    if (entry.isDirectory()) addSource(child);
    else if (entry.isFile()) {
      digest.update(child);
      digest.update(readFileSync(root + child));
    }
  }
}
for (const path of ['javascript_project/service', 'base_lib', 'packages']) addSource(path);
for (const path of [
  'DISTRIBUTION.json',
  'project_rules.jsonc',
  'vibeflow_config.jsonc',
  'app/scripts/build-service-test-workflows.mjs',
]) {
  digest.update(path);
  digest.update(readFileSync(root + path));
}
for (const source of Object.values(JSON.parse(readFileSync(service + 'package.json', 'utf8')).dependencies)) {
  if (source.startsWith('file:')) {
    digest.update(source);
    digest.update(readFileSync(service + source.slice(5)));
  }
}
const sourceDigest = digest.digest('hex');
const definitions = [
  ['operations', 'command_operations'],
  ['compaction', 'sealed_command_compaction'],
  ['generation', 'prepare_generation_facts'],
];
function build(name, pipeline) {
  // 缓存属于测试构建器，放在VibeFlow产物之外，避免污染受保护的AOT目录。
  const stamp = out + name + '-source.txt';
  if (existsSync(out + name + '/workflow.js') && existsSync(stamp) && readFileSync(stamp, 'utf8') === sourceDigest) {
    console.log(name + ': production Nodeset unchanged');
    return;
  }
  const path = service + 'configs/.test-' + name + '.jsonc';
  for (const node of pipeline.nodes) {
    node.display_name ??=
      node.id === 'start' ? '开始内存行为验证' : node.id === 'end' ? '返回完整验证结果' : '调用正式业务子流程';
    node.description ??=
      node.id === 'start'
        ? '接收沙箱准备的业务输入，进入本次正式子流程。'
        : node.id === 'end'
          ? '将正式子流程的最终结果交回行为断言，不执行宿主写入。'
          : '使用产品已登记子流程计算本次输入，不复制业务步骤。';
  }
  for (const output of pipeline.outputs) output.display_name ??= '正式子流程结果';
  for (const input of pipeline.inputs) input.display_name ??= '沙箱业务输入';
  const imports = ['command_operations', 'command_operation_step'];
  if (name === 'compaction') imports.push('sealed_command_compaction', 'command_compaction_replay_step');
  if (name === 'preview' || name === 'generation') imports.push('readonly_preview_step');
  if (name === 'generation') imports.push('prepare_generation_facts');
  const config = { ...base, nodeset_imports: imports.map(file => ({ path: `nodesets/${file}.jsonc` })), pipeline };
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));
    const result = spawnSync(
      'python',
      [
        'run.py',
        'build',
        '--replace',
        '--config',
        path,
        '--target',
        'browser',
        '--profile',
        'single-esm',
        '--out-dir',
        out + name,
        '--entry-name',
        'workflow.js',
      ],
      { cwd: root, env: { ...process.env, TMPDIR: out + 'tmp' }, encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 },
    );
    writeFileSync(out + name + '-' + process.pid + '.log', (result.stdout ?? '') + (result.stderr ?? ''));
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(name + ' fixture build failed: ' + out + name + '-' + process.pid + '.log');
    writeFileSync(stamp, sourceDigest);
    console.log(name + ': compiled production Nodeset');
  } finally {
    rmSync(path, { force: true });
  }
}
try {
  for (const [name, file] of definitions) {
    if (process.argv.includes('--only') && !process.argv.slice(process.argv.indexOf('--only') + 1).includes(name))
      continue;
    const d = JSON.parse(readFileSync(service + 'configs/nodesets/' + file + '.jsonc', 'utf8'));
    build(name, {
      entry_mode: 'async',
      inputs: d.requires.map(r => ({ key: r.type, type: r.type, display_name: r.display_name, required: true })),
      max_steps: 35,
      nodes: [
        { id: 'start', definition_id: 'era.service.terminal' },
        { id: 'execute', definition_id: d.type_key },
        { id: 'end', definition_id: 'era.service.terminal' },
      ],
      edges: [
        ['start', 'execute'],
        ['execute', 'end'],
      ],
      outputs: d.provides.map(r => ({ type: r.type, as: r.key, cardinality: 'exactly_one' })),
    });
  }
  const generation = JSON.parse(readFileSync(service + 'configs/nodesets/prepare_generation_facts.jsonc', 'utf8'));
  const loop = generation.pipeline.nodes.find(n => n.id === 'preview_history');
  if (!process.argv.includes('--only') || process.argv.slice(process.argv.indexOf('--only') + 1).includes('preview'))
    build('preview', {
      entry_mode: 'async',
      inputs: [{ key: 'era.sync.preview.state', type: 'era.sync.preview.state', required: true }],
      max_steps: 35,
      nodes: [
        { id: 'start', definition_id: 'era.service.terminal' },
        loop,
        { id: 'end', definition_id: 'era.service.terminal' },
      ],
      edges: [
        ['start', loop.id],
        [loop.id, 'end'],
      ],
      outputs: [{ type: 'era.sync.preview.state.next', as: 'preview_result', cardinality: 'exactly_one' }],
    });
} finally {
  rmSync(out + 'tmp', { recursive: true, force: true });
}
