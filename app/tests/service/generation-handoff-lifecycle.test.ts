import { afterEach, expect, it, vi } from 'vitest';
import { fixture } from '../native-tavern/native-fixture.mjs';
import { EVENT_CATALOG } from '../../src/ERA变量框架/events/catalog';
const owners: any[] = [],
  releases: Array<() => void> = [];
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const owner of owners.splice(0)) {
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
  }
});
it.each([
  ['chat_id_changed', ['other-chat']],
  ['message_swiped', [5]],
  ['generation_started', ['regenerate']],
  ['message_sent', [6]],
] as const)('%s releases a stalled handoff without enqueueing its obsolete continuation', async (type, args) => {
  const owner = await fixture(undefined, { eventDefinitions: [...EVENT_CATALOG.values()] });
  owners.push(owner);
  let signal: AbortSignal | undefined;
  const entered = Promise.withResolvers<void>();
  let finishAuthor!: () => void;
  owner.client.subscribeGeneration((event: any) => {
    signal = event.signal;
    entered.resolve();
    return new Promise<void>(resolve => {
      finishAuthor = resolve;
      releases.push(resolve);
    });
  });
  const later = vi.fn();
  owner.client.subscribeGeneration(later);
  owner.caps['era.tavern.agent'].write_session({
    chatKey: 'chat',
    session: { pendingStage: { completionId: 'old-stage' } },
  });
  const waiting = owner.session.handoffs.get('old-stage').promise;
  const admission = owner.client.enqueue('handoff-fixture', 'ui');
  const port = owner.caps['vibeflow.port'];
  await port.receive({ port: 'era.service.in' });
  const completion = {
    completionId: 'old-stage',
    executionId: 'old-cycle',
    stage: 'planning',
    result: { plan: {} },
    chatKey: 'chat',
    trigger: 'initial',
  };
  const sent = owner.direct({
    action: 'send',
    input: {
      port: 'era.service.out',
      value: {
        schemaVersion: 1,
        frameId: 'stage',
        kind: 'batch-result',
        throughSequence: admission.sequence,
        settlements: [
          {
            eventId: admission.eventId,
            sequence: admission.sequence,
            status: 'completed',
            taskId: 'fixture',
            relation: 'primary',
          },
        ],
        notifications: [{ type: 'era.agent.stage_completed', args: [{ kind: 'json', value: completion }] }],
        diagnostics: [],
        fatal: false,
      },
    },
  });
  await entered.promise;
  expect(signal?.aborted).toBe(false);
  // 同一原生normal事件保留当前阶段；其他列举事件取消它。
  owner.direct({ action: 'event', input: { type: 'generation_started', source: 'tavern', args: ['normal'] } });
  expect(owner.session.handoffs.has('old-stage')).toBe(true);
  owner.direct({ action: 'event', input: { type, source: 'tavern', args: [...args] } });
  expect(await waiting).toBeNull();
  await sent.notificationGroup.completion.promise;
  expect(signal?.aborted).toBe(true);
  expect(later).not.toHaveBeenCalled();
  expect(owner.session.queue.some((event: any) => event.type === 'era.agent.stage_continue')).toBe(false);
  finishAuthor();
  await Promise.resolve();
  expect(owner.session.queue.some((event: any) => event.type === 'era.agent.stage_continue')).toBe(false);
});
