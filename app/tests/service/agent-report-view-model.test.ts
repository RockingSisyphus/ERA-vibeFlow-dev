import { describe, expect, it } from 'vitest';
import {
  agentReportAttempts,
  canRetryAgentReport,
  formatAgentViewerValue,
  readAgentReport,
} from '../../src/ERA变量框架/service/agent-report-view-model';

describe('Agent report presentation', () => {
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
