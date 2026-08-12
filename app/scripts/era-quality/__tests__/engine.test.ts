import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runQuality } from '../engine.ts';
import { formatJson } from '../report.ts';
import type { QualityPolicy } from '../types.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('quality engine', () => {
  it('初始 baseline 通过，并阻止新增英文自然语言注释', async () => {
    const root = await fixtureRoot();
    const sourcePath = path.join(root, 'src/example.ts');
    await writeFile(sourcePath, 'export const value = 1;\n');

    const initialized = await runQuality(root, { writeBaseline: true });
    expect(initialized.baselineWritten).toBe(true);
    expect(initialized.report.status).toBe('PASS');

    await writeFile(sourcePath, 'export const value = 1;\n// This comment explains the visible state.\n');
    const regressed = await runQuality(root);

    expect(regressed.report.status).toBe('FAIL');
    expect(regressed.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_CHINESE_PRIMARY',
          baselineDisposition: 'new',
        }),
      ]),
    );
  });

  it('增加大量空行和合格中文注释不会制造代码行数债务', async () => {
    const root = await fixtureRoot();
    const sourcePath = path.join(root, 'src/example.ts');
    await writeFile(sourcePath, 'export const value = 1;\n');
    await runQuality(root, { writeBaseline: true });

    await writeFile(
      sourcePath,
      `export const value = 1;\n// 因为需要解释稳定契约，所以保留这条中文说明。\n${'\n'.repeat(600)}`,
    );
    const checked = await runQuality(root);

    expect(checked.report.status).toBe('PASS');
    expect(checked.report.findings.map(finding => finding.ruleId)).not.toContain('STRUCT_FILE_LINES');
  });

  it('阻止新增高风险无文档函数、注释实现、依赖环和纯模块副作用', async () => {
    const criticalRoot = await fixtureRoot();
    const criticalPath = path.join(criticalRoot, 'src/example.ts');
    await writeFile(criticalPath, 'export const value = 1;\n');
    await runQuality(criticalRoot, { writeBaseline: true });
    await writeFile(
      criticalPath,
      [
        'export function execute(value: string) {',
        '  let result = value;',
        '  result += value;',
        '  result += value;',
        '  result += value;',
        '  result += value;',
        '  result += value;',
        '  result += value;',
        '  result += value;',
        '  result += value;',
        '  return result;',
        '}',
      ].join('\n'),
    );
    expect((await runQuality(criticalRoot)).report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_CRITICAL_DOC_MISSING',
          baselineDisposition: 'new',
        }),
      ]),
    );

    const disabledRoot = await fixtureRoot();
    const disabledPath = path.join(disabledRoot, 'src/example.ts');
    await writeFile(disabledPath, 'export const value = 1;\n');
    await runQuality(disabledRoot, { writeBaseline: true });
    await writeFile(
      disabledPath,
      [
        'export const value = 1;',
        '// const oldValue = getValue();',
        '// if (oldValue) {',
        '// updateValue(oldValue);',
        '// return oldValue;',
        '// }',
      ].join('\n'),
    );
    expect((await runQuality(disabledRoot)).report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_DISABLED_CODE',
          severity: 'error',
          baselineDisposition: 'new',
        }),
      ]),
    );

    const cycleRoot = await fixtureRoot();
    await writeFile(path.join(cycleRoot, 'src/a.ts'), "import './b';\nexport const a = 1;\n");
    await writeFile(path.join(cycleRoot, 'src/b.ts'), 'export const b = 1;\n');
    await runQuality(cycleRoot, { writeBaseline: true });
    await writeFile(path.join(cycleRoot, 'src/b.ts'), "import './a';\nexport const b = 1;\n");
    expect((await runQuality(cycleRoot)).report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'DEPENDENCY_CYCLE',
          severity: 'error',
          baselineDisposition: 'new',
        }),
      ]),
    );

    const effectRoot = await fixtureRoot(policy => {
      policy.architecture.purePaths = ['src/pure.ts'];
    });
    const effectPath = path.join(effectRoot, 'src/pure.ts');
    await writeFile(effectPath, 'export const value = 1;\n');
    await runQuality(effectRoot, { writeBaseline: true });
    await writeFile(effectPath, "export const value = getVariables({ type: 'chat' });\n");
    expect((await runQuality(effectRoot)).report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'PURE_MODULE_SIDE_EFFECT',
          severity: 'error',
          baselineDisposition: 'new',
        }),
      ]),
    );

    const maskedEffectRoot = await fixtureRoot(policy => {
      policy.architecture.purePaths = ['src/pure.ts'];
    });
    const maskedEffectPath = path.join(maskedEffectRoot, 'src/pure.ts');
    await writeFile(maskedEffectPath, "export const first = getVariables({ type: 'chat' });\n");
    await runQuality(maskedEffectRoot, { writeBaseline: true });
    await writeFile(
      maskedEffectPath,
      [
        "export const first = getVariables({ type: 'chat' });",
        "export const second = localStorage.getItem('era');",
      ].join('\n'),
    );
    expect((await runQuality(maskedEffectRoot)).report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'PURE_MODULE_SIDE_EFFECT',
          observed: 'STORAGE',
          debt: 2,
          baselineDisposition: 'worsened',
        }),
      ]),
    );

    const multiEffectRoot = await fixtureRoot();
    await writeFile(
      path.join(multiEffectRoot, 'src/multi-effect.ts'),
      [
        "import axios from 'axios';",
        "import toastr from 'toastr';",
        'export function notify() {',
        "  axios.get('/status');",
        "  toastr.info('done');",
        '}',
      ].join('\n'),
    );
    expect((await runQuality(multiEffectRoot, { useBaseline: false })).report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'COMMENT_CRITICAL_DOC_MISSING',
          details: { reasons: ['跨越 2 类副作用'] },
        }),
      ]),
    );
  });

  it('同一工作树 JSON 逐字节稳定，并且已登记债务为 CONCERNS', async () => {
    const root = await fixtureRoot();
    await writeFile(
      path.join(root, 'src/example.ts'),
      '// This explains the visible state.\nexport const value = 1;\n',
    );
    const initialized = await runQuality(root, { writeBaseline: true });
    expect(initialized.report.status).toBe('CONCERNS');

    const first = formatJson((await runQuality(root)).report);
    const second = formatJson((await runQuality(root)).report);
    expect(second).toBe(first);
    expect(first).not.toMatch(/timestamp|createdAt|generatedAt/iu);
  });

  it('CLI 对 PASS、FAIL、ERROR 与 audit 分别返回规定退出码', async () => {
    const root = await fixtureRoot();
    const sourcePath = path.join(root, 'src/example.ts');
    await writeFile(sourcePath, 'export const value = 1;\n');
    await runQuality(root, { writeBaseline: true });

    const passed = await runCli(root);
    expect(passed.exitCode).toBe(0);
    expect(JSON.parse(passed.stdout)).toMatchObject({ status: 'PASS' });

    const baselinePath = path.join(root, '.era-quality-baseline.json');
    const baselineBeforeConflict = await readFile(baselinePath, 'utf8');
    const conflicted = await runCli(root, ['--write-baseline', '--no-baseline']);
    expect(conflicted.exitCode).toBe(2);
    expect(JSON.parse(conflicted.stdout)).toMatchObject({
      status: 'ERROR',
      findings: [expect.objectContaining({ ruleId: 'TOOL_ERROR' })],
    });
    expect(await readFile(baselinePath, 'utf8')).toBe(baselineBeforeConflict);
    await expect(runQuality(root, { writeBaseline: true, useBaseline: false })).rejects.toThrow(
      /禁止使用 useBaseline: false/u,
    );

    await writeFile(sourcePath, 'export const value = 1;\n// This comment explains the state.\n');
    const failed = await runCli(root);
    expect(failed.exitCode).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject({ status: 'FAIL' });

    const audited = await runCli(root, ['--no-baseline']);
    expect(audited.exitCode).toBe(0);
    expect(JSON.parse(audited.stdout)).toMatchObject({ status: 'CONCERNS' });

    const missingRoot = await mkdtemp(path.join(tmpdir(), 'era-quality-error-'));
    temporaryDirectories.push(missingRoot);
    const errored = await runCli(missingRoot);
    expect(errored.exitCode).toBe(2);
    expect(JSON.parse(errored.stdout)).toMatchObject({
      status: 'ERROR',
      findings: [expect.objectContaining({ ruleId: 'TOOL_ERROR' })],
    });

    const staleRoot = await fixtureRoot();
    await writeFile(path.join(staleRoot, 'src/example.ts'), 'export const value = 1;\n');
    await runQuality(staleRoot, { writeBaseline: true });
    const configPath = path.join(staleRoot, 'era-quality.config.json');
    const changedPolicy = JSON.parse(await readFile(configPath, 'utf8')) as QualityPolicy;
    changedPolicy.thresholds.maxFunctionLines += 1;
    await writeFile(configPath, JSON.stringify(changedPolicy));

    const stale = await runCli(staleRoot);
    expect(stale.exitCode).toBe(1);
    expect(JSON.parse(stale.stdout)).toMatchObject({
      status: 'FAIL',
      findings: [expect.objectContaining({ ruleId: 'BASELINE_POLICY_MISMATCH' })],
    });

    const refusedMigration = await runQuality(staleRoot, { writeBaseline: true });
    expect(refusedMigration).toMatchObject({ baselineWritten: false, report: { status: 'FAIL' } });
    const acceptedMigration = await runQuality(staleRoot, {
      writeBaseline: true,
      acceptPolicyChange: true,
    });
    expect(acceptedMigration).toMatchObject({ baselineWritten: true, report: { status: 'PASS' } });
  });

  it('拒绝缺少精确文件或对象边界的批量豁免', async () => {
    const root = await fixtureRoot();
    await writeFile(path.join(root, 'src/example.ts'), 'export const value = 1;\n');
    const configPath = path.join(root, 'era-quality.config.json');
    const policy = JSON.parse(await readFile(configPath, 'utf8')) as QualityPolicy;
    policy.waivers = [
      {
        ruleId: 'COMMENT_CHINESE_PRIMARY',
        path: 'src/**/*.ts',
        objectId: 'comment:any',
        reason: '因为正在迁移所以暂时保留',
        expires: '2999-12-31',
      },
    ];
    await writeFile(configPath, JSON.stringify(policy));

    await expect(runQuality(root)).rejects.toThrow(/豁免路径必须是精确文件路径/u);
  });
});

async function fixtureRoot(changePolicy?: (policy: QualityPolicy) => void): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'era-quality-engine-'));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, 'src'));
  await writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
      },
      include: ['src'],
    }),
  );

  const policy = JSON.parse(
    await readFile(path.join(process.cwd(), 'era-quality.config.json'), 'utf8'),
  ) as QualityPolicy;
  policy.include = ['src/**/*.ts'];
  policy.architecture.forbiddenImports = [];
  policy.architecture.purePaths = [];
  policy.architecture.schedulerPath = 'src/scheduler.ts';
  changePolicy?.(policy);
  await writeFile(path.join(root, 'era-quality.config.json'), JSON.stringify(policy));
  return root;
}

async function runCli(root: string, extraArguments: string[] = []): Promise<{ exitCode: number; stdout: string }> {
  const script = path.join(process.cwd(), 'scripts/era-quality/cli.ts');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--root', root, '--format', 'json', ...extraArguments], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code === null) {
        reject(new Error(`ERA Quality CLI 被信号终止：${stderr}`));
        return;
      }
      resolve({ exitCode: code, stdout });
    });
  });
}
