import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addFingerprints,
  BaselineError,
  compareBaseline,
  policyDigest,
  readBaseline,
  writeBaseline,
} from '../baseline.ts';
import type { FindingSeed, QualityBaseline, QualityPolicy } from '../types.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('baseline ratchet', () => {
  it('policy digest 同时覆盖配置与规则实现源码', () => {
    const policy = testPolicy();
    const first = policyDigest(policy, [['rules.ts', 'return allFindings;']]);
    const weakened = policyDigest(policy, [['rules.ts', 'return [];']]);

    expect(weakened).not.toBe(first);
    expect(policyDigest(policy, [['rules.ts', 'return allFindings;']])).toBe(first);
  });

  it('fingerprint 与行号无关', () => {
    const first = addFingerprints([seed({ line: 10 })])[0];
    const moved = addFingerprints([seed({ line: 99, observed: 9, debt: 8, evidenceKey: 'changed-observation' })])[0];
    expect(first.fingerprint).toBe(moved.fingerprint);
  });

  it('全局最长依赖链更换起点时仍保持同一 baseline 身份', () => {
    const first = addFingerprints([
      seed({
        ruleId: 'DEPENDENCY_CHAIN',
        objectType: 'dependency-chain',
        objectId: 'runtime-dependency-chain',
        path: 'src/a.ts',
      }),
    ])[0];
    const changedStart = addFingerprints([
      seed({
        ruleId: 'DEPENDENCY_CHAIN',
        objectType: 'dependency-chain',
        objectId: 'runtime-dependency-chain',
        path: 'src/other.ts',
        debt: 2,
      }),
    ])[0];

    expect(changedStart.fingerprint).toBe(first.fingerprint);
  });

  it('区分已知、新增、恶化、改善和已解决 finding', () => {
    const policy = testPolicy();
    const digest = policyDigest(policy);
    const known = addFingerprints([seed({ objectId: 'known', debt: 2 })])[0];
    const worsened = addFingerprints([seed({ objectId: 'worse', debt: 3 })])[0];
    const improved = addFingerprints([seed({ objectId: 'better', debt: 1 })])[0];
    const added = addFingerprints([seed({ objectId: 'new' })])[0];
    const resolved = addFingerprints([seed({ objectId: 'gone' })])[0];
    const baseline: QualityBaseline = {
      schemaVersion: 1,
      toolVersion: '1.0.0',
      policyDigest: digest,
      findings: [entry(known, 2), entry(worsened, 2), entry(improved, 2), entry(resolved, 1)],
    };

    const result = compareBaseline([known, worsened, improved, added], baseline, policy, digest);
    expect(result.diff).toMatchObject({
      known: 1,
      new: 1,
      worsened: 1,
      improved: 1,
      resolved: 1,
    });
  });

  it('把 warning 升级为 error 视为恶化，而不是可写回的改善', () => {
    const policy = testPolicy();
    const digest = policyDigest(policy);
    const warning = addFingerprints([seed({ severity: 'warning', debt: 1 })])[0];
    const error = addFingerprints([seed({ severity: 'error', debt: 1 })])[0];
    const baseline: QualityBaseline = {
      schemaVersion: 1,
      toolVersion: '1.0.0',
      policyDigest: digest,
      findings: [entry(warning, 1)],
    };

    const result = compareBaseline([error], baseline, policy, digest);
    expect(result.findings[0].baselineDisposition).toBe('worsened');
    expect(result.diff).toMatchObject({ worsened: 1, improved: 0 });

    const errorBaseline: QualityBaseline = {
      ...baseline,
      findings: [{ ...entry(error, 1), severity: 'error' }],
    };
    const warningWithLargerBandDebt = addFingerprints([seed({ severity: 'warning', debt: 51 })])[0];
    const improved = compareBaseline([warningWithLargerBandDebt], errorBaseline, policy, digest);
    expect(improved.findings[0].baselineDisposition).toBe('improved');
  });

  it('已有 baseline 时拒绝登记新增债务', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'era-quality-baseline-'));
    temporaryDirectories.push(directory);
    const policy = testPolicy();
    const digest = policyDigest(policy);
    const finding = addFingerprints([seed({ objectId: 'new' })])[0];
    const previous: QualityBaseline = {
      schemaVersion: 1,
      toolVersion: '1.0.0',
      policyDigest: digest,
      findings: [],
    };

    await expect(
      writeBaseline(directory, [{ ...finding, baselineDisposition: 'new' }], digest, previous, {
        known: 0,
        new: 1,
        worsened: 0,
        improved: 0,
        resolved: 0,
        waived: 0,
        resolvedEntries: [],
      }),
    ).rejects.toBeInstanceOf(BaselineError);
  });

  it('策略摘要或工具版本不一致时拒绝静默比较', () => {
    const policy = testPolicy();
    const digest = policyDigest(policy);
    const finding = addFingerprints([seed()])[0];
    const mismatched: QualityBaseline = {
      schemaVersion: 1,
      toolVersion: '0.9.0',
      policyDigest: digest,
      findings: [entry(finding, 1)],
    };

    expect(() => compareBaseline([finding], mismatched, policy, digest)).toThrow(BaselineError);
    expect(() =>
      compareBaseline([finding], { ...mismatched, toolVersion: '1.0.0', policyDigest: 'changed' }, policy, digest),
    ).toThrow(BaselineError);
  });

  it('允许把改善和已解决债务递减写回，并保持稳定排序', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'era-quality-baseline-'));
    temporaryDirectories.push(directory);
    const policy = testPolicy();
    const digest = policyDigest(policy);
    const improved = addFingerprints([seed({ ruleId: 'Z_RULE', objectId: 'better', debt: 1 })])[0];
    const resolved = addFingerprints([seed({ ruleId: 'A_RULE', objectId: 'gone', debt: 1 })])[0];
    const previous: QualityBaseline = {
      schemaVersion: 1,
      toolVersion: '1.0.0',
      policyDigest: digest,
      findings: [entry(improved, 2), entry(resolved, 1)],
    };
    const compared = compareBaseline([improved], previous, policy, digest);

    await writeBaseline(directory, compared.findings, digest, previous, compared.diff);
    const first = await readFile(path.join(directory, '.era-quality-baseline.json'), 'utf8');
    const written = await readBaseline(directory);
    expect(written?.findings).toEqual([entry(improved, 1)]);

    const secondCompared = compareBaseline([improved], written, policy, digest);
    await writeBaseline(directory, secondCompared.findings, digest, written, secondCompared.diff);
    const second = await readFile(path.join(directory, '.era-quality-baseline.json'), 'utf8');
    expect(second).toBe(first);
  });

  it('只对未过期且精确匹配的配置豁免生效', () => {
    const [finding, expiredFinding] = addFingerprints([
      seed({ ruleId: 'COMMENT_TEST', objectId: 'target' }),
      seed({ ruleId: 'COMMENT_TEST', objectId: 'expired', path: 'src/other.ts' }),
    ]);
    const policy = testPolicy();
    policy.waivers = [
      {
        ruleId: 'COMMENT_TEST',
        path: 'src/ERA变量框架/example.ts',
        objectId: 'target',
        reason: '因为该兼容契约必须保留到迁移验收完成',
        expires: '2999-12-31',
      },
      {
        ruleId: 'COMMENT_TEST',
        path: 'src/other.ts',
        objectId: 'expired',
        reason: '因为旧实现尚未完成迁移',
        expires: '2000-01-01',
      },
    ];
    const digest = policyDigest(policy);

    const result = compareBaseline([finding, expiredFinding], null, policy, digest);
    expect(result.findings[0].baselineDisposition).toBe('waived');
    expect(result.findings[1].baselineDisposition).toBe('new');
    expect(result.diff).toMatchObject({ waived: 1, new: 1 });
  });

  it('首次初始化写出稳定 baseline', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'era-quality-baseline-'));
    temporaryDirectories.push(directory);
    const policy = testPolicy();
    const digest = policyDigest(policy);
    const finding = addFingerprints([seed({ objectId: 'known' })])[0];

    await writeBaseline(directory, [{ ...finding, baselineDisposition: 'new' }], digest, null, {
      known: 0,
      new: 1,
      worsened: 0,
      improved: 0,
      resolved: 0,
      waived: 0,
      resolvedEntries: [],
    });

    const content = await readFile(path.join(directory, '.era-quality-baseline.json'), 'utf8');
    expect(content).toContain('"schemaVersion": 1');
    expect(content).toContain(finding.fingerprint);
  });
});

