import { describe, expect, it } from 'vitest';
import { AgentExecutionRecords } from '../../src/ERA变量框架/service/agent-execution-records';
import { compactSessionStorage } from '../../../javascript_project/service/base_lib/agent/agent_session_binding';

describe('page-only Agent prompt records', () => {
  it('moves a bounded planning record to its first real floor without retaining the pending index', () => {
    const records = new AgentExecutionRecords(2000);
    records.rememberReport('chat', 'pending-generation:e', 'planning', '{"attempts":[{"response":"actual"}]}');
    records.bindReportFloor('chat', 'pending-generation:e', 'mk', 'planning');
    expect(records.reportHistory('chat', 'pending-generation:e', 'planning')).toEqual([]);
    expect(records.reportHistory('chat', 'mk', 'planning')).toEqual(['{"attempts":[{"response":"actual"}]}']);
    expect(records.statistics.count).toBe(1);
    records.bindReportFloor('chat', 'pending-generation:e', 'mk', 'planning');
    expect(records.statistics.count).toBe(1);
    records.clear();
    expect(records.statistics.usedBytes).toBe(0);
  });
  it('waiting sessions retain their continuation, but do not hold a second unbudgeted attempt history', () => {
    const session = {
      status: 'planned',
      pendingStage: { completionId: 'p', candidate: { operations: [] } },
      preState: { statData: { hp: 1 } },
      planningAttempts: [
        { requestId: 'r', status: 'passed', response: 'large response', requestContext: { prompt: 'large prompt' } },
      ],
    };
    const stored = compactSessionStorage(session) as typeof session;
    expect(stored.pendingStage).toEqual(session.pendingStage);
    expect(stored.preState).toEqual(session.preState);
    expect(stored.planningAttempts).toEqual([{ requestId: 'r', status: 'passed' }]);
    expect(session.planningAttempts[0].response).toBe('large response');
  });
  it('marks explicit cancellation but does not mistake native generation end for settlement completion', () => {
    const records = new AgentExecutionRecords();
    records.begin('cancel', 'chat', 'story', {});
    records.armNative('cancel');
    records.stopNative(true);
    expect(records.get('chat', 'cancel')?.status).toBe('cancelled');
    records.begin('normal', 'chat', 'story', {});
    records.armNative('normal');
    records.stopNative();
    expect(records.get('chat', 'normal')?.status).toBe('running');
    records.finish('normal', 'responded', 'story');
    expect(records.get('chat', 'normal')?.status).toBe('responded');
  });
  it('separates response success from actual commit receipt and ignores unrelated settlements', () => {
    const records = new AgentExecutionRecords();
    records.begin('update', 'chat-a', 'settlement', {});
    records.finish('update', 'responded', '{}');
    records.bindCommit('update', 'event-1');
    records.recordSettlement({ eventId: 'other', status: 'completed' });
    expect(records.get('chat-a', 'update')?.commit).toBeUndefined();
    records.recordSettlement({ eventId: 'event-1', status: 'failed', error: { code: 'WRITE_FAILED' } });
    expect(records.get('chat-a', 'update')).toMatchObject({
      status: 'responded',
      commit: { status: 'failed', error: { code: 'WRITE_FAILED' } },
    });
    records.clear();
    expect(records.get('chat-a', 'update')).toBeUndefined();
  });
  it('keeps report history on the logical Swipe MK rather than a reused display floor number', () => {
    const records = new AgentExecutionRecords();
    records.rememberReport('chat-a', 'mk-old-swipe', 'planning', 'first');
    records.rememberReport('chat-a', 'mk-old-swipe', 'planning', 'retry');
    records.rememberReport('chat-a', 'mk-new-swipe', 'planning', 'new');
    expect(records.reportHistory('chat-a', 'mk-old-swipe', 'planning')).toEqual(['first', 'retry']);
    expect(records.reportHistory('chat-a', 'mk-new-swipe', 'planning')).toEqual(['new']);
    expect(records.reportHistory('chat-b', 'mk-old-swipe', 'planning')).toEqual([]);
  });
  it('shares in-flight button state across stage viewers and releases it at settlement', () => {
    const records = new AgentExecutionRecords();
    const finish = records.beginRetry('chat-a');
    expect(records.retryBusy('chat-a')).toBe(true);
    expect(records.retryBusy('chat-b')).toBe(false);
    expect(records.beginRetry('chat-a')).toBeUndefined();
    finish?.();
    expect(records.retryBusy('chat-a')).toBe(false);
    expect(records.beginRetry('chat-a')).toBeTypeOf('function');
    records.clear();
    expect(records.retryBusy('chat-a')).toBe(false);
  });
  it('preserves multimodal structure without duplicating media and does not overwrite a captured request', () => {
    const records = new AgentExecutionRecords();
    records.begin('story', 'chat-a', 'story', {});
    records.armNative('story');
    const prompt = [
      {
        content: [
          { type: 'image_url', image_url: { url: 'data:image/png;base64,YWJj' } },
          { type: 'input_audio', input_audio: { data: 'YWJj', format: 'wav' } },
          { type: 'text', text: 'hello' },
        ],
      },
    ];
    records.capture('chat-a', prompt, false);
    records.capture('chat-a', ['unrelated'], false);
    const recorded = JSON.stringify(records.get('chat-a', 'story')?.prompt);
    expect(recorded).toContain('hello');
    expect(recorded).toContain('wav');
    expect(recorded).not.toContain('YWJj');
    expect(prompt[0].content[0].image_url?.url).toContain('YWJj');
    records.stopNative();
    records.rememberReport('chat-a', 2, 'story', 'old');
    records.rememberReport('chat-a', 2, 'story', 'new');
    records.rememberReport('chat-a', 2, 'story', 'new');
    expect(records.reportHistory('chat-a', 2, 'story')).toEqual(['old', 'new']);
    expect(records.reportHistory('chat-b', 2, 'story')).toEqual([]);
    records.clear();
    expect(records.reportHistory('chat-a', 2, 'story')).toEqual([]);
  });
  it('captures only the matching helper request and chat, ignores dry runs and concurrent foreign calls', () => {
    const records = new AgentExecutionRecords();
    records.begin('plan-1', 'chat-a', 'planning', { userInput: 'input' });
    records.helperStarted('plan-1');
    records.capture('chat-b', ['wrong chat'], false);
    records.capture('chat-a', ['dry'], true);
    records.helperStarted('foreign');
    records.capture('chat-a', ['ambiguous'], false);
    expect(records.get('chat-a', 'plan-1')?.prompt).toBeUndefined();
    records.helperEnded('foreign');
    records.capture('chat-a', [{ role: 'user', content: 'actual prompt' }], false);
    records.finish('plan-1', 'responded', 'response');
    expect(records.get('chat-a', 'plan-1')?.prompt).toEqual([{ role: 'user', content: 'actual prompt' }]);
    expect(records.get('chat-b', 'plan-1')).toBeUndefined();
    records.clear();
    expect(records.get('chat-a', 'plan-1')).toBeUndefined();
  });
});

