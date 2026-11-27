/** 按真实依赖顺序重建本地公开包，更新消费者锁文件，再供AOT及App使用。 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export function buildRuntimePackages() {
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  const temporary = mkdtempSync(resolve(root, 'reports/.runtime-packages-'));
  const buildEnv = { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary };
  function run(command, args, directory) {
    const result = spawnSync(command, args, {
      cwd: resolve(root, directory),
      env: buildEnv,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${directory}: ${command} ${args.join(' ')} failed (${result.status})`);
  }
  function pack(directory) {
    run('npm', ['pack', '--ignore-scripts'], directory);
  }
  function refresh(directory, dependencies) {
    const manifestPath = resolve(root, directory, 'package.json');
    const peers = JSON.parse(readFileSync(manifestPath, 'utf8')).peerDependencies;
    run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...dependencies], directory);
    // npm 对同名开发依赖的文件安装也会改写 peer 范围；保留公开兼容范围。
    if (peers)
      for (const filename of ['package.json', 'package-lock.json']) {
        const path = resolve(root, directory, filename);
        const value = JSON.parse(readFileSync(path, 'utf8'));
        (filename === 'package.json' ? value : value.packages['']).peerDependencies = peers;
        writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
      }
  }
  try {
    run(process.execPath, ['scripts/sync-macro-schemas.mjs'], 'packages/era-contracts');
    run(process.execPath, ['scripts/check-schema-sync.mjs'], 'packages/era-contracts');
    pack('packages/era-contracts');
    pack('packages/era-example-resources');
    const examples = JSON.parse(readFileSync(resolve(root, 'packages/era-example-resources/package.json'), 'utf8'));
    const examplesArchive = `../../packages/era-example-resources/era-example-resources-${examples.version}.tgz`;
    for (const directory of ['era-floor-snapshot', 'era-macro-syntax', 'era-workbench']) {
      run(process.execPath, ['build.mjs'], `packages/${directory}`);
      pack(`packages/${directory}`);
    }
    run(process.execPath, ['scripts/build-package.mjs'], 'javascript_project/expression');
    pack('javascript_project/expression');
    const expression = JSON.parse(readFileSync(resolve(root, 'javascript_project/expression/package.json'), 'utf8'));
    const expressionArchive = `era-vibeflow-expression-${expression.version}.tgz`;
    refresh('javascript_project/compaction', [`../expression/${expressionArchive}`]);
    run(process.execPath, ['scripts/build-package.mjs'], 'javascript_project/compaction');
    pack('javascript_project/compaction');
    const compaction = JSON.parse(readFileSync(resolve(root, 'javascript_project/compaction/package.json'), 'utf8'));
    const contracts = JSON.parse(readFileSync(resolve(root, 'packages/era-contracts/package.json'), 'utf8'));
    const contractsArchive = `../../packages/era-contracts/era-vibeflow-contracts-${contracts.version}.tgz`;
    refresh('javascript_project/service', [
      `../expression/${expressionArchive}`,
      `../compaction/era-vibeflow-command-compaction-${compaction.version}.tgz`,
      contractsArchive,
      examplesArchive,
    ]);
    for (const name of ['macro', 'tavern']) refresh(`javascript_project/${name}`, [contractsArchive]);
    // 显式重新安装这四个本地包；不使用update，以免重新解析无关开发依赖。
    const appManifest = resolve(root, 'app/package.json');
    const app = JSON.parse(readFileSync(appManifest, 'utf8'));
    app.dependencies[compaction.name] = `file:../javascript_project/compaction/era-vibeflow-command-compaction-${compaction.version}.tgz`;
    app.dependencies[expression.name] = `file:../javascript_project/expression/${expressionArchive}`;
    const names = [
      expression.name,
      compaction.name,
      examples.name,
      '@era/vibeflow-floor-snapshot',
      '@era/vibeflow-macro-syntax',
      '@era/vibeflow-workbench',
    ];
    run('pnpm', ['add', '--offline', ...names.map(name => app.dependencies[name].replace(/^file:/u, ''))], 'app');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) buildRuntimePackages();
