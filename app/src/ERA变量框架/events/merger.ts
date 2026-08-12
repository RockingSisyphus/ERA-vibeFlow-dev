'use strict';

import { ERA_API_EVENTS } from '../utils/constants';
import { EVENT_COLLISION_RULES, EVENT_COMBO_RULES, INPUT_EVENT, getEventGroup } from './catalog';
import type {
  ApiTask,
  DomainTask,
  InitializeTask,
  PlannedSource,
  PlannedStep,
  RawEvent,
  SyncTask,
  TaskBase,
  UpdateMkTask,
} from './types';

export { EVENT_GROUPS, getEventGroup } from './catalog';

type ComboSemantic = 'edit-and-continue' | 'swipe-and-regenerate';

const MANUAL_SYNC_EVENTS: ReadonlySet<string> = new Set([
  INPUT_EVENT.MANUAL_WRITE,
  INPUT_EVENT.MANUAL_SYNC,
  INPUT_EVENT.MANUAL_FULL_SYNC,
]);

const API_MESSAGE_WRITE_EVENTS: ReadonlySet<string> = new Set([
  ERA_API_EVENTS.INSERT_BY_OBJECT,
  ERA_API_EVENTS.UPDATE_BY_OBJECT,
  ERA_API_EVENTS.INSERT_BY_PATH,
  ERA_API_EVENTS.UPDATE_BY_PATH,
  ERA_API_EVENTS.DELETE_BY_OBJECT,
  ERA_API_EVENTS.DELETE_BY_PATH,
]);

interface WorkUnit {
  effectiveType: string;
  primaryEvent: RawEvent;
  sources: PlannedSource[];
  combo?: ComboSemantic;
}

interface OrderedStep {
  firstSequence: number;
  step: PlannedStep;
}

type TimedEvent = Pick<RawEvent, 'type' | 'occurredAt' | 'args'>;

function eventTime(event: TimedEvent): number {
  return event.occurredAt;
}

function isDryRunGeneration(event: TimedEvent): boolean {
  return event.type === INPUT_EVENT.GENERATION_STARTED && event.args?.[2] === true;
}

/** 酒馆明确请求重新生成当前回复；普通生成、续写和静默生成不得触发回退。 */
function isRegenerateGeneration(event: TimedEvent): boolean {
  return (
    event.type === INPUT_EVENT.GENERATION_STARTED && event.args?.[0] === 'regenerate' && !isDryRunGeneration(event)
  );
}

/** swipe 组合与酒馆显式 regenerate 都要求在放行生成前恢复上一楼状态。 */
function needsPreviousMessageRollback(unit: WorkUnit): boolean {
  return unit.combo === 'swipe-and-regenerate' || isRegenerateGeneration(unit.primaryEvent);
}

function canCompleteCombo(event: TimedEvent): boolean {
  return !isDryRunGeneration(event);
}

function sourceEvents(unit: WorkUnit): RawEvent[] {
  return unit.sources.map(source => source.event);
}

function taskBase(unit: WorkUnit, context: TaskBase['context']): TaskBase {
  const sources = sourceEvents(unit);
  return {
    id: `task:${unit.combo ?? unit.effectiveType}:${sources.map(event => event.id).join('+')}`,
    sourceEvents: sources,
    primaryEvent: unit.primaryEvent,
    context,
  };
}

function syncTask(
  unit: WorkUnit,
  fields: Pick<SyncTask, 'reason' | 'target' | 'context'> & Partial<Pick<SyncTask, 'fullRebuild'>>,
): SyncTask {
  return {
    ...taskBase(unit, fields.context),
    kind: 'sync',
    reason: fields.reason,
    target: fields.target,
    fullRebuild: fields.fullRebuild ?? false,
  };
}

/**
 * 把事件组合翻译成领域任务。dispatcher 只需理解任务意图，
 * 无须再次猜测 `combo_*` 这样的技术性事件名称。
 */
function createDomainTask(unit: WorkUnit): DomainTask | null {
  if (needsPreviousMessageRollback(unit)) {
    return syncTask(unit, {
      reason: 'swipe-regeneration',
      target: { kind: 'previous-of-latest', stopAfterTarget: true },
      context: 'latest-message',
    });
  }

  if (unit.combo === 'edit-and-continue') {
    return syncTask(unit, {
      reason: 'edited',
      target: { kind: 'auto' },
      context: 'latest-message-with-mk',
    });
  }

  const group = getEventGroup(unit.effectiveType);

  if (group === 'INIT') {
    const task: InitializeTask = {
      ...taskBase(unit, 'latest-message-with-mk'),
      kind: 'initialize',
    };
    return task;
  }

  if (group === 'SYNC') {
    const isManual = MANUAL_SYNC_EVENTS.has(unit.effectiveType);

    return syncTask(unit, {
      reason: isManual ? 'manual' : 'history-changed',
      target: { kind: 'auto' },
      context: 'latest-message-with-mk',
      fullRebuild: unit.effectiveType === INPUT_EVENT.MANUAL_FULL_SYNC,
    });
  }

  if (group === 'DIRECTED_SYNC') {
    const messageId = unit.primaryEvent.args[0];
    return syncTask(unit, {
      reason: 'edited',
      target:
        typeof messageId === 'number' && Number.isInteger(messageId) && messageId >= 0
          ? { kind: 'message', messageId, stopAfterTarget: false }
          : { kind: 'auto' },
      context: 'latest-message-with-mk',
    });
  }

  if (group === 'API') {
    const intent: ApiTask['intent'] =
      unit.effectiveType === ERA_API_EVENTS.FORCE_SYNC
        ? 'state-sync'
        : API_MESSAGE_WRITE_EVENTS.has(unit.effectiveType)
          ? 'message-write'
          : 'query';
    const task: ApiTask = {
      ...taskBase(unit, intent === 'query' ? 'none' : 'latest-message-with-mk'),
      kind: 'api',
      intent,
      eventType: unit.effectiveType,
      args: unit.primaryEvent.args,
    };
    return task;
  }

  if (group === 'UPDATE_MK_ONLY') {
    const task: UpdateMkTask = {
      ...taskBase(unit, 'latest-message-with-mk'),
      kind: 'update-mk',
    };
    return task;
  }

  return null;
}

