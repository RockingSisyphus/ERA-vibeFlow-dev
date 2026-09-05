import { describe, expect, it } from 'vitest';

import {
  elementAcceptsEraMacroProjection,
  isManagedStatusbarSourceText,
} from '../../src/ERA变量框架/macro/dom-refresh';
import {
  effectiveOverflow,
  normalizeStatusbarMacroBindingSource,
  rootForcesDisplay,
} from '../../src/ERA变量框架/service/statusbar-runtime-support';
import { iframeMessageId } from '../../src/ERA变量框架/service/statusbar-message-identity';

describe('managed statusbar projection boundaries', () => {
  it('never rewrites iframe srcdoc through the ordinary message DOM projector', () => {
    expect(elementAcceptsEraMacroProjection({ tagName: 'IFRAME' } as Element)).toBe(false);
    expect(elementAcceptsEraMacroProjection({ tagName: 'DIV' } as Element)).toBe(true);
  });

  it('keeps managed source code tokens for the floor-bound iframe runtime', () => {
    expect(
      isManagedStatusbarSourceText(
        '<script data-era-statusbar-bootstrap></script><section data-era-statusbar-root="v1">__ERA_LAZY_MACRO_V2_1234__</section>',
      ),
    ).toBe(true);
    expect(isManagedStatusbarSourceText('<pre>ordinary {{ERA:value}}</pre>')).toBe(false);
  });

  it('recognizes Tavern Helper iframe ids with and without regenerated suffixes', () => {
    expect(iframeMessageId('TH-message--12--0')).toBe(12);
    expect(iframeMessageId('TH-message--12--0_3')).toBe(12);
    expect(iframeMessageId('TH-message--12')).toBeNull();
  });

  it('uses explicit template overflow and force-display declarations', () => {
    const template = {
      dataset: { eraOverflow: 'hidden', eraForceDisplay: 'true' },
    } as unknown as HTMLTemplateElement;
    expect(effectiveOverflow(template, 'placeholder')).toBe('hidden');
    expect(rootForcesDisplay(template)).toBe(true);
    expect(rootForcesDisplay({ dataset: { eraForceDisplay: '1' } } as unknown as HTMLElement)).toBe(false);
  });

  it('normalizes literal macros left by an early reload into floor-bound lazy bindings', () => {
    const normalized = normalizeStatusbarMacroBindingSource('HP={{ERA:player.hp}}; profile={{ERA-withmeta:player}}');
    expect(normalized).toContain('__ERA_LAZY_MACRO_V2_');
    expect(normalized).not.toContain('{{ERA:');
    expect(normalizeStatusbarMacroBindingSource('ordinary text')).toBeNull();
  });
});
