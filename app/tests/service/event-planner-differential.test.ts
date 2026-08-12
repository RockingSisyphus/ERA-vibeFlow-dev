import { describe, expect, it } from 'vitest';

import {
  EVENT_GROUPS as CANDIDATE_EVENT_GROUPS,
  getCollectionWindowMs as getCandidateCollectionWindowMs,
  getEventDefinition as getCandidateEventDefinition,
  getEventGroup as getCandidateEventGroup,
  INPUT_EVENT as CANDIDATE_INPUT_EVENT,
  LISTENED_EVENT_TYPES as CANDIDATE_LISTENED_EVENT_TYPES,
  shouldCloseCollectionWindow as shouldCandidateCloseCollectionWindow,
} from '../../src/ERA变量框架/events/catalog';
import {
  hasImmediateCombo as hasCandidateImmediateCombo,
  planEventBatch as planCandidateEventBatch,
} from '../../src/ERA变量框架/events/merger';
import type {
  DomainTask as CandidateDomainTask,
  PlannedStep as CandidatePlannedStep,
  RawEvent,
} from '../../src/ERA变量框架/events/types';
import { ERA_API_EVENTS } from '../../src/ERA变量框架/utils/constants';

interface TransportArg {
  readonly kind: 'json' | 'undefined' | 'host-ref';
  readonly value?: unknown;
  readonly token?: string;
  readonly refKind?: string;
}

interface TransportEvent {
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly occurredAt: number;
  readonly source: 'tavern' | 'ui' | 'era-api' | 'timer';
  readonly args: readonly TransportArg[];
  readonly encodedBytes: number;
}

interface PlannerModule {
  getApiEventTypes(): readonly string[];
  getEventGroups(): Readonly<Record<string, readonly string[]>>;
  getInputEvents(): Readonly<Record<string, string>>;
  getListenedEventTypes(): readonly string[];
  getEventDefinition(eventType: string): unknown;
  getCollectionWindowMs(eventType: string): number;
  getEventGroup(eventType: string): string;
  shouldCloseCollectionWindow(eventType: string, args?: readonly TransportArg[]): boolean;
  hasImmediateCombo(events: readonly TransportEvent[]): boolean;
  planEventBatch(events: readonly TransportEvent[]): readonly ServicePlanStep[];
  validateEventPlanCoverage(events: readonly TransportEvent[], steps: readonly ServicePlanStep[]): CoverageResult;
}

interface ServicePlanSource {
  readonly event: TransportEvent;
  readonly relation: 'primary' | 'combined' | 'coalesced';
}

interface ServiceStepBase {
  readonly stepId: string;
  readonly index: number;
  readonly sourceSequences: readonly number[];
  readonly events: readonly TransportEvent[];
}

interface ServiceExecuteStep extends ServiceStepBase {
  readonly kind: 'execute';
  readonly taskRoute: 'initialize' | 'sync' | 'api' | 'update-mk';
  readonly task: ServiceDomainTask;
  readonly sources: readonly ServicePlanSource[];
}

interface ServiceIgnoreStep extends ServiceStepBase {
  readonly kind: 'ignore';
  readonly taskRoute: 'ignore';
  readonly reason: string;
}

type ServicePlanStep = ServiceExecuteStep | ServiceIgnoreStep;

interface ServiceTaskBase {
  readonly id: string;
  readonly sourceEvents: readonly TransportEvent[];
  readonly primaryEvent: TransportEvent;
  readonly context: string;
}

type ServiceDomainTask = ServiceTaskBase &
  Readonly<Record<string, unknown>> & {
    readonly kind: 'initialize' | 'sync' | 'api' | 'update-mk';
  };

interface CoverageResult {
  readonly valid: boolean;
  readonly duplicateBatchSequences: readonly number[];
  readonly duplicatePlannedSequences: readonly number[];
  readonly missingSequences: readonly number[];
  readonly outOfBatchSequences: readonly number[];
  readonly mismatchedEventIds: readonly number[];
}

const plannerUrl = new URL('../../../javascript_project/service/base_lib/domain/event_planner.ts', import.meta.url)
  .href;
const servicePlanner = (await import(/* @vite-ignore */ plannerUrl)) as PlannerModule;

function rawEvent(sequence: number, type: string, occurredAt: number, args: readonly unknown[] = []): RawEvent {
  return { id: `event-${sequence}`, sequence, type, args, occurredAt };
}

function encodeArgument(value: unknown): TransportArg {
  if (value === undefined) {
    return { kind: 'undefined' };
  }
  return { kind: 'json', value };
}

