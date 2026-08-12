import { describe, expect, it } from 'vitest';

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

interface ServiceState {
  readonly schemaVersion: 1;
  readonly collection: readonly TransportEvent[];
  readonly collectionBytes: number;
  readonly iteration: number;
  readonly consecutiveProcessingCount: number;
  readonly consecutiveMk: string | null;
  readonly timerToken: string | null;
}

interface CollectionReduction {
  readonly schemaVersion: 1;
  readonly route: 'wait' | 'execute';
  readonly nextState: ServiceState;
  readonly batchEvents: readonly TransportEvent[];
  readonly throughSequence: number | null;
}

interface CollectionControl {
  readonly schemaVersion: 1;
  readonly frameId: string;
  readonly kind: 'collection-control';
  readonly commands: readonly (
    | { readonly kind: 'schedule'; readonly token: string; readonly dueAt: number }
    | { readonly kind: 'cancel'; readonly token: string }
  )[];
}

interface PlannedStepBase {
  readonly stepId: string;
  readonly index: number;
  readonly sourceSequences: readonly number[];
  readonly events: readonly TransportEvent[];
}

type PlannedStep =
  | (PlannedStepBase & {
      readonly kind: 'execute';
      readonly taskRoute: 'initialize' | 'sync' | 'api' | 'update-mk';
      readonly task: Readonly<Record<string, unknown>> & { readonly kind: string };
      readonly sources: readonly {
        readonly event: TransportEvent;
        readonly relation: 'primary' | 'combined' | 'coalesced';
      }[];
    })
  | (PlannedStepBase & {
      readonly kind: 'ignore';
      readonly taskRoute: 'ignore';
      readonly reason: string;
    });

interface BatchPlan {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: ServiceState;
  readonly events: readonly TransportEvent[];
  readonly sourceSequences: readonly number[];
  readonly steps: readonly PlannedStep[];
}

interface ExecutionState {
  readonly schemaVersion: 1;
  readonly batchId: string;
  readonly throughSequence: number;
  readonly nextState: ServiceState;
  readonly sources: readonly { readonly eventId: string; readonly sequence: number }[];
  readonly steps: readonly PlannedStep[];
  readonly index: number;
  readonly settlements: readonly unknown[];
  readonly notifications: readonly unknown[];
  readonly diagnostics: readonly unknown[];
  readonly fatal: boolean;
  readonly coverageError: string | null;
}

interface ProtocolModule {
  createInitialServiceState(): ServiceState;
  reduceForProtocolSlice(
    state: ServiceState,
    event: TransportEvent,
    limits: Readonly<Record<string, unknown>>,
  ): { readonly reduction: CollectionReduction; readonly control: CollectionControl };
  planProtocolBatch(reduction: CollectionReduction): BatchPlan;
  createExecutionState(plan: BatchPlan): {
    readonly route: 'execute' | 'invalid';
    readonly state: ExecutionState;
  };
  createProtocolNoopResult(step: PlannedStep): Readonly<Record<string, unknown>>;
  createProtocolIgnoreResult(
    step: Extract<PlannedStep, { readonly kind: 'ignore' }>,
  ): Readonly<Record<string, unknown>>;
  mergeTaskResult(
    state: ExecutionState,
    result: Readonly<Record<string, unknown>>,
  ): { readonly state: ExecutionState; readonly done: boolean };
  finalizeBatch(state: ExecutionState): { readonly nextState: ServiceState };
}

const protocolUrl = new URL('../../../javascript_project/service/base_lib/service_protocol.ts', import.meta.url).href;
const protocol = (await import(/* @vite-ignore */ protocolUrl)) as ProtocolModule;

function json(value: unknown): TransportArg {
  return { kind: 'json', value };
}

function event(
  sequence: number,
  type: string,
  occurredAt: number,
  options: Readonly<{
    source?: TransportEvent['source'];
    args?: readonly TransportArg[];
    encodedBytes?: number;
  }> = {},
): TransportEvent {
  return {
    schemaVersion: 1,
    eventId: `event-${sequence}`,
    sequence,
    type,
    occurredAt,
    source: options.source ?? (type.startsWith('era:') ? 'era-api' : 'tavern'),
    args: options.args ?? [],
    encodedBytes: options.encodedBytes ?? 1,
  };
}

