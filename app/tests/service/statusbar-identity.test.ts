import { afterEach, describe, expect, it, vi } from 'vitest';

import { deriveStatusbarIdentity, isStatusbarIframeElement } from '../../src/ERA变量框架/service/statusbar-identity';

describe('managed statusbar iframe identity', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not publish ready while the owning floor still has temporary block progress', () => {
    vi.stubGlobal('getChatMessages', () => [
      { message: '<era_block applied="1"><VariableEdit>{"hp":70}</VariableEdit></era_block>' },
    ]);
    const frame = {
      name: 'TH-message--3--0',
      getCurrentMessageId: () => 3,
      frameElement: { localName: 'iframe', id: 'TH-message--3--0', closest: () => ({ getAttribute: () => '3' }) },
    };
    expect(() => deriveStatusbarIdentity('page', frame as never, {} as HTMLElement)).toThrow(
      'ERA_STATUSBAR_SELECTED_MK_NOT_READY',
    );
  });
  it('accepts a structurally valid iframe from another Window realm', () => {
    const crossRealmIframe = { localName: 'iframe' } as unknown as HTMLIFrameElement;
    expect(isStatusbarIframeElement(crossRealmIframe)).toBe(true);
  });

  it('rejects missing and non-iframe frame elements', () => {
    expect(isStatusbarIframeElement(null)).toBe(false);
    expect(isStatusbarIframeElement({ localName: 'div' } as unknown as Element)).toBe(false);
  });
});