function toTransportEvent(event: RawEvent): TransportEvent {
  return {
    schemaVersion: 1,
    eventId: event.id,
    sequence: event.sequence,
    type: event.type,
    occurredAt: event.occurredAt,
    source: event.type.startsWith('era:') ? 'era-api' : 'tavern',
    args: event.args.map(encodeArgument),
    encodedBytes: 1,
  };
}

function decodeArgument(argument: TransportArg): unknown {
  if (argument.kind === 'undefined') {
    return undefined;
  }
  return argument.kind === 'json' ? argument.value : argument;
}

function normalizeTransportEvent(event: TransportEvent): RawEvent {
  return {
    id: event.eventId,
    sequence: event.sequence,
    type: event.type,
    occurredAt: event.occurredAt,
    args: event.args.map(decodeArgument),
  };
}

function normalizeServiceTask(task: ServiceDomainTask): CandidateDomainTask {
  const base = {
    id: task.id,
    sourceEvents: task.sourceEvents.map(normalizeTransportEvent),
    primaryEvent: normalizeTransportEvent(task.primaryEvent),
    context: task.context,
  };

  if (task.kind === 'initialize' || task.kind === 'update-mk') {
    return { ...base, kind: task.kind } as CandidateDomainTask;
  }
  if (task.kind === 'sync') {
    return {
      ...base,
      kind: 'sync',
      reason: task.reason,
      target: task.target,
      fullRebuild: task.fullRebuild,
    } as CandidateDomainTask;
  }
  return {
    ...base,
    kind: 'api',
    intent: task.intent,
    eventType: task.eventType,
    args: (task.args as readonly TransportArg[]).map(decodeArgument),
  } as CandidateDomainTask;
}

function normalizeServiceSteps(steps: readonly ServicePlanStep[]): CandidatePlannedStep[] {
  return steps.map(step => {
    if (step.kind === 'ignore') {
      return {
        kind: 'ignore',
        events: step.events.map(normalizeTransportEvent),
        reason: step.reason,
      };
    }
    return {
      kind: 'execute',
      task: normalizeServiceTask(step.task),
      sources: step.sources.map(source => ({
        event: normalizeTransportEvent(source.event),
        relation: source.relation,
      })),
    };
  });
}

function expectDifferential(events: readonly RawEvent[]): readonly ServicePlanStep[] {
  const serviceEvents = events.map(toTransportEvent);
  const candidateSteps = planCandidateEventBatch(events);
  const serviceSteps = servicePlanner.planEventBatch(serviceEvents);
  expect(normalizeServiceSteps(serviceSteps)).toEqual(candidateSteps);
  expect(serviceSteps.map(step => step.index)).toEqual(serviceSteps.map((_, index) => index));
  for (const step of serviceSteps) {
    expect(step.sourceSequences).toEqual(step.events.map(event => event.sequence));
    if (step.kind === 'execute') {
      expect(step.taskRoute).toBe(step.task.kind);
      expect(step.sources.map(source => source.event)).toEqual(step.events);
      expect(step.task.sourceEvents).toEqual(step.events);
    } else {
      expect(step.taskRoute).toBe('ignore');
      expect(step.reason.length).toBeGreaterThan(0);
    }
  }
  expect(servicePlanner.validateEventPlanCoverage(serviceEvents, serviceSteps)).toMatchObject({
    valid: true,
  });
  return serviceSteps;
}

