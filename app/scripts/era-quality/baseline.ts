import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  BaselineDiff,
  BaselineEntry,
  Finding,
  FindingSeed,
  QualityBaseline,
  QualityPolicy,
  Severity,
  Waiver,
} from './types.ts';

export const TOOL_VERSION = '1.0.0';
export const BASELINE_FILE = '.era-quality-baseline.json';
const POLICY_IMPLEMENTATION_FILES = [
  'baseline.ts',
  'comments.ts',
  'config.ts',
  'effects.ts',
  'engine.ts',
  'graph.ts',
  'report.ts',
  'source.ts',
  'structure.ts',
  'types.ts',
] as const;

export class BaselineError extends Error {}

export function stableStringify(value: unknown, space = 0): string {
  return JSON.stringify(sortValue(value), null, space);
}

export function policyDigest(
  policy: QualityPolicy,
  implementationSources: ReadonlyArray<readonly [string, string]> = readPolicyImplementationSources(),
): string {
  return sha256(
    stableStringify({
      policy,
      implementation: [...implementationSources]
        .map(([file, source]) => [file, source] as const)
        .sort(([left], [right]) => left.localeCompare(right, 'en')),
    }),
  );
}

function readPolicyImplementationSources(): Array<readonly [string, string]> {
  return POLICY_IMPLEMENTATION_FILES.map(file => [file, readFileSync(new URL(file, import.meta.url), 'utf8')] as const);
}

export function addFingerprints(findings: FindingSeed[]): Finding[] {
  const result: Finding[] = findings.map(finding => ({
    ...finding,
    fingerprint: findingFingerprint(finding),
    baselineDisposition: 'none' as const,
  }));
  const owners = new Map<string, Finding>();
  for (const finding of result) {
    const previous = owners.get(finding.fingerprint);
    if (previous) {
      throw new BaselineError(
        `finding 指纹冲突：${finding.ruleId} ${finding.path} ${finding.objectId} 与 ${previous.path} ${previous.objectId}`,
      );
    }
    owners.set(finding.fingerprint, finding);
  }
  return result;
}

export async function readBaseline(root: string): Promise<QualityBaseline | null> {
  const baselinePath = path.join(root, BASELINE_FILE);
  try {
    const parsed: unknown = JSON.parse(await readFile(baselinePath, 'utf8'));
    return validateBaseline(parsed);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new BaselineError(`${BASELINE_FILE} 不是合法 JSON：${error.message}`);
    }
    throw error;
  }
}

export function compareBaseline(
  findings: Finding[],
  baseline: QualityBaseline | null,
  policy: QualityPolicy,
  activePolicyDigest: string,
  options: { allowPolicyMismatch?: boolean } = {},
): { findings: Finding[]; diff: BaselineDiff } {
  if (
    baseline &&
    (baseline.policyDigest !== activePolicyDigest || baseline.toolVersion !== TOOL_VERSION) &&
    !options.allowPolicyMismatch
  ) {
    throw new BaselineError('质检策略或工具版本已变化，baseline 无法比较；请审核后显式迁移 baseline。');
  }

  const entries = new Map((baseline?.findings ?? []).map(entry => [entry.fingerprint, entry]));
  const seen = new Set<string>();
  let known = 0;
  let added = 0;
  let worsened = 0;
  let improved = 0;
  let waived = 0;

  const compared = findings.map(finding => {
    const waiver = matchingWaiver(finding, policy.waivers);
    if (waiver) {
      waived += 1;
      return { ...finding, baselineDisposition: 'waived' as const };
    }
    if (finding.severity === 'info') {
      return finding;
    }

    const entry = entries.get(finding.fingerprint);
    if (!entry) {
      added += 1;
      return { ...finding, baselineDisposition: 'new' as const };
    }

    seen.add(entry.fingerprint);
    const currentSeverity = severityRank(finding.severity);
    const baselineSeverity = severityRank(entry.severity);
    if (currentSeverity > baselineSeverity) {
      worsened += 1;
      return { ...finding, baselineDisposition: 'worsened' as const };
    }
    if (currentSeverity < baselineSeverity) {
      improved += 1;
      return { ...finding, baselineDisposition: 'improved' as const };
    }
    if (finding.debt > entry.debt) {
      worsened += 1;
      return { ...finding, baselineDisposition: 'worsened' as const };
    }
    if (finding.debt < entry.debt) {
      improved += 1;
      return { ...finding, baselineDisposition: 'improved' as const };
    }
    known += 1;
    return { ...finding, baselineDisposition: 'known' as const };
  });

  const resolvedEntries = [...entries.values()]
    .filter(entry => !seen.has(entry.fingerprint))
    .sort(compareBaselineEntries);

  return {
    findings: compared,
    diff: {
      known,
      new: added,
      worsened,
      improved,
      resolved: resolvedEntries.length,
      waived,
      resolvedEntries,
    },
  };
}

