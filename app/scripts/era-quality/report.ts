import type { Finding, QualityReport } from './types.ts';
import { stableStringify } from './baseline.ts';

export function sortFindings(findings: Finding[]): Finding[] {
  const severityOrder = { error: 0, warning: 1, info: 2 };
  return [...findings].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.column - right.column ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.objectId.localeCompare(right.objectId) ||
      left.fingerprint.localeCompare(right.fingerprint),
  );
}

export function formatJson(report: QualityReport): string {
  return `${stableStringify(report, 2)}\n`;
}

export function formatText(report: QualityReport, options: { maxFindings?: number } = {}): string {
  const lines = [
    `${statusIcon(report.status)} ERA Quality: ${report.status}`,
    `扫描 ${report.summary.files} 个文件；${report.summary.errors} errors，${report.summary.warnings} warnings，${report.summary.infos} infos`,
    `基线：${report.summary.baselineKnown} 已知，${report.summary.newFindings} 新增，${report.summary.worsenedFindings} 恶化，${report.summary.improvedFindings} 改善，${report.summary.resolvedFindings} 已解决`,
    `注释：${report.metrics.comments.chinese}/${report.metrics.comments.naturalLanguage} 个自然语言注释含中文；有效中文注释行 ${report.metrics.comments.usefulChineseLines}，脚本代码行 ${report.metrics.comments.scriptCodeLines}`,
    `依赖：最长运行时链 ${report.metrics.dependencyGraph.longestRuntimeChain.length}，环 ${report.metrics.dependencyGraph.cycles.length}`,
  ];

  const actionable = report.findings.filter(
    finding => finding.baselineDisposition !== 'known' && finding.baselineDisposition !== 'waived',
  );
  const knownCount = report.findings.length - actionable.length;
  const limit = Math.max(0, options.maxFindings ?? 200);
  const shown = actionable.slice(0, limit);

  if (shown.length > 0) {
    lines.push('');
    lines.push(...shown.map(formatFinding));
  }
  if (actionable.length > shown.length) {
    lines.push(`… 其余 ${actionable.length - shown.length} 条未显示；可使用 --format json 查看完整结果。`);
  }
  if (knownCount > 0) {
    lines.push(`已登记或豁免的 finding：${knownCount} 条。使用 pnpm quality:audit 查看完整债务。`);
  }
  if (report.baselineDiff.resolvedEntries.length > 0) {
    lines.push('');
    lines.push('baseline 中已经消失的债务：');
    for (const entry of report.baselineDiff.resolvedEntries.slice(0, limit)) {
      lines.push(`  ✓ ${entry.ruleId} ${entry.objectId}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatFinding(finding: Finding): string {
  const disposition = finding.baselineDisposition === 'none' ? '' : ` [${finding.baselineDisposition.toUpperCase()}]`;
  const location = `${finding.path}:${finding.line}:${finding.column}`;
  return `${severityIcon(finding.severity)} ${location} ${finding.ruleId}${disposition}\n  ${finding.message}\n  建议：${finding.suggestedFix}`;
}

function statusIcon(status: QualityReport['status']): string {
  if (status === 'PASS') return '✓';
  if (status === 'CONCERNS') return '!';
  if (status === 'FAIL') return '✗';
  return '‼';
}

function severityIcon(severity: Finding['severity']): string {
  if (severity === 'error') return 'E';
  if (severity === 'warning') return 'W';
  return 'I';
}