function seed(overrides: Partial<FindingSeed> = {}): FindingSeed {
  return {
    ruleId: 'QUALITY.TEST',
    severity: 'warning',
    category: 'tool',
    objectType: 'function',
    objectId: 'fixture',
    path: 'src/ERA变量框架/example.ts',
    line: 1,
    column: 1,
    observed: 2,
    limit: 1,
    debt: 1,
    message: '测试 finding',
    suggestedFix: '修复测试代码。',
    evidenceKey: 'stable-evidence',
    ...overrides,
  };
}

function entry(finding: ReturnType<typeof addFingerprints>[number], debt: number) {
  return {
    fingerprint: finding.fingerprint,
    ruleId: finding.ruleId,
    objectId: finding.objectId,
    severity: 'warning' as const,
    debt,
  };
}

function testPolicy(): QualityPolicy {
  return {
    schemaVersion: 1,
    include: ['src/**/*.ts'],
    thresholds: {
      warnFileLines: 450,
      maxFileLines: 500,
      maxFileBytes: 120000,
      maxFunctionsPerFile: 40,
      maxClassesPerFile: 20,
      maxExportsPerFile: 30,
      maxFileBranches: 150,
      maxDirectoryFanout: 25,
      maxDirectoryFanin: 25,
      maxFunctionLines: 80,
      maxFunctionBranches: 12,
      maxFunctionNesting: 4,
      maxFunctionParams: 6,
      warnDependencyChain: 6,
      maxDependencyChain: 10,
      minDuplicateFunctionLines: 10,
    },
    comments: {
      minimumHanForUseful: 4,
      largeFileCodeLines: 100,
      minimumUsefulRatio: 0.05,
      highUsefulRatio: 0.4,
      moduleDocCodeLines: 150,
      moduleDocExports: 10,
      minimumModuleDocHan: 12,
      minimumCriticalDocHan: 12,
      minimumTypeDocHan: 8,
      exportedFunctionLines: 10,
      exportedFunctionBranches: 3,
      criticalFunctionLines: 50,
      criticalFunctionBranches: 12,
      criticalFunctionNesting: 4,
      criticalFunctionParams: 6,
      disabledBlockLines: 5,
      disabledBlockCodeRatio: 0.6,
      duplicateProseHan: 20,
      rationaleWords: ['因为'],
      historyWords: ['新增'],
    },
    architecture: {
      forbiddenImports: [],
      purePaths: [],
      schedulerPath: 'scheduler.ts',
      schedulerClockObject: 'SYSTEM_CLOCK',
    },
    capabilities: {
      domUi: [],
      storage: [],
      network: [],
      clockRandom: [],
      allowedGlobals: ['console'],
    },
    waivers: [],
  };
}