describe('VibeFlow Service 事件规划器差分', () => {
  it('逐项保持候选目录、100/500/1500ms 窗口和生成关闭语义', () => {
    const inputs = servicePlanner.getInputEvents();
    expect(inputs).toMatchObject(CANDIDATE_INPUT_EVENT);
    expect(inputs).toMatchObject({
      UI_INITIALIZE_RESOURCES: 'era.ui.initialize_resources',
      UI_UPDATE_SETTINGS: 'era.ui.update_settings',
    });
    const groups = servicePlanner.getEventGroups();
    for (const [group, candidateEvents] of Object.entries(CANDIDATE_EVENT_GROUPS)) {
      expect(groups[group]?.filter(eventType => !eventType.startsWith('era.ui.'))).toEqual(candidateEvents);
    }
    expect(servicePlanner.getListenedEventTypes().filter(eventType => !eventType.startsWith('era.ui.'))).toEqual(
      CANDIDATE_LISTENED_EVENT_TYPES,
    );
    for (const eventType of [...CANDIDATE_LISTENED_EVENT_TYPES, 'future-event']) {
      expect(servicePlanner.getEventDefinition(eventType)).toEqual(getCandidateEventDefinition(eventType));
      expect(servicePlanner.getEventGroup(eventType)).toBe(getCandidateEventGroup(eventType));
      expect(servicePlanner.getCollectionWindowMs(eventType)).toBe(getCandidateCollectionWindowMs(eventType));
    }
    expect(servicePlanner.getCollectionWindowMs('future-event')).toBe(100);
    expect(servicePlanner.getCollectionWindowMs(CANDIDATE_INPUT_EVENT.MESSAGE_SWIPED)).toBe(500);
    expect(servicePlanner.getCollectionWindowMs(CANDIDATE_INPUT_EVENT.MESSAGE_UPDATED)).toBe(1500);

    const realGeneration = [encodeArgument('normal'), encodeArgument({}), encodeArgument(false)];
    const dryRun = [encodeArgument('normal'), encodeArgument({}), encodeArgument(true)];
    expect(servicePlanner.shouldCloseCollectionWindow(CANDIDATE_INPUT_EVENT.GENERATION_STARTED, realGeneration)).toBe(
      shouldCandidateCloseCollectionWindow(CANDIDATE_INPUT_EVENT.GENERATION_STARTED, ['normal', {}, false]),
    );
    expect(servicePlanner.shouldCloseCollectionWindow(CANDIDATE_INPUT_EVENT.GENERATION_STARTED, dryRun)).toBe(
      shouldCandidateCloseCollectionWindow(CANDIDATE_INPUT_EVENT.GENERATION_STARTED, ['normal', {}, true]),
    );
  });

  it('完整登记并等价规划全部 13 个公开输入 API', () => {
    const apiTypes = Object.values(ERA_API_EVENTS);
    expect(apiTypes).toHaveLength(13);
    expect(servicePlanner.getApiEventTypes()).toEqual(apiTypes);
    for (const [index, eventType] of apiTypes.entries()) {
      const event = rawEvent(index + 1, eventType, 1_000 + index, [{ marker: index }]);
      expect(servicePlanner.getEventGroup(eventType)).toBe('API');
      expect(servicePlanner.getCollectionWindowMs(eventType)).toBe(0);
      expectDifferential([event]);
    }
  });

  it('将两个内部 UI 输入规划为 0ms 初始化任务，并完整保留 operation、args、context 与来源', () => {
    const settings = { enabled: true, nested: { mode: 'strict' } };
    const fixtures = [
      ['era.ui.initialize_resources', 'resources', { refresh: true }],
      ['era.ui.update_settings', 'settings-update', settings],
    ] as const;
    expect(servicePlanner.getApiEventTypes()).not.toContain('era.ui.initialize_resources');
    expect(servicePlanner.getApiEventTypes()).not.toContain('era.ui.update_settings');
    for (const [index, [eventType, operation, detail]] of fixtures.entries()) {
      const plannedEvent: TransportEvent = {
        schemaVersion: 1,
        eventId: `ui-${index + 1}`,
        sequence: index + 1,
        type: eventType,
        occurredAt: 2_000 + index,
        source: 'ui',
        args: [encodeArgument(detail)],
        encodedBytes: 1,
      };
      expect(servicePlanner.getEventGroup(eventType)).toBe('INIT');
      expect(servicePlanner.getCollectionWindowMs(eventType)).toBe(0);
      const [step] = servicePlanner.planEventBatch([plannedEvent]);
      expect(step).toMatchObject({
        kind: 'execute',
        taskRoute: 'initialize',
        sourceSequences: [index + 1],
        task: {
          kind: 'initialize',
          operation,
          args: plannedEvent.args,
          context: 'none',
          sourceEvents: [plannedEvent],
          primaryEvent: plannedEvent,
        },
        sources: [{ event: plannedEvent, relation: 'primary' }],
      });
    }
    const appReady = toTransportEvent(rawEvent(10, CANDIDATE_INPUT_EVENT.APP_READY, 3_000));
    expect(servicePlanner.planEventBatch([appReady])[0]).toMatchObject({
      task: {
        kind: 'initialize',
        operation: 'startup',
        args: [],
        context: 'latest-message-with-mk',
      },
    });
  });

  it('在 swipe 600ms 边界成立、越界失败，并与候选任务完全等价', () => {
    const swipe = rawEvent(1, CANDIDATE_INPUT_EVENT.MESSAGE_SWIPED, 1_000, [12]);
    const atBoundary = rawEvent(2, CANDIDATE_INPUT_EVENT.GENERATION_STARTED, 1_600, ['swipe', {}, false]);
    const outside = rawEvent(2, CANDIDATE_INPUT_EVENT.GENERATION_STARTED, 1_601, ['swipe', {}, false]);

    expect(servicePlanner.hasImmediateCombo([swipe, atBoundary].map(toTransportEvent))).toBe(
      hasCandidateImmediateCombo([swipe, atBoundary]),
    );
    expectDifferential([swipe, atBoundary]);
    expect(servicePlanner.hasImmediateCombo([swipe, outside].map(toTransportEvent))).toBe(
      hasCandidateImmediateCombo([swipe, outside]),
    );
    expectDifferential([swipe, outside]);
  });

  it('在 updated 1500ms 边界保持 edit-and-continue 组合', () => {
    const updated = rawEvent(1, CANDIDATE_INPUT_EVENT.MESSAGE_UPDATED, 10_000, [8]);
    const atBoundary = rawEvent(2, CANDIDATE_INPUT_EVENT.GENERATION_STARTED, 11_500, ['normal', {}, false]);
    const outside = rawEvent(2, CANDIDATE_INPUT_EVENT.GENERATION_STARTED, 11_501, ['normal', {}, false]);
    expectDifferential([updated, atBoundary]);
    expectDifferential([updated, outside]);
  });

  it('保持 dry-run 透明、普通同步 coalescing 与定向编辑语义', () => {
    const swipe = rawEvent(1, CANDIDATE_INPUT_EVENT.MESSAGE_SWIPED, 1_000, [12]);
    const dryRun = rawEvent(2, CANDIDATE_INPUT_EVENT.GENERATION_STARTED, 1_200, ['swipe', {}, true]);
    const generation = rawEvent(3, CANDIDATE_INPUT_EVENT.GENERATION_STARTED, 1_400, ['swipe', {}, false]);
    expectDifferential([swipe, dryRun, generation]);

    const received = rawEvent(4, CANDIDATE_INPUT_EVENT.MESSAGE_RECEIVED, 2_000, [3]);
    const deleted = rawEvent(5, CANDIDATE_INPUT_EVENT.MESSAGE_DELETED, 2_020, [3]);
    expectDifferential([received, deleted]);

    const edited = rawEvent(6, CANDIDATE_INPUT_EVENT.MESSAGE_EDITED, 3_000, [7]);
    expectDifferential([edited]);
  });

  it('覆盖校验拒绝 duplicate、missing、out-of-batch 与 eventId 冒名来源', () => {
    const first = toTransportEvent(rawEvent(1, CANDIDATE_INPUT_EVENT.MESSAGE_RECEIVED, 1_000));
    const second = toTransportEvent(rawEvent(2, CANDIDATE_INPUT_EVENT.MESSAGE_SENT, 1_100));
    const events = [first, second];
    const plan = servicePlanner.planEventBatch(events);
    expect(servicePlanner.validateEventPlanCoverage(events, plan)).toEqual({
      valid: true,
      duplicateBatchSequences: [],
      duplicatePlannedSequences: [],
      missingSequences: [],
      outOfBatchSequences: [],
      mismatchedEventIds: [],
    });

    const firstStep = plan[0];
    if (firstStep?.kind !== 'execute') {
      throw new Error('测试夹具首步骤必须可执行');
    }
    const duplicatePlan: readonly ServicePlanStep[] = [
      { ...firstStep, sources: [...firstStep.sources, firstStep.sources[0]] },
      ...plan.slice(1),
    ];
    expect(servicePlanner.validateEventPlanCoverage(events, duplicatePlan)).toMatchObject({
      valid: false,
      duplicatePlannedSequences: [1],
    });

    expect(servicePlanner.validateEventPlanCoverage(events, plan.slice(1))).toMatchObject({
      valid: false,
      missingSequences: [1],
    });

    const foreign = toTransportEvent(rawEvent(99, 'future-event', 2_000));
    const foreignStep: ServiceIgnoreStep = {
      kind: 'ignore',
      stepId: 'step:ignored:event-99',
      index: plan.length,
      taskRoute: 'ignore',
      sourceSequences: [99],
      events: [foreign],
      reason: '夹具',
    };
    expect(servicePlanner.validateEventPlanCoverage(events, [...plan, foreignStep])).toMatchObject({
      valid: false,
      outOfBatchSequences: [99],
    });

    const forged = { ...first, eventId: 'forged-event' };
    const forgedPlan: readonly ServicePlanStep[] = [
      { ...firstStep, sources: [{ event: forged, relation: 'primary' }] },
      ...plan.slice(1),
    ];
    expect(servicePlanner.validateEventPlanCoverage(events, forgedPlan)).toMatchObject({
      valid: false,
      mismatchedEventIds: [1],
    });
  });
});
