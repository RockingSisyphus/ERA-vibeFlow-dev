/** 测试夹具只调用正式子图；不复制节点算法或手写调度。 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  existsSync,
  symlinkSync,
  openSync,
  closeSync,
} from 'node:fs';
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
for (const path of ['javascript_project/service', 'base_lib', 'packages', 'plugins']) addSource(path);
for (const path of [
  'DISTRIBUTION.json',
  'project_rules.jsonc',
  'vibeflow_config.jsonc',
  'app/scripts/build-service-test-workflows.mjs',
  'app/tests/service/business-workflow-nodes.json',
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
const cases = new Map();
function build(name, pipeline) {
  cases.set(name, pipeline);
}
function emit(name, pipeline) {
  // 缓存属于测试构建器，放在VibeFlow产物之外，避免污染受保护的AOT目录。
  const stamp = out + name + '-source.txt';
  if (existsSync(out + name + '/workflow.js') && existsSync(stamp) && readFileSync(stamp, 'utf8') === sourceDigest) {
    console.log(name + ': production Nodeset unchanged');
    return;
  }
  // 缓存失效后重建本构建器独占的测试产物，不跨AOT格式执行原地替换。
  rmSync(out + name, { recursive: true, force: true });
  const path = service + 'configs/.test-' + name + '.jsonc';
  for (const node of pipeline.nodes) {
    node.display_name ??=
      node.id === 'start' || node.id.endsWith('_start')
        ? '开始内存行为验证'
        : node.id === 'end' || node.id.endsWith('_end')
          ? '返回完整验证结果'
          : '调用正式业务子流程';
    node.description ??=
      node.id === 'start' || node.id.endsWith('_start')
        ? '接收沙箱准备的业务输入，进入本次正式子流程。'
        : node.id === 'end' || node.id.endsWith('_end')
          ? '将正式子流程的最终结果交回行为断言，不执行宿主写入。'
          : '使用产品已登记子流程计算本次输入，不复制业务步骤。';
  }
  for (const entry of Object.values(pipeline.entries ?? {})) {
    for (const output of entry.outputs ?? []) output.display_name ??= '正式子流程结果';
    for (const input of entry.inputs ?? []) input.display_name ??= '沙箱业务输入';
  }
  for (const output of pipeline.outputs) output.display_name ??= '正式子流程结果';
  for (const input of pipeline.inputs) input.display_name ??= '沙箱业务输入';
  const imports = ['command_operations', 'command_operation_step'];
  if (name === 'compaction') imports.push('sealed_command_compaction', 'command_compaction_replay_step');
  if (name === 'preview' || name === 'generation') imports.push('readonly_preview_step');
  if (name === 'generation') imports.push('prepare_generation_facts');
  const library = new Map();
  for (const file of readdirSync(service + 'configs/nodesets').filter(file => file.endsWith('.jsonc'))) {
    const definition = JSON.parse(readFileSync(service + 'configs/nodesets/' + file, 'utf8'));
    library.set(definition.type_key, { file, definition });
  }
  const selected = new Set();
  const visit = graph => {
    for (const node of graph.nodes)
      for (const reference of [node.definition_id, node.loop?.body])
        if (library.has(reference) && !selected.has(reference)) {
          selected.add(reference);
          visit(library.get(reference).definition.pipeline);
        }
  };
  visit(pipeline);
  const graphNodes = new Map(pipeline.nodes.map(node => [node.id, node]));
  const needsHost = node =>
    [node.definition_id, node.loop?.body].some(id =>
      library.get(id)?.definition.requires.some(input => input.type === 'era.workflow.host_resources'),
    );
  const hostInput = base.pipeline.inputs.find(input => input.type === 'era.workflow.host_resources');
  if (pipeline.nodes.some(needsHost)) pipeline.inputs.push(hostInput);
  for (const entry of Object.values(pipeline.entries ?? {})) {
    const reachable = new Set([entry.start]);
    for (const id of reachable) {
      for (const edge of pipeline.edges) {
        const [from, to] = Array.isArray(edge) ? edge : [edge.from, edge.to];
        if (from === id) reachable.add(to);
      }
    }
    if (entry.inputs && [...reachable].some(id => needsHost(graphNodes.get(id)))) entry.inputs.push(hostInput);
  }
  const config = {
    ...base,
    nodeset_imports: [...selected].map(id => ({ path: 'nodesets/' + library.get(id).file })),
    pipeline,
  };
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));
    const logPath = out + name + '-' + process.pid + '.log';
    const log = openSync(logPath, 'w');
    let result;
    try {
      result = spawnSync(
        'python',
        [
          'run.py',
          'build',
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
        { cwd: root, env: { ...process.env, TMPDIR: out + 'tmp' }, stdio: ['ignore', log, log] },
      );
    } finally {
      closeSync(log);
    }
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(name + ' fixture build failed: ' + logPath);
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
  if (
    !process.argv.includes('--only') ||
    process.argv.slice(process.argv.indexOf('--only') + 1).includes('business-nodes')
  ) {
    const registry = JSON.parse(readFileSync(root + 'app/tests/service/business-workflow-nodes.json', 'utf8'));
    const nodes = [],
      edges = [],
      entries = {};
    for (const [i, row] of registry.entries()) {
      const file = readdirSync(service + 'configs/nodesets').find(
        name =>
          name.endsWith('.jsonc') &&
          JSON.parse(readFileSync(service + 'configs/nodesets/' + name, 'utf8')).type_key === row.definition_id,
      );
      const definition = JSON.parse(readFileSync(service + 'configs/nodesets/' + file, 'utf8'));
      const start = 'entry_' + i,
        body = 'body_' + i,
        end = 'end_' + i;
      nodes.push(
        {
          id: start,
          definition_id: 'era.service.terminal',
          display_name: '开始本项业务验证',
          description: '接收沙箱输入，运行下一个正式业务子流程。',
        },
        {
          id: body,
          definition_id: row.definition_id,
          display_name: definition.display_name,
          description: definition.description,
        },
        {
          id: end,
          definition_id: 'era.service.terminal',
          display_name: '交回本项业务验证结果',
          description: '该项正式业务已结束，结果交给原测试断言。',
        },
      );
      edges.push([start, body], [body, end]);
      entries[row.entry] = {
        start,
        inputs: definition.requires.map(input => ({
          key: input.type,
          type: input.type,
          required: definition.pipeline.inputs.find(source => source.type === input.type).required,
          display_name: input.display_name,
        })),
        outputs: definition.provides.map(output => ({
          type: output.type,
          as: output.key,
          cardinality: 'exactly_one',
          display_name: output.display_name,
        })),
      };
    }
    build('business-nodes', { entry_mode: 'async', inputs: [], outputs: [], entries, nodes, edges, max_steps: 6 });
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
  const nodes = [],
    edges = [],
    entries = {};
  for (const [name, pipeline] of cases) {
    const prefix = name.replaceAll('-', '_') + '_';
    nodes.push(...pipeline.nodes.map(node => ({ ...node, id: prefix + node.id })));
    edges.push(
      ...pipeline.edges.map(edge =>
        Array.isArray(edge)
          ? [prefix + edge[0], prefix + edge[1]]
          : { ...edge, from: prefix + edge.from, to: prefix + edge.to },
      ),
    );
    if (pipeline.entries)
      for (const [entry, value] of Object.entries(pipeline.entries))
        entries[entry] = { ...value, start: prefix + value.start };
    else entries[name] = { start: prefix + 'start', inputs: pipeline.inputs, outputs: pipeline.outputs };
  }
  emit('combined', { entry_mode: 'async', inputs: [], outputs: [], entries, nodes, edges, max_steps: 35 });
  for (const name of cases.keys()) {
    rmSync(out + name, { recursive: true, force: true });
    mkdirSync(out + name);
    symlinkSync('../combined/workflow.js', out + name + '/workflow.js');
    writeFileSync(out + name + '-source.txt', sourceDigest);
  }
} finally {
  rmSync(out + 'tmp', { recursive: true, force: true });
}
