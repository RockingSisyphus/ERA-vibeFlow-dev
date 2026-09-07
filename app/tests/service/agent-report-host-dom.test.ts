// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
  mountReportViewer,
  hydrateReportViewers,
  releaseReportApps,
} from '../../src/ERA变量框架/service/agent-report-host';
import { agentExecutionRecords } from '../../src/ERA变量框架/service/agent-execution-records';

const mocks = vi.hoisted(() => ({
  session: { messageId: 0, status: 'settled', planningAttempts: [{ requestId: 'plan' }] },
  request: vi.fn(() => ({ accepted: false, message: 'fixture refusal' })),
}));
vi.mock('../../src/ERA变量框架/service/agent-tavern-host', () => ({ readCurrentAgentSession: () => mocks.session }));
vi.mock('../../src/ERA变量框架/service/client', () => ({ requestEraService: mocks.request }));

afterEach(() => {
  releaseReportApps(true);
  agentExecutionRecords.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('report lifetime across native message HTML replacement', () => {
  it('keeps an explicitly selected old request when the same floor report is remounted with new requests', async () => {
    vi.stubGlobal('SillyTavern', {
      characterId: '0',
      groupId: null,
      getCurrentChatId: () => 'chat',
      chat: [{ mes: '<era_data>{"era-message-key"="floor-one"}</era_data>' }],
    });
    const previous = JSON.stringify({
      attempts: [
        { requestId: 'one', response: 'old first' },
        { requestId: 'two', response: 'old correction' },
      ],
    });
    const oldRoot = mountReportViewer(document, previous, 'planning', 0);
    document.body.append(oldRoot);
    const select = oldRoot.querySelector('select')!;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    await nextTick();
    expect(oldRoot.querySelector('pre')!.textContent).toBe('old first');
    oldRoot.remove();
    releaseReportApps();
    const newRoot = mountReportViewer(
      document,
      JSON.stringify({ attempts: [{ requestId: 'three', response: 'new execution' }] }),
      'planning',
      0,
    );
    document.body.append(newRoot);
    expect(newRoot.querySelector('pre')!.textContent).toBe('old first');
    expect(newRoot.querySelectorAll('select')).toHaveLength(1);
    expect(newRoot.querySelector('[role="tablist"]')).not.toBeNull();
    expect(newRoot.querySelector('.era-report-mode')).not.toBeNull();
    expect(newRoot.querySelector('.era-report-copy')).not.toBeNull();
    expect(newRoot.querySelector('.era-report-business')).not.toBeNull();
    agentExecutionRecords.clear();
    expect(
      agentExecutionRecords.selectedRequest(JSON.stringify(['0', null, 'chat']), 'floor-one', 'planning'),
    ).toBeNull();
  });
  it.each(['planning', 'settlement'] as const)(
    'defaults %s to the first AI response tab and keeps the full report accessible',
    async stage => {
      vi.stubGlobal('SillyTavern', { characterId: '0', groupId: null, getCurrentChatId: () => 'chat', chat: [{}] });
      const response = { answer: 'readable response' };
      const report = JSON.stringify({ attempts: [{ status: 'passed', response: JSON.stringify(response) }] });
      const root = mountReportViewer(document, report, stage, 0);
      document.body.append(root);
      const tabs = [...root.querySelectorAll<HTMLButtonElement>('[aria-pressed]')];
      expect(tabs.map(button => button.textContent).slice(0, 3)).toEqual(['AI 响应', '完整响应', '提示词']);
      expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
      expect(root.querySelector('pre')!.textContent).toBe(JSON.stringify(response, null, 2));
      tabs[1].click();
      await nextTick();
      expect(root.querySelector('pre')!.textContent).toContain('\n  "attempts": [');
      expect(root.querySelector('pre')!.textContent).toContain('"response": {');
      expect(JSON.parse(decodeURIComponent(root.dataset.eraReportView!)).report).toBe(report);
    },
  );
  it('copies through the button document rather than the hidden script realm', async () => {
    vi.stubGlobal('SillyTavern', { characterId: '0', groupId: null, getCurrentChatId: () => 'chat', chat: [{}] });
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const targetDocument = frame.contentDocument!;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(frame.contentWindow!.navigator, 'clipboard', { configurable: true, value: { writeText } });
    const hiddenWrite = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('hidden realm'));
    const root = mountReportViewer(targetDocument, '{"attempts":[]}', 'planning', 0);
    targetDocument.body.append(root);
    [...root.querySelectorAll('button')].find(button => button.textContent === '复制当前内容')!.click();
    await Promise.resolve();
    await nextTick();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(hiddenWrite).not.toHaveBeenCalled();
    expect(root.textContent).toContain('已复制');
  });
  it('shows actual attempt prompts and function outcomes without embedding prompts in remount props', async () => {
    vi.stubGlobal('SillyTavern', { characterId: '0', groupId: null, getCurrentChatId: () => 'chat', chat: [{}] });
    const chat = JSON.stringify(['0', null, 'chat']);
    agentExecutionRecords.begin('failed-plan', chat, 'planning', { userInput: 'first input' });
    agentExecutionRecords.helperStarted('failed-plan');
    agentExecutionRecords.capture(chat, [{ role: 'user', content: 'ACTUAL-FIRST-PROMPT' }], false);
    agentExecutionRecords.finish('failed-plan', 'responded', '{"calls":[]}');
    agentExecutionRecords.begin('plan', chat, 'planning', { userInput: '上一尝试失败原因：unknown function' });
    agentExecutionRecords.helperStarted('plan');
    agentExecutionRecords.capture(chat, [{ role: 'user', content: 'ACTUAL-RETRY-PROMPT' }], false);
    agentExecutionRecords.finish('plan', 'responded', '{"calls":["dice"]}');
    const report = JSON.stringify({
      attempts: [
        { status: 'failed', requestId: 'failed-plan', diagnostic: 'unknown function' },
        { status: 'passed', requestId: 'plan', functionResults: [{ name: 'dice', status: 'passed', result: 12 }] },
      ],
    });
    const root = mountReportViewer(document, report, 'planning', 0);
    document.body.append(root);
    const click = async (label: string) => {
      [...root.querySelectorAll('button')].find(button => button.textContent === label)!.click();
      await nextTick();
    };
    await click('提示词');
    expect(root.querySelector('pre')!.textContent).toContain('ACTUAL-RETRY-PROMPT');
    const select = root.querySelector<HTMLSelectElement>('[aria-label="查看阶段请求记录"]')!;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    await nextTick();
    expect(root.querySelector('pre')!.textContent).toContain('ACTUAL-FIRST-PROMPT');
    select.value = '0';
    select.dispatchEvent(new Event('change'));
    await nextTick();
    expect(root.querySelector('pre')!.textContent).toContain('ACTUAL-RETRY-PROMPT');
    expect(root.querySelector('pre')!.textContent).toContain('上一尝试失败原因');
    expect(decodeURIComponent(root.dataset.eraReportView!)).not.toContain('ACTUAL-RETRY-PROMPT');
    await click('函数结果');
    expect(root.querySelector('pre')!.textContent).toContain('12');
    await click('AI 响应');
    expect(root.querySelector('pre')!.textContent).toContain('dice');
    await click('原始显示');
    expect(root.querySelector('pre')!.textContent).toBe('{"calls":["dice"]}');
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await click('复制当前内容');
    expect(clipboard).toHaveBeenCalledWith('{"calls":["dice"]}');
    expect(root.textContent).toContain('已复制');
    clipboard.mockRejectedValueOnce(new Error('clipboard unavailable'));
    await click('复制当前内容');
    expect(root.textContent).toContain('复制失败');
    await click('格式化显示');
    expect(root.querySelector('pre')!.textContent).toContain('\n');
    agentExecutionRecords.clear();
    await click('提示词');
    expect(root.querySelector('pre')!.textContent).toContain('未保存提示词');
    expect(JSON.parse(decodeURIComponent(root.dataset.eraReportView!)).report).toBe(report);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('rehydrates only its own cloned container and restores one real click handler', async () => {
    vi.stubGlobal('SillyTavern', { characterId: '0', groupId: null, getCurrentChatId: () => 'chat', chat: [{}] });
    const message = document.createElement('div');
    document.body.append(message);
    const author = document.createElement('iframe');
    message.append(author);
    const report = JSON.stringify({ attempts: [{ status: 'passed', requestId: 'plan', response: '{{ERA:hp}}' }] });
    const original = mountReportViewer(document, report, 'planning', 0);
    message.append(original);
    await nextTick();
    expect(original.dataset.eraReportView).not.toContain('{{ERA:');
    const clone = original.cloneNode(true) as HTMLElement;
    original.replaceWith(clone);
    hydrateReportViewers(message);
    hydrateReportViewers(message);
    await nextTick();
    clone.querySelector<HTMLButtonElement>('#era-report-retry-planning')!.click();
    await nextTick();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(clone.textContent).toContain('fixture refusal');
    expect(message.querySelector('iframe')).toBe(author);
    expect(clone.querySelectorAll('.era-stage-viewer')).toHaveLength(1);
  });
});