describe('bounded Agent observations', () => {
  it('evicts completed requests across chats and clears their selection', () => {
    const records = new AgentExecutionRecords(2200);
    records.begin('old', 'chat-a', 'planning', 'a'.repeat(200));
    records.finish('old', 'responded', 'done');
    records.selectRequest('chat-a', 'mk', 'planning', 'old');
    records.begin('new', 'chat-b', 'story', 'b'.repeat(400));
    expect(records.get('chat-b', 'new')).toBeDefined();
    expect(records.get('chat-a', 'old')).toBeUndefined();
    expect(records.selectedRequest('chat-a', 'mk', 'planning')).toBeNull();
    expect(records.statistics.usedBytes).toBeLessThanOrEqual(2200);
  });
  it('does not retain oversized responses or accumulate tiny history indexes', () => {
    const records = new AgentExecutionRecords(1500);
    records.begin('large', 'chat', 'planning', {});
    records.finish('large', 'responded', 'x'.repeat(2000));
    expect(records.get('chat', 'large')).toBeUndefined();
    for (let i = 0; i < 3000; i++) {
      records.rememberReport(`chat-${i}`, `mk-${i}`, 'planning', '{}');
      records.selectRequest(`chat-${i}`, `mk-${i}`, 'planning', `id-${i}`);
      expect(records.statistics.usedBytes).toBeLessThanOrEqual(1500);
    }
    expect(records.statistics.count).toBeLessThan(20);
    records.clear();
    expect(records.statistics.usedBytes).toBe(0);
    expect(records.statistics.count).toBe(0);
  });
  it('drops an observation when active records fill the budget without modifying input', () => {
    const records = new AgentExecutionRecords(1200);
    const input = { text: 'a'.repeat(150) };
    records.begin('active', 'chat', 'planning', input);
    records.begin('other', 'chat', 'planning', input);
    expect(records.get('chat', 'active')).toBeDefined();
    expect(records.get('chat', 'other')).toBeUndefined();
    expect(input.text).toHaveLength(150);
    records.finish('active', 'responded', 'ok');
    records.begin('next', 'chat', 'planning', input);
    expect(records.get('chat', 'next')).toBeDefined();
  });
});
