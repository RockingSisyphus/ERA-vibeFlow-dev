// @vitest-environment happy-dom
import lodash from 'lodash';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../../src/ERA变量框架/service/client', () => ({
  requestEraService: vi.fn(),
  readCurrentAgentSession: () => null,
}));

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('keeps a user-opened report open when the host redraws the same message', async () => {
  vi.stubGlobal('_', lodash);
  vi.stubGlobal('SillyTavern', {
    characterId: '0',
    groupId: null,
    getCurrentChatId: () => 'report-redraw',
    chat: [{ mes: '<era_plan>{}</era_plan>story', extra: { era_agent: { status: 'settled' } } }],
  });
  const root = document.createElement('div');
  document.body.append(root);
  vi.stubGlobal('retrieveDisplayedMessage', () => ({ get: () => root }));
  vi.stubGlobal('formatAsDisplayedMessage', (text: string) => text);
  const { refreshDisplayedEraTechnicalBlocks } =
    await import('../../src/ERA变量框架/service/technical-block-projection');
  const { releaseReportApps } = await import('../../src/ERA变量框架/service/agent-report-host');
  try {
    refreshDisplayedEraTechnicalBlocks([0]);
    const report = root.querySelector('details')!;
    report.open = true;
    report.dispatchEvent(new Event('toggle'));
    root.replaceChildren();
    refreshDisplayedEraTechnicalBlocks([0]);
    expect(root.querySelector('details')!.open).toBe(true);
    const restored = root.querySelector('details')!;
    restored.open = false;
    restored.dispatchEvent(new Event('toggle'));
    root.replaceChildren();
    refreshDisplayedEraTechnicalBlocks([0]);
    expect(root.querySelector('details')!.open).toBe(false);
  } finally {
    releaseReportApps(true);
  }
});

it('restores projection ownership after a native redraw of a technical-only message and then stays idle', async () => {
  vi.stubGlobal('_', lodash);
  vi.stubGlobal('SillyTavern', {
    characterId: '0',
    groupId: null,
    getCurrentChatId: () => 'projection-redraw',
    chat: [
      {
        mes: '<VariableInsert>{"hp":7}</VariableInsert>\n<era_data>{"era-message-key"="floor"}</era_data>',
        extra: { era_agent: { status: 'settled' } },
      },
    ],
  });
  const root = document.createElement('div');
  document.body.append(root);
  vi.stubGlobal('retrieveDisplayedMessage', () => ({ get: () => root }));
  vi.stubGlobal('formatAsDisplayedMessage', (text: string) => text);
  const { refreshDisplayedEraTechnicalBlocks } =
    await import('../../src/ERA变量框架/service/technical-block-projection');
  const { releaseReportApps } = await import('../../src/ERA变量框架/service/agent-report-host');
  try {
    refreshDisplayedEraTechnicalBlocks([0]);
    // Tavern replaces the content but retains the message element and its dataset.
    root.replaceChildren();
    refreshDisplayedEraTechnicalBlocks([0]);
    const restoredReport = root.querySelector('[data-era-settlement-viewer]');
    expect(restoredReport).not.toBeNull();
    for (let index = 0; index < 5; index += 1) refreshDisplayedEraTechnicalBlocks([0]);
    expect(root.querySelector('[data-era-settlement-viewer]')).toBe(restoredReport);
    expect(root.querySelectorAll('[data-era-settlement-viewer]')).toHaveLength(1);
  } finally {
    releaseReportApps(true);
  }
});