function firstSequenceOf(events: readonly RawEvent[]): number {
  return Math.min(...events.map(event => event.sequence));
}

/**
 * 判断收集中的事件是否形成需要立刻处理的组合。
 * 该函数只读取输入，不依赖队列或定时器，可直接使用假时钟测试边界值。
 */
export function hasImmediateCombo(events: readonly TimedEvent[]): boolean {
  // dry-run 只是酒馆的提示词预演，不是一次真实生成边界。把它视为透明事件，
  // 才不会让 `[swipe, dry-run, real generation]` 丢失本应成立的组合。
  const candidates = events.filter(event => !isDryRunGeneration(event));

  for (let index = 0; index < candidates.length - 1; index++) {
    const current = candidates[index];
    const next = candidates[index + 1];
    const rule = EVENT_COMBO_RULES.find(candidate => candidate.first === current.type);

    if (
      rule?.immediate &&
      next.type === rule.next &&
      canCompleteCombo(next) &&
      eventTime(next) - eventTime(current) <= rule.maxIntervalMs
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 将同一收集窗口中的原始事件规划为领域任务或明确的忽略步骤。
 *
 * 这里最重要的不变量是：每个输入事件都必须出现在某个输出步骤中。
 * Promise 由 scheduler 私有保存，合并器只携带来源与关系，因此不会因合并而遗失 Ticket。
 */
export function planEventBatch(events: readonly RawEvent[]): PlannedStep[] {
  const units: WorkUnit[] = [];
  const ignored: OrderedStep[] = [];

  for (const event of events) {
    if (isDryRunGeneration(event)) {
      ignored.push({
        firstSequence: event.sequence,
        step: {
          kind: 'ignore',
          events: [event],
          reason: `${event.type} 是 dry-run 预演，不参与真实生成组合`,
        },
      });
      continue;
    }

    const current: WorkUnit = {
      effectiveType: event.type,
      primaryEvent: event,
      sources: [{ event, relation: 'primary' }],
    };
    const previous = units.at(-1);

    if (!previous) {
      units.push(current);
      continue;
    }

    const interval = event.occurredAt - previous.primaryEvent.occurredAt;
    const comboRule = EVENT_COMBO_RULES.find(
      rule => rule.first === previous.effectiveType && rule.next === current.effectiveType,
    );

    if (comboRule && canCompleteCombo(current.primaryEvent) && interval <= comboRule.maxIntervalMs) {
      units.pop();
      units.push({
        effectiveType: current.effectiveType,
        primaryEvent: current.primaryEvent,
        combo: comboRule.result,
        sources: [...previous.sources, ...current.sources].map(source => ({
          event: source.event,
          relation: 'combined',
        })),
      });
      continue;
    }

    const collisionRule = EVENT_COLLISION_RULES.find(
      rule => rule.first === previous.effectiveType && rule.next === current.effectiveType,
    );

    if (collisionRule && interval <= collisionRule.maxIntervalMs) {
      units.pop();
      const collidedEvents = [...sourceEvents(previous), event];
      ignored.push({
        firstSequence: firstSequenceOf(collidedEvents),
        step: {
          kind: 'ignore',
          events: collidedEvents,
          reason: `${previous.effectiveType} 与 ${current.effectiveType} 在规则窗口内互相对冲`,
        },
      });
      continue;
    }

    const shouldCoalesce =
      getEventGroup(previous.effectiveType) === 'SYNC' && getEventGroup(current.effectiveType) === 'SYNC';

    if (shouldCoalesce) {
      units[units.length - 1] = {
        ...current,
        sources: [
          ...previous.sources.map(source => ({ event: source.event, relation: 'coalesced' as const })),
          ...current.sources,
        ],
      };
      continue;
    }

    units.push(current);
  }

  const planned: OrderedStep[] = [...ignored];

  for (const unit of units) {
    const unitEvents = sourceEvents(unit);
    const task = createDomainTask(unit);

    if (task) {
      planned.push({
        firstSequence: firstSequenceOf(unitEvents),
        step: { kind: 'execute', task, sources: unit.sources },
      });
      continue;
    }

    planned.push({
      firstSequence: firstSequenceOf(unitEvents),
      step: {
        kind: 'ignore',
        events: unitEvents,
        reason:
          getEventGroup(unit.effectiveType) === 'COLLISION_DETECTORS'
            ? `${unit.effectiveType} 是生成栅栏检测事件，本身无需执行状态任务`
            : `${unit.effectiveType} 没有对应的领域任务`,
      },
    });
  }

  return planned.sort((left, right) => left.firstSequence - right.firstSequence).map(item => item.step);
}