export async function writeBaseline(
  root: string,
  findings: Finding[],
  activePolicyDigest: string,
  previous: QualityBaseline | null,
  diff: BaselineDiff,
  options: { acceptPolicyChange?: boolean } = {},
): Promise<QualityBaseline> {
  if (
    previous &&
    (previous.policyDigest !== activePolicyDigest || previous.toolVersion !== TOOL_VERSION) &&
    !options.acceptPolicyChange
  ) {
    throw new BaselineError('策略摘要或工具版本与 baseline 不一致；只有审核变更后才能使用 --accept-policy-change。');
  }
  if (
    previous?.policyDigest === activePolicyDigest &&
    previous.toolVersion === TOOL_VERSION &&
    (diff.new > 0 || diff.worsened > 0)
  ) {
    throw new BaselineError('baseline 只能递减：请先修复新增或恶化的质量债务。');
  }

  const baseline: QualityBaseline = {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    policyDigest: activePolicyDigest,
    findings: findings
      .filter(
        finding =>
          finding.severity !== 'info' &&
          finding.baselineDisposition !== 'waived' &&
          finding.baselineDisposition !== 'resolved',
      )
      .map(finding => ({
        fingerprint: finding.fingerprint,
        ruleId: finding.ruleId,
        objectId: finding.objectId,
        severity: finding.severity as BaselineEntry['severity'],
        debt: finding.debt,
      }))
      .sort(compareBaselineEntries),
  };

  await writeFile(path.join(root, BASELINE_FILE), `${stableStringify(baseline, 2)}\n`, 'utf8');
  return baseline;
}

function findingFingerprint(finding: FindingSeed): string {
  // Threshold debt must keep the same identity when its observed value changes,
  // otherwise a 90→100 line function would look like “resolved + new” instead
  // of a worsened finding. Comment findings need normalized evidence because one
  // source object can legitimately carry several independent comments.
  const evidence =
    finding.objectType === 'comment' ? (finding.evidenceKey ?? stableStringify(finding.details ?? {})) : '';
  const identityPath = finding.objectType === 'dependency-chain' ? '.' : toPosix(finding.path);
  return sha256([finding.ruleId, identityPath, finding.objectId, evidence].join('\0'));
}

function matchingWaiver(finding: Finding, waivers: Waiver[]): Waiver | undefined {
  return waivers.find(waiver => {
    if (waiver.ruleId !== finding.ruleId || toPosix(waiver.path) !== toPosix(finding.path)) {
      return false;
    }
    if (waiver.objectId !== finding.objectId) {
      return false;
    }
    if (waiver.expires < new Date().toISOString().slice(0, 10)) {
      return false;
    }
    return true;
  });
}

function validateBaseline(value: unknown): QualityBaseline {
  if (!value || typeof value !== 'object') {
    throw new BaselineError(`${BASELINE_FILE} 必须是对象。`);
  }
  const candidate = value as Partial<QualityBaseline>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.toolVersion !== 'string' ||
    typeof candidate.policyDigest !== 'string' ||
    !Array.isArray(candidate.findings)
  ) {
    throw new BaselineError(`${BASELINE_FILE} schema 无效。`);
  }
  for (const entry of candidate.findings) {
    if (
      !entry ||
      typeof entry.fingerprint !== 'string' ||
      typeof entry.ruleId !== 'string' ||
      typeof entry.objectId !== 'string' ||
      !['error', 'warning'].includes(entry.severity) ||
      typeof entry.debt !== 'number'
    ) {
      throw new BaselineError(`${BASELINE_FILE} 包含无效 finding。`);
    }
  }
  return candidate as QualityBaseline;
}

function compareBaselineEntries(left: BaselineEntry, right: BaselineEntry): number {
  return (
    left.ruleId.localeCompare(right.ruleId) ||
    left.objectId.localeCompare(right.objectId) ||
    left.fingerprint.localeCompare(right.fingerprint)
  );
}

function severityRank(severity: Severity): number {
  if (severity === 'error') {
    return 2;
  }
  if (severity === 'warning') {
    return 1;
  }
  return 0;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