function timer(sequence: number, occurredAt: number, token: string): TransportEvent {
  return event(sequence, 'era.service.collection_timer', occurredAt, {
    source: 'timer',
    args: [json(token)],
  });
}

function scheduleOf(control: CollectionControl) {
  const command = control.commands.find(item => item.kind === 'schedule');
  if (command?.kind !== 'schedule') {
    throw new Error('夹具需要 schedule 命令');
  }
  return command;
}

describe('VibeFlow Service 事件集协议', () => {
  it('按首事件产生 100/500/1500ms 绝对截止时间，并由匹配 timer 关闭窗口', () => {
    const fixtures = [
      { type: 'message_received', window: 100 },
      { type: 'message_swiped', window: 500 },
      { type: 'message_updated', window: 1500 },
    ] as const;

    for (const [index, fixture] of fixtures.entries()) {
      const first = event(index * 2 + 1, fixture.type, 10_000 + index * 2_000);
      const waiting = protocol.reduceForProtocolSlice(protocol.createInitialServiceState(), first, {});
      const schedule = scheduleOf(waiting.control);
      expect(waiting.reduction).toMatchObject({
        route: 'wait',
        batchEvents: [],
        throughSequence: null,
        nextState: { collection: [first], timerToken: schedule.token },
      });
      expect(schedule.dueAt).toBe(first.occurredAt + fixture.window);

      const closingTimer = timer(first.sequence + 1, schedule.dueAt, schedule.token);
      const closed = protocol.reduceForProtocolSlice(waiting.reduction.nextState, closingTimer, {});
      expect(closed.reduction).toMatchObject({
        route: 'execute',
        batchEvents: [first, closingTimer],
        throughSequence: closingTimer.sequence,
        nextState: { collection: [], collectionBytes: 0, timerToken: null },
      });
      expect(closed.control.commands).toEqual([{ kind: 'cancel', token: schedule.token }]);
    }
  });

  it('generation、API 0ms 与 dry-run 首事件立即执行，swipe 组合提前取消定时器', () => {
    const initial = protocol.createInitialServiceState();
    const api = event(1, 'era:getCurrentVars', 1_000);
    expect(protocol.reduceForProtocolSlice(initial, api, {}).reduction.route).toBe('execute');

    const dryRun = event(2, 'generation_started', 2_000, {
      args: [json('normal'), json({}), json(true)],
    });
    const dryRunReduction = protocol.reduceForProtocolSlice(initial, dryRun, {}).reduction;
    expect(dryRunReduction.route).toBe('execute');
    expect(protocol.planProtocolBatch(dryRunReduction).steps[0]).toMatchObject({
      kind: 'ignore',
      taskRoute: 'ignore',
      sourceSequences: [2],
    });

    const swipe = event(3, 'message_swiped', 3_000, { args: [json(12)] });
    const waiting = protocol.reduceForProtocolSlice(initial, swipe, {});
    const schedule = scheduleOf(waiting.control);
    const generation = event(4, 'generation_started', 3_600, {
      args: [json('swipe'), json({ automatic: true }), json(false)],
    });
    const combined = protocol.reduceForProtocolSlice(waiting.reduction.nextState, generation, {});
    expect(combined.reduction.route).toBe('execute');
    expect(combined.control.commands).toEqual([{ kind: 'cancel', token: schedule.token }]);

    const plan = protocol.planProtocolBatch(combined.reduction);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({
      taskRoute: 'sync',
      sourceSequences: [3, 4],
    });
    expect(protocol.createExecutionState(plan).route).toBe('execute');
  });

  it('迟到 token 不关闭有效窗口，并在匹配 token 到达时让每个 timer 恰好覆盖一次', () => {
    const first = event(1, 'message_received', 1_000);
    const waiting = protocol.reduceForProtocolSlice(protocol.createInitialServiceState(), first, {});
    const schedule = scheduleOf(waiting.control);

    const stale = timer(2, 1_050, 'stale-token');
    const afterStale = protocol.reduceForProtocolSlice(waiting.reduction.nextState, stale, {});
    expect(afterStale.reduction).toMatchObject({
      route: 'wait',
      batchEvents: [],
      nextState: { collection: [first, stale], timerToken: schedule.token },
    });
    expect(afterStale.control.commands).toEqual([]);

    const current = timer(3, 1_100, schedule.token);
    const closed = protocol.reduceForProtocolSlice(afterStale.reduction.nextState, current, {});
    const plan = protocol.planProtocolBatch(closed.reduction);
    expect(plan.sourceSequences).toEqual([1, 2, 3]);
    expect(plan.steps.flatMap(step => step.sourceSequences).sort((left, right) => left - right)).toEqual([1, 2, 3]);
    expect(protocol.createExecutionState(plan).route).toBe('execute');
  });

  it('达到 128 条或 2MiB 时先执行旧批次，并把已接纳的新事件留给下一绝对窗口', () => {
    const initial = protocol.createInitialServiceState();
    const fullByCount = Array.from({ length: 128 }, (_, index) => event(index + 1, 'message_received', 1_000 + index));
    const countState: ServiceState = {
      ...initial,
      collection: fullByCount,
      collectionBytes: 128,
      timerToken: 'old-count-token',
    };
    const overflow = event(129, 'message_received', 2_000);
    const rolled = protocol.reduceForProtocolSlice(countState, overflow, {});
    expect(rolled.reduction).toMatchObject({
      route: 'execute',
      batchEvents: fullByCount,
      throughSequence: 128,
      nextState: { collection: [overflow], collectionBytes: 1 },
    });
    expect(rolled.control.commands.map(command => command.kind)).toEqual(['cancel', 'schedule']);

    const plan = protocol.planProtocolBatch(rolled.reduction);
    let execution = protocol.createExecutionState(plan);
    expect(execution.route).toBe('execute');
    while (execution.state.index < execution.state.steps.length) {
      const step = execution.state.steps[execution.state.index];
      execution = {
        route: 'execute',
        state: protocol.mergeTaskResult(
          execution.state,
          step.kind === 'ignore' ? protocol.createProtocolIgnoreResult(step) : protocol.createProtocolNoopResult(step),
        ).state,
      };
    }
    expect(protocol.finalizeBatch(execution.state).nextState.collection).toEqual([overflow]);

    const chunkBytes = 262_144;
    const fullByBytes = Array.from({ length: 8 }, (_, index) =>
      event(index + 1, 'message_received', 3_000 + index, { encodedBytes: chunkBytes }),
    );
    const byteState: ServiceState = {
      ...initial,
      collection: fullByBytes,
      collectionBytes: 2_097_152,
      timerToken: 'old-byte-token',
    };
    const byteOverflow = event(9, 'message_received', 4_000);
    expect(protocol.reduceForProtocolSlice(byteState, byteOverflow, {}).reduction).toMatchObject({
      route: 'execute',
      batchEvents: fullByBytes,
      nextState: { collection: [byteOverflow], collectionBytes: 1 },
    });
  });

  it('合并任务结果时原子推进易失连续处理状态，不向事件或持久数据添加版本字段', () => {
    const api = event(1, 'era:getCurrentVars', 1_000);
    const reduction = protocol.reduceForProtocolSlice(protocol.createInitialServiceState(), api, {}).reduction;
    const plan = protocol.planProtocolBatch(reduction);
    const execution = protocol.createExecutionState(plan).state;
    const merged = protocol.mergeTaskResult(execution, {
      status: 'committed',
      settlements: [
        {
          eventId: api.eventId,
          sequence: api.sequence,
          status: 'completed',
          taskId: 'query',
          relation: 'primary',
        },
      ],
      notifications: [],
      diagnostics: [],
      stateUpdate: {
        consecutiveMk: 'mk-1',
        consecutiveProcessingCount: 3,
      },
    }).state;
    expect(merged.nextState).toMatchObject({
      consecutiveMk: 'mk-1',
      consecutiveProcessingCount: 3,
    });
    expect(merged.steps[0]).not.toHaveProperty('schemaVersion');
    expect(Object.prototype.hasOwnProperty.call(merged.nextState, 'stat')).toBe(false);
  });
});
