import * as preparation from '../../../javascript_project/service/base_lib/dispatch_preparation';
export const identity = { characterId: 'card-a', chatId: 'chat-a', groupId: null };
export const sidecarId = 'era_chat_12345678-1234-4234-8234-123456789abc';
export function contextWith(
  text: string,
  statData: Record<string, unknown> = { hp: 100 },
  syncCursor: unknown = undefined,
) {
  const context: any = {
    schemaVersion: 1,
    step: {
      kind: 'execute',
      stepId: 's1',
      index: 0,
      taskRoute: 'sync',
      sourceSequences: [1],
      events: [],
      task: {
        id: 't1',
        kind: 'sync',
        reason: 'manual',
        target: { kind: 'auto' },
        fullRebuild: false,
        context: 'latest-message-with-mk',
        primaryEvent: {
          schemaVersion: 1,
          eventId: 'e1',
          sequence: 1,
          type: 'manual_sync',
          occurredAt: 1,
          source: 'tavern',
          args: [],
          encodedBytes: 2,
        },
        sourceEvents: [],
      },
      sources: [
        {
          relation: 'primary',
          event: {
            schemaVersion: 1,
            eventId: 'e1',
            sequence: 1,
            type: 'manual_sync',
            occurredAt: 1,
            source: 'tavern',
            args: [],
            encodedBytes: 2,
          },
        },
      ],
      dispatchContext: {
        schemaVersion: 3,
        floorIdentity: null,
        agentFloorCandidate: null,
        sourceBasis: {
          identity,
          messages: [{ schemaVersion: 1, messageId: 1, role: 'assistant', activeText: text, swipeIndex: 0 }],
        },
        status: 'ready',
        dispatchClass: 'sync',
        requirement: 'latest-message-with-mk',
        messages: [{ schemaVersion: 1, messageId: 1, role: 'assistant', activeText: text, swipeIndex: 0 }],
        processingMessage: {
          schemaVersion: 1,
          messageId: 1,
          role: 'assistant',
          activeText: text,
          swipeIndex: 0,
        },
        processingMk: 'mk-1',
        messageChanged: false,
        variablesChanged: false,
        failure: null,
      },
    },
    consecutive: { mk: null, count: 0 },
    status: 'ready',
    messagesRaw: [
      {
        schemaVersion: 1,
        messageId: 1,
        role: 'assistant',
        swipeIndex: 0,
        activeText: text,
      },
    ],
    variablesRaw: {
      stat_data: statData,
      statFunc: {},
      ERAMetaData: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    },
    failure: null,
    ...(syncCursor === undefined ? {} : { syncCursor }),
  };
  const seed = preparation.classifyDispatch(context.step, {
    schemaVersion: 1,
    nextState: { consecutiveMk: null, consecutiveProcessingCount: 0 },
  } as any).seed;
  const planned = preparation.planDispatchPreparation(
    preparation.canonicalDispatchContext(
      seed,
      { schemaVersion: 2, messages: context.messagesRaw },
      { variables: {} },
      { variables: { 在ai消息尾部生成特殊符号: false } },
      identity,
    ),
  );
  context.step.dispatchContext = preparation.dispatchContextOf(preparation.preserveDispatchPreparation(planned));
  context.messagesRaw = context.step.dispatchContext.messages;
  return context;
}
