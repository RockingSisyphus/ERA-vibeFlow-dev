import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateEraMessageContent } from '../../src/ERA变量框架/service/message-writer';

describe('message writer host extra merge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps host-only extra fields while applying the portable ERA patch', async () => {
    const setChatMessages = vi.fn(async () => undefined);
    vi.stubGlobal(
      'getChatMessages',
      vi.fn(() => [
        {
          message_id: 6,
          swipe_id: 0,
          extra: {
            api: 'openai',
            transientHostField: undefined,
            attachment: { kind: 'image', id: 'host-image' },
          },
        },
      ]),
    );
    vi.stubGlobal('setChatMessages', setChatMessages);

    await updateEraMessageContent(
      {
        updates: [
          {
            message_id: 6,
            message: 'final story',
            extra: {
              era_agent: { schemaVersion: 1, status: 'settled' },
            },
          },
        ],
        refresh: 'none',
      },
      new Map(),
    );

    expect(setChatMessages).toHaveBeenCalledWith(
      [
        {
          message_id: 6,
          message: 'final story',
          extra: {
            api: 'openai',
            transientHostField: undefined,
            attachment: { kind: 'image', id: 'host-image' },
            era_agent: { schemaVersion: 1, status: 'settled' },
          },
        },
      ],
      { refresh: 'none' },
    );
  });
});
