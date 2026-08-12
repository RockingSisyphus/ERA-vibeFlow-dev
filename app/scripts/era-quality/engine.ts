import path from 'node:path';

import {
  addFingerprints,
  compareBaseline,
  policyDigest,
  readBaseline,
  TOOL_VERSION,
  writeBaseline,
} from './baseline.ts';
import { commentFindings } from './comments.ts';
import { loadPolicy } from './config.ts';
import { effectFindings } from './effects.ts';
import { architectureFindings, buildDependencyGraph, dependencyFindings } from './graph.ts';
import { sortFindings } from './report.ts';
import { parseProject } from './source.ts';
import { structureFindings } from './structure.ts';
import type { BaselineDiff, Finding, QualityReport, QualityStatus } from './types.ts';

export interface RunQualityOptions {
  useBaseline?: boolean;
  writeBaseline?: boolean;
  acceptPolicyChange?: boolean;
}

export interface RunQualityResult {
  report: QualityReport;
  baselineWritten: boolean;
}

export async function runQuality(requestedRoot: string, options: RunQualityOptions = {}): Promise<RunQualityResult> {
  if (options.writeBaseline === true && options.useBaseline === false) {
    throw new Error('写入 baseline 时禁止使用 useBaseline: false；必须先读取旧债务才能保证只能递减。');
  }
  const root = path.resolve(requestedRoot);
  const useBaseline = options.useBaseline ?? true;
  const policy = await loadPolicy(root);
  const digest = policyDigest(policy);
  const files = await parseProject(root, policy);
  if (files.length === 0) {
    throw new Error('ERA Quality 没有扫描到任何 .ts 或 .vue 文件；为防止空扫描误报 PASS，检查已终止。');
  }

  const graph = buildDependencyGraph(files);
  const comments = commentFindings(files, policy);
  const qualitySeeds = [
    ...structureFindings(files, policy),
    ...dependencyFindings(files, graph, policy),
    ...architectureFindings(files, graph, policy),
    ...effectFindings(files, graph, policy),
    ...comments.findings,
  ];
  const previousBaseline = useBaseline ? await readBaseline(root) : null;
  const baselineStale =
    previousBaseline !== null &&
    (previousBaseline.policyDigest !== digest || previousBaseline.toolVersion !== TOOL_VERSION);
  const acceptingMigration = options.writeBaseline === true && options.acceptPolicyChange === true;
  const seeds = [
    ...qualitySeeds,
    ...(baselineStale && !acceptingMigration
      ? [
          {
            ruleId: 'BASELINE_POLICY_MISMATCH',
            severity: 'error' as const,
            category: 'tool' as const,
            objectType: 'baseline',
            objectId: '.era-quality-baseline.json',
            path: '.era-quality-baseline.json',
            line: 1,
            column: 1,
            observed: `${previousBaseline.toolVersion}:${previousBaseline.policyDigest}`,
            limit: `${TOOL_VERSION}:${digest}`,
            debt: 1,
            message: 'baseline 对应的质检策略或工具版本已经过期，不能继续作为当前门禁依据。',
            suggestedFix: '审核规则变化后运行 pnpm quality:baseline -- --accept-policy-change 显式迁移。',
          },
        ]
      : []),
  ];
  const fingerprinted = addFingerprints(seeds);

  let compared: { findings: Finding[]; diff: BaselineDiff };
  if (acceptingMigration && baselineStale) {
    compared = compareBaseline(fingerprinted, null, policy, digest);
  } else {
    compared = compareBaseline(fingerprinted, previousBaseline, policy, digest, {
      allowPolicyMismatch: baselineStale,
    });
  }

  let baselineWritten = false;
  if (options.writeBaseline && (!baselineStale || acceptingMigration)) {
    const baseline = await writeBaseline(root, compared.findings, digest, previousBaseline, compared.diff, {
      acceptPolicyChange: options.acceptPolicyChange,
    });
    compared = compareBaseline(fingerprinted, baseline, policy, digest);
    baselineWritten = true;
  }

  const findings = sortFindings(compared.findings);
  const status = determineStatus(findings, compared.diff, useBaseline);
  return {
    report: {
      schemaVersion: 1,
      tool: {
        name: 'era-quality',
        version: TOOL_VERSION,
        policyDigest: digest,
      },
      status,
      root: root.replaceAll('\\', '/'),
      summary: {
        files: files.length,
        errors: findings.filter(finding => finding.severity === 'error').length,
        warnings: findings.filter(finding => finding.severity === 'warning').length,
        infos: findings.filter(finding => finding.severity === 'info').length,
        baselineKnown: compared.diff.known,
        newFindings: compared.diff.new,
        worsenedFindings: compared.diff.worsened,
        improvedFindings: compared.diff.improved,
        resolvedFindings: compared.diff.resolved,
      },
      metrics: {
        files: files.length,
        comments: comments.metrics,
        dependencyGraph: graph,
      },
      findings,
      baselineDiff: compared.diff,
    },
    baselineWritten,
  };
}

function determineStatus(findings: Finding[], diff: BaselineDiff, useBaseline: boolean): QualityStatus {
  if (useBaseline && (diff.new > 0 || diff.worsened > 0 || diff.improved > 0 || diff.resolved > 0)) {
    return 'FAIL';
  }
  if (findings.length > 0) {
    return 'CONCERNS';
  }
  return 'PASS';
}
