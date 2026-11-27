import { createHash } from 'node:crypto';

import { readFile, writeFile } from 'node:fs/promises';

const generatedRoot = new URL('../../generated/era-macro/', import.meta.url);
const manifestPath = new URL('vibeflow-build.json', generatedRoot);
const ambientFacadePath = new URL('../@types/vibeflow-macro.d.ts', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const target = manifest.target_metadata;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function normalizePublicInterface(source, name) {
  const match = source.match(new RegExp(`(?:export\\s+)?interface\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert(match, `Macro 声明缺少 ${name}`);
  return match[1]
    .replaceAll('readonly', '')
    .replaceAll('"', '')
    .replaceAll("'", '')
    .replace(/\s+/g, '')
    .replace(/;+$/g, '');
}

assert(manifest.format === 'vibeflow.aot-build.v6', 'Macro build manifest 格式错误');
assert(manifest.project_target === 'javascript', 'Macro 必须使用 JavaScript Target');
assert(manifest.abi_version === 'vibeflow.workflow.v12', 'Macro Workflow ABI 错误');
assert(target.plugin_abi_version === 'vibeflow.plugin.v5', 'Macro Plugin ABI 错误');
assert(manifest.entry === 'era-macro.js', 'Macro 入口文件名错误');
assert(manifest.entry_mode === 'sync', 'Macro 必须保持同步入口');
assert(
  Array.isArray(target.external_packages) && target.external_packages.length === 0,
  'Macro 不得保留外置运行时依赖',
);
assert(
  Array.isArray(target.plugins?.active) &&
    target.plugins.active.length === 0 &&
    Array.isArray(target.plugins?.planned) &&
    target.plugins.planned.length === 0,
  'Macro 不得启用或计划 Plugin',
);
assert(target.toolchain?.node === '24.18.0', 'Macro Node.js 工具链版本错误');
assert(target.toolchain?.typescript === '7.0.2', 'Macro TypeScript 工具链版本错误');
assert(target.toolchain?.esbuild === '0.28.1', 'Macro esbuild 工具链版本错误');
// v4 将目标专属信息集中在 target_metadata。

for (const [relativePath, expectedHash] of Object.entries(manifest.files ?? {})) {
  const content = await readFile(new URL(relativePath, generatedRoot));
  assert(sha256(content) === expectedHash, `Macro 构建文件哈希不一致：${relativePath}`);
}

const declarations = await readFile(new URL('era-macro.d.ts', generatedRoot), 'utf8');
const ambientFacade = await readFile(ambientFacadePath, 'utf8');
assert(declarations.includes('export function runWorkflow('), 'Macro 声明缺少同步 runWorkflow');
assert(!declarations.includes('runWorkflowAsync'), 'Macro 声明不得导出异步入口');
assert(declarations.includes('readonly "replacement": string'), 'Macro 声明缺少 replacement 输出');
assert(
  normalizePublicInterface(ambientFacade, 'WorkflowInputs') ===
    normalizePublicInterface(declarations, 'WorkflowInputs'),
  'Macro app 类型门面与生成的 WorkflowInputs 不一致',
);
assert(
  normalizePublicInterface(ambientFacade, 'WorkflowOutputs') ===
    normalizePublicInterface(declarations, 'WorkflowOutputs'),
  'Macro app 类型门面与生成的 WorkflowOutputs 不一致',
);
assert(
  ambientFacade.includes('export function runWorkflow(inputs: WorkflowInputs): WorkflowOutputs;'),
  'Macro app 类型门面必须保持同步 runWorkflow 签名',
);

const workflowModule = await import(new URL('era-macro.js', generatedRoot));
assert(typeof workflowModule.runWorkflow === 'function', 'Macro 运行时没有导出 runWorkflow');
assert(workflowModule.runWorkflowAsync === undefined, 'Macro 运行时不得导出 runWorkflowAsync');

const report = {
  status: 'PASS',
  workflowId: manifest.workflow_id,
  entryMode: manifest.entry_mode,
  externalPackages: target.external_packages,
  toolchain: target.toolchain,
  planSha256: manifest.plan_sha256,
  files: manifest.files,
  ambientFacadeSha256: sha256(ambientFacade),
};

await writeFile(
  new URL('../../reports/macro-build-manifest.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report)}\n`);
