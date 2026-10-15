import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeMessage } from '../native-tavern/message-fixture.mjs';
const updateEraMessageContent = (input: Readonly<Record<string, unknown>>, _writes: Map<unknown, unknown>) =>
  writeMessage(input);

describe('message writer host extra merge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a replaced Sidecar pointer immediately before restoring message text', async () => {
    const setChatMessages = vi.fn();
    vi.stubGlobal('setChatMessages', setChatMessages);
    vi.stubGlobal('getVariables', () => ({ ERAMetaData: { SidecarId: 'era_chat_87654321' } }));
    await expect(
      updateEraMessageContent({ messageId: 0, content: 'restore', expectedSidecarId: 'era_chat_12345678' }, new Map()),
    ).rejects.toMatchObject({ code: 'ERA_MESSAGE_WRITE_TARGET_CHANGED', reason: 'binding', written: false });
    expect(setChatMessages).not.toHaveBeenCalled();
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
