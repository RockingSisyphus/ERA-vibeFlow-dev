'use strict';

import { ERA_API_EVENTS } from '../utils/constants';

/**
 * 本文件是 ERA 所有输入事件的唯一目录。
 *
 * 这里使用 SillyTavern 的稳定事件字符串，而不在模块加载时读取 `tavern_events` 全局变量。
 * 这样纯事件模块可以在 Node 单元测试中直接导入；浏览器入口仍可用 `tavern_events.*`
 * 注册监听，两边最终得到的是同一个字符串。
 */
export const INPUT_EVENT = {
  APP_READY: 'app_ready',
  MESSAGE_SWIPED: 'message_swiped',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_UPDATED: 'message_updated',
  CHAT_CHANGED: 'chat_id_changed',
  GENERATION_STARTED: 'generation_started',
  MANUAL_WRITE: 'manual_write',
  MANUAL_SYNC: 'manual_sync',
  MANUAL_FULL_SYNC: 'manual_full_sync',
} as const;

export type EventGroup =
  'INIT' | 'SYNC' | 'API' | 'UPDATE_MK_ONLY' | 'COLLISION_DETECTORS' | 'COMBO_STARTERS' | 'DIRECTED_SYNC' | 'UNKNOWN';

export type ListenerOrder = 'first' | 'normal' | 'last';
export type AwaitMode = 'detached' | 'generation-barrier';

export interface EventDefinition {
  type: string;
  group: Exclude<EventGroup, 'UNKNOWN'>;
  listenerOrder: ListenerOrder;
  awaitMode: AwaitMode;
  collectionWindowMs?: number;
  closesCollectionWindow?: boolean;
}

export interface EventComboRule {
  first: string;
  next: string;
  result: 'edit-and-continue' | 'swipe-and-regenerate';
  maxIntervalMs: number;
  immediate: boolean;
}

export interface EventCollisionRule {
  first: string;
  next: string;
  maxIntervalMs: number;
}

export const DEFAULT_COLLECTION_WINDOW_MS = 100;

const API_EVENT_TYPES = Object.values(ERA_API_EVENTS);

const EVENT_DEFINITIONS: EventDefinition[] = [
  {
    type: INPUT_EVENT.APP_READY,
    group: 'INIT',
    listenerOrder: 'normal',
    awaitMode: 'detached',
  },
  ...[
    INPUT_EVENT.MANUAL_WRITE,
    INPUT_EVENT.MESSAGE_RECEIVED,
    INPUT_EVENT.MESSAGE_DELETED,
    INPUT_EVENT.MESSAGE_SWIPED,
    INPUT_EVENT.CHAT_CHANGED,
    INPUT_EVENT.MANUAL_SYNC,
    INPUT_EVENT.MANUAL_FULL_SYNC,
  ].map(
    type =>
      ({
        type,
        group: 'SYNC',
        listenerOrder: 'normal',
        awaitMode: 'detached',
        collectionWindowMs: type === INPUT_EVENT.MESSAGE_SWIPED ? 500 : undefined,
      }) satisfies EventDefinition,
  ),
  ...API_EVENT_TYPES.map(
    type =>
      ({
        type,
        group: 'API',
        listenerOrder: 'normal',
        awaitMode: 'detached',
        collectionWindowMs: 0,
      }) satisfies EventDefinition,
  ),
  {
    type: INPUT_EVENT.MESSAGE_SENT,
    group: 'UPDATE_MK_ONLY',
    listenerOrder: 'normal',
    awaitMode: 'detached',
  },
  {
    type: INPUT_EVENT.GENERATION_STARTED,
    group: 'COLLISION_DETECTORS',
    listenerOrder: 'first',
    awaitMode: 'generation-barrier',
    collectionWindowMs: 0,
    closesCollectionWindow: true,
  },
  {
    type: INPUT_EVENT.MESSAGE_UPDATED,
    group: 'COMBO_STARTERS',
    listenerOrder: 'normal',
    awaitMode: 'detached',
    collectionWindowMs: 1500,
  },
  {
    type: INPUT_EVENT.MESSAGE_EDITED,
    group: 'DIRECTED_SYNC',
    listenerOrder: 'normal',
    awaitMode: 'detached',
  },
];

export const EVENT_CATALOG: ReadonlyMap<string, EventDefinition> = new Map(
  EVENT_DEFINITIONS.map(definition => [definition.type, Object.freeze(definition)]),
);

export const EVENT_COMBO_RULES: readonly EventComboRule[] = [
  {
    first: INPUT_EVENT.MESSAGE_UPDATED,
    next: INPUT_EVENT.GENERATION_STARTED,
    result: 'edit-and-continue',
    maxIntervalMs: 1500,
    immediate: true,
  },
  {
    first: INPUT_EVENT.MESSAGE_SWIPED,
    next: INPUT_EVENT.GENERATION_STARTED,
    result: 'swipe-and-regenerate',
    maxIntervalMs: 600,
    immediate: true,
  },
];

export const EVENT_COLLISION_RULES: readonly EventCollisionRule[] = [];

function eventTypesIn(group: Exclude<EventGroup, 'UNKNOWN'>): string[] {
  return EVENT_DEFINITIONS.filter(definition => definition.group === group).map(definition => definition.type);
}

/**
 * 保留原来的分组导出，让现有调用方可以渐进迁移；数组中只包含真实输入事件，
 * combo 已经是合并器产生的领域语义，不再伪装成可监听事件。
 */
export const EVENT_GROUPS = {
  INIT: eventTypesIn('INIT'),
  SYNC: eventTypesIn('SYNC'),
  API: eventTypesIn('API'),
  UPDATE_MK_ONLY: eventTypesIn('UPDATE_MK_ONLY'),
  COLLISION_DETECTORS: eventTypesIn('COLLISION_DETECTORS'),
  COMBO_STARTERS: eventTypesIn('COMBO_STARTERS'),
  DIRECTED_SYNC: eventTypesIn('DIRECTED_SYNC'),
} as const;

export const LISTENED_EVENT_TYPES = EVENT_DEFINITIONS.map(definition => definition.type);

export function getEventDefinition(eventType: string): EventDefinition | undefined {
  return EVENT_CATALOG.get(eventType);
}

export function getEventGroup(eventType: string): EventGroup {
  return getEventDefinition(eventType)?.group ?? 'UNKNOWN';
}

export function getCollectionWindowMs(eventType: string): number {
  return getEventDefinition(eventType)?.collectionWindowMs ?? DEFAULT_COLLECTION_WINDOW_MS;
}

export function shouldCloseCollectionWindow(eventType: string, args: readonly unknown[] = []): boolean {
  const definition = getEventDefinition(eventType);
  if (!definition?.closesCollectionWindow) {
    return false;
  }

  // GENERATION_STARTED 的第三个参数表示 dry_run。预演不会真正发出本轮请求，
  // 因此既不需要生成栅栏，也不应把它误判为 swipe 再生成组合。
  return !(eventType === INPUT_EVENT.GENERATION_STARTED && args[2] === true);
}
