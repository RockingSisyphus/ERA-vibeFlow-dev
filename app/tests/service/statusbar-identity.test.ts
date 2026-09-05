import { describe, expect, it } from 'vitest';

import { isStatusbarIframeElement } from '../../src/ERA变量框架/service/statusbar-identity';

describe('managed statusbar iframe identity', () => {
  it('accepts a structurally valid iframe from another Window realm', () => {
    const crossRealmIframe = { localName: 'iframe' } as unknown as HTMLIFrameElement;
    expect(isStatusbarIframeElement(crossRealmIframe)).toBe(true);
  });

  it('rejects missing and non-iframe frame elements', () => {
    expect(isStatusbarIframeElement(null)).toBe(false);
    expect(isStatusbarIframeElement({ localName: 'div' } as unknown as Element)).toBe(false);
  });
});
