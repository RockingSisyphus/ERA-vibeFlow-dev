import { createInitialServiceState } from '../../../javascript_project/service/base_lib/service_protocol_collection';

/** 旧单节点用例只填写关心的事实；这里补齐正式入口必需的中性信封，不改变断言或业务值。 */
export function generationStepFixture(partial: any = {}) {
  const envelope = (event: any = {}) => ({
    schemaVersion: 1,
    eventId: 'fixture-event',
    sequence: 1,
    type: 'generation_ended',
    occurredAt: 1,
    source: 'tavern',
    args: [],
    encodedBytes: 2,
    ...event,
  });
  const event = envelope(partial.task?.primaryEvent);
  const events = partial.events?.length ? partial.events.map(envelope) : [event];
  const kind = partial.task?.kind ?? 'sync';
  const taskDefaults =
    kind === 'sync'
      ? { reason: 'manual', target: { kind: 'auto' }, fullRebuild: false }
      : kind === 'initialize'
        ? { operation: 'startup', args: [] }
        : kind === 'api'
          ? { intent: 'sync', eventType: event.type, args: [] }
          : {};
  const dispatch = {
    schemaVersion: 3,
    status: 'ready',
    dispatchClass: 'sync',
    requirement: 'none',
    messages: [],
    processingMessage: null,
    processingMk: null,
    messageChanged: false,
    variablesChanged: false,
    failure: null,
    ...partial.dispatchContext,
  };
  if (dispatch.schemaVersion === 3)
    Object.assign(dispatch, {
      generationCycleIdentity: null,
      floorIdentity: null,
      stagedMessageUpdates: [],
      agentFloorCandidate: null,
      ...partial.dispatchContext,
    });
  const message = (value: any) => ({ schemaVersion: 1, swipeIndex: 0, ...value });
  dispatch.messages = dispatch.messages.map(message);
  if (dispatch.processingMessage) dispatch.processingMessage = message(dispatch.processingMessage);
  return {
    kind: 'execute',
    stepId: 'fixture-step',
    index: 0,
    taskRoute: 'agent-generation-session',
    ...partial,
    sourceSequences: partial.sourceSequences?.length
      ? partial.sourceSequences
      : events.map((item: any) => item.sequence),
    events,
    sources: partial.sources?.length
      ? partial.sources.map((source: any) => ({ ...source, event: envelope(source.event) }))
      : [{ relation: 'primary', event }],
    task: {
      id: 'fixture-task',
      context: dispatch.requirement,
      ...taskDefaults,
      ...partial.task,
      kind,
      primaryEvent: event,
      sourceEvents: partial.task?.sourceEvents?.length ? partial.task.sourceEvents.map(envelope) : events,
    },
    dispatchContext: dispatch,
  };
}

export function batchExecutionFixture(step: any, partial: any = {}) {
  const initial = createInitialServiceState();
  const planned = (value: any) => {
    const { dispatchContext, ...result } = generationStepFixture(value);
    return result;
  };
  return {
    schemaVersion: 1,
    batchId: 'fixture-batch',
    throughSequence: Math.max(...step.sourceSequences),
    index: 0,
    settlements: [],
    notifications: [],
    diagnostics: [],
    fatal: false,
    coverageError: null,
    ...partial,
    sources: partial.sources?.length
      ? partial.sources
      : step.events.map((event: any) => ({ eventId: event.eventId, sequence: event.sequence })),
    steps: partial.steps?.length ? partial.steps.map(planned) : [planned(step)],
    nextState: {
      ...initial,
      ...partial.nextState,
      scopeWindow: { ...initial.scopeWindow, ...partial.nextState?.scopeWindow },
    },
  };
}

export function generationRequestInputs(request: any) {
  const latest = request.context?.latestMessage;
  const raw = request.context?.messages ?? (latest ? [latest] : []);
  const messages = raw.map((message: any, index: number) => ({
    schemaVersion: 1,
    messageId: message.messageId ?? message.message_id ?? index,
    role: message.role ?? (message.is_user ? 'user' : 'assistant'),
    activeText: message.activeText ?? message.message ?? message.mes ?? '',
    swipeIndex: message.swipeIndex ?? message.swipe_id ?? 0,
  }));
  const trigger = request.trigger ?? {};
  const step = generationStepFixture({
    task: {
      primaryEvent: {
        eventId: trigger.eventId ?? 'fixture-request',
        sequence: trigger.sequence ?? 1,
        type: trigger.type ?? 'generation_ended',
      },
    },
    dispatchContext: {
      messages,
      sourceBasis: {
        identity: { characterId: null, groupId: null, chatId: null, ...request.context?.identity },
        messages,
      },
    },
  });
  return { step, batch: batchExecutionFixture(step) };
}
