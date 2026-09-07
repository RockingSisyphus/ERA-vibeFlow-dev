import { describe, expect, it } from 'vitest';
import {
  agentReportAttempts,
  agentReportRequests,
  canRetryAgentReport,
  formatAgentViewerValue,
  readAgentReport,
} from '../../src/ERA变量框架/service/agent-report-view-model';

describe('Agent report presentation', () => {
  it('flattens real requests, deduplicates render revisions, and separates manual executions from correction attempts', () => {
    const entry = (id: string, executionId: string, intent: string, attemptIndex = 0) => ({
      requestId: id,
      status: 'passed',
      requestContext: { executionId, trigger: 'manual-settlement', intent, attemptIndex },
    });
    const first = JSON.stringify({ attempts: [entry('a', 'one', 'initial')] });
    const corrected = JSON.stringify({ attempts: [entry('a', 'one', 'initial'), entry('b', 'one', 'correction', 1)] });
    const second = JSON.stringify({ attempts: [entry('c', 'two', 'initial')] });
    const requests = agentReportRequests(second, [first, corrected, corrected], 'settlement');
    expect(requests.map(item => item.key)).toEqual(['c', 'b', 'a']);
    expect(requests.map(item => item.label)).toEqual([
      '手动重新解析 2 · 首次请求：成功',
      '手动重新解析 1 · 错误修正 1：成功',
      '手动重新解析 1 · 首次请求：成功',
    ]);
    expect(requests.map(item => item.currentExecution)).toEqual([true, false, false]);
    expect(agentReportRequests('{"attempts":[{"response":"old"}]}', [], 'planning')[0].label).toContain('来源未记录');
  });
  const report = { attempts: [{ status: 'passed', requestId: 'current' }] };
  const session = {
    messageId: 4,
    status: 'settled',
    configuration: { planning: { enabled: true } },
    planningAttempts: report.attempts,
  };
  it('allows only the current floor and actual current request, not an old Continue cycle', () => {
    expect(canRetryAgentReport(report, 'planning', 4, 4, session)).toBe(true);
    expect(canRetryAgentReport({ attempts: [{ requestId: 'old' }] }, 'planning', 4, 4, session)).toBe(false);
    expect(canRetryAgentReport(report, 'planning', 4, 6, session)).toBe(false);
    expect(canRetryAgentReport(report, 'planning', 4, 4, null)).toBe(false);
    expect(canRetryAgentReport(report, 'planning', 4, 4, { ...session, status: 'planned' })).toBe(false);
  });
  it('preserves malformed and old reports, formats responses only in the display copy', () => {
    expect(readAgentReport('plain response')).toEqual({ response: 'plain response' });
    expect(agentReportAttempts({ attempts: [null, 'old', { diagnostic: 'error' }] })).toEqual([
      { diagnostic: 'error' },
    ]);
    const raw = '{"dice":12}';
    expect(formatAgentViewerValue(raw, false)).toBe('{\n  "dice": 12\n}');
    expect(formatAgentViewerValue(raw, true)).toBe(raw);
  });
});
