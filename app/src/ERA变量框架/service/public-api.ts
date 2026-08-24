/**
 * @file ERA 唯一公共对象
 * @description 本模块只负责向角色卡作者提供即时 commit、只读状态、订阅、同步和历史读取；不得承载业务事务，后者由 Service workflow 独占。
 */

import { captureEraLifecycleToken, requestEraService } from './client';
import {
  readActiveSidecarRuntimeSnapshot,
  subscribeSidecarRuntimeSnapshot,
  type SidecarRuntimeSnapshot,
} from './sidecar-runtime-snapshot';
import type { EraSettlement } from './types';
import { removeMetaFields } from '../utils/era_data';
import { unescapeEraData } from '../utils/data';

export const ERA_FACADE_EVENT = {
  COMMIT: 'era.facade.commit',
  SYNC: 'era.facade.sync',
} as const;

export type EraCommitScope = 'message' | 'branch' | 'always';
/** 每个数组元素映射为一个有序 ERA 标签，不在浏览器 facade 中合并或防抖。 */
export type EraCommitOperation =
  | { readonly insert: Readonly<Record<string, unknown>> }
  | { readonly edit: Readonly<Record<string, unknown>> }
  | { readonly delete: Readonly<Record<string, unknown>> }
  | { readonly functionInsert: Readonly<Record<string, unknown>> }
  | { readonly functionEdit: Readonly<Record<string, unknown>> }
  | { readonly functionDelete: Readonly<Record<string, unknown>> };

/** 当前身份对应的 Sidecar 只读投影；loading 时绝不回退到上一聊天或聊天变量。 */
export interface EraPublicState {
  readonly status: 'ready' | 'loading';
  readonly identity: SidecarRuntimeSnapshot['identity'] | null;
  readonly sidecarId: string | null;
  readonly revision: number | null;
  readonly statData: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly eraMeta: Readonly<Record<string, unknown>>;
  readonly stat: unknown;
  readonly statWithoutMeta: unknown;
  readonly selectedMks: readonly (string | null)[];
  readonly editLogs: Readonly<Record<string, unknown>>;
  readonly functionEditLogs: Readonly<Record<string, unknown>>;
  readonly mk: string | null;
  readonly message_id: number | null;
  readonly is_user: false;
}

/** 单次即时提交的结算结果；Promise 返回前消息与 Sidecar 已完成本次提交。 */
export interface EraCommitReceipt {
  readonly status: 'committed' | 'skipped';
  readonly scope: EraCommitScope;
  readonly messageId: number;
  readonly state: EraPublicState;
}

/** 角色卡作者可用的唯一 ERA 公共接口，写入口只有 commit。 */
export interface EraFacade {
  commit(
    operations: readonly EraCommitOperation[],
    options?: Readonly<{ scope?: EraCommitScope }>,
  ): Promise<EraCommitReceipt>;
  get(): EraPublicState;
  subscribe(listener: (state: EraPublicState) => void): () => void;
  sync(options?: Readonly<{ mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }>): Promise<EraPublicState>;
  readonly history: {
    atMessage(messageId: number): Promise<EraPublicState>;
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 从 Sidecar 元数据恢复当前分支的消息密钥序列。 */
function selectedMks(meta: Readonly<Record<string, unknown>>): (string | null)[] {
  return Array.isArray(meta.SelectedMks)
    ? meta.SelectedMks.map(value => (typeof value === 'string' ? value : null))
    : [];
}

/** 定位当前活动分支最后一个已经结算的 ERA 消息。 */
function currentMessage(selected: readonly (string | null)[]): {
  readonly mk: string | null;
  readonly messageId: number | null;
} {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    if (selected[index] !== null) return { mk: selected[index]!, messageId: index };
  }
  return { mk: null, messageId: null };
}

/** 把内部快照裁剪为稳定、深拷贝且不可写的作者视图。 */
function project(snapshot: SidecarRuntimeSnapshot | null, statOverride?: unknown): EraPublicState {
  const meta = snapshot?.eraMeta ?? {};
  const selected = selectedMks(meta);
  const latest = currentMessage(selected);
  const stat = unescapeEraData(structuredClone(statOverride ?? snapshot?.statData ?? {}));
  return Object.freeze({
    status: snapshot === null ? 'loading' : 'ready',
    identity: snapshot === null ? null : structuredClone(snapshot.identity),
    sidecarId: snapshot?.sidecarId ?? null,
    revision: snapshot?.revision ?? null,
    statData: structuredClone(stat),
    statFunc: structuredClone(snapshot?.statFunc ?? {}),
    eraMeta: structuredClone(meta),
    stat: structuredClone(stat),
    statWithoutMeta: removeMetaFields(stat),
    selectedMks: selected,
    editLogs: record(meta.EditLogs) ? structuredClone(meta.EditLogs) : {},
    functionEditLogs: record(meta.FunctionEditLogs) ? structuredClone(meta.FunctionEditLogs) : {},
    mk: latest.mk,
    message_id: latest.messageId,
    is_user: false as const,
  });
}

/** 身份不一致时必须返回 loading，避免旧聊天的内存快照泄漏。 */
function currentIdentityMatches(snapshot: SidecarRuntimeSnapshot): boolean {
  try {
    return (
      snapshot.identity.characterId === getCurrentCharacterId() &&
      snapshot.identity.groupId === (SillyTavern.groupId || null) &&
      snapshot.identity.chatId === SillyTavern.getCurrentChatId()
    );
  } catch {
    return false;
  }
}

/** 同步读取当前页面实例已经发布的 Sidecar 状态。 */
function currentState(): EraPublicState {
  const snapshot = readActiveSidecarRuntimeSnapshot();
  return project(snapshot !== null && currentIdentityMatches(snapshot) ? snapshot : null);
}

/** 将 FIFO 的结构化失败转换成公共 Promise 错误。 */
function errorForSettlement(settlement: EraSettlement): Error {
  if (settlement.status === 'failed') {
    const failure = record(settlement.error) ? settlement.error : {};
    return new Error(`${String(failure.code ?? 'ERA_API_FAILED')}: ${String(failure.message ?? 'ERA 请求失败。')}`);
  }
  if (settlement.status === 'cancelled')
    return new Error(`ERA_API_CANCELLED: ${String(settlement.reason ?? '请求已取消。')}`);
  return new Error(`ERA_API_NOT_COMPLETED: ${settlement.status}`);
}

/** 一次公共调用严格对应一个 Service FIFO 事件和一个 settlement。 */
async function submit(type: string, payload: Readonly<Record<string, unknown>>): Promise<EraSettlement> {
  const admission = requestEraService(type, [payload], 'era-api');
  if (!admission.accepted) throw new Error(`${admission.code}: ${admission.message}`);
  const settlement = await admission.done;
  if (settlement.status !== 'completed') throw errorForSettlement(settlement);
  return settlement;
}

/** 解析 EditLog 使用的点号或方括号路径。 */
function pathSegments(path: unknown): string[] {
  if (Array.isArray(path)) return path.map(String);
  const result: string[] = [];
  String(path).replace(/[^.[\]]+|\[(?:([0-9]+)|["']((?:\\.|[^\\])*)["'])\]/g, (match, numeric, quoted) => {
    result.push(String(numeric ?? quoted ?? match));
    return match;
  });
  return result;
}

/** 在历史只读副本中恢复旧值，不接触 Sidecar 或 Tavern 状态。 */
function setAt(root: unknown, path: unknown, value: unknown): void {
  if (!record(root) && !Array.isArray(root)) return;
  const parts = pathSegments(path);
  let cursor = root as Record<string, unknown>;
  for (let index = 0; index < parts.length; index += 1) {
    const key = parts[index]!;
    if (index === parts.length - 1) cursor[key] = structuredClone(value);
    else {
      if (!record(cursor[key]) && !Array.isArray(cursor[key])) cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
    }
  }
}

/** 在历史只读副本中撤销一次插入。 */
function unsetAt(root: unknown, path: unknown): void {
  if (!record(root) && !Array.isArray(root)) return;
  const parts = pathSegments(path);
  let cursor = root as Record<string, unknown>;
  for (const key of parts.slice(0, -1)) {
    if (!record(cursor[key]) && !Array.isArray(cursor[key])) return;
    cursor = cursor[key] as Record<string, unknown>;
  }
  delete cursor[parts.at(-1)!];
}

/** 将一条日志逆向应用到历史只读副本，拆开分支以保持回滚循环简单。 */
function revertLogEntry(stat: unknown, entry: unknown): void {
  if (!record(entry) || typeof entry.path !== 'string') return;
  if (String(entry.op).toLowerCase() === 'insert') {
    unsetAt(stat, entry.path);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'value_old')) {
    setAt(stat, entry.path, entry.value_old);
    return;
  }
  unsetAt(stat, entry.path);
}

/**
 * 从当前 Sidecar 副本逆向应用 EditLog。历史读取必须保持纯只读，否则查看旧楼层
 * 会改变当前变量或与正在进行的 commit 竞争。
 */
function rollbackToMessage(snapshot: SidecarRuntimeSnapshot, messageId: number): unknown {
  if (!Number.isSafeInteger(messageId) || messageId < 0) throw new TypeError('messageId 必须是非负安全整数。');
  const selected = selectedMks(snapshot.eraMeta);
  if (messageId >= selected.length || selected[messageId] === null)
    throw new RangeError(`消息 #${messageId} 没有 ERA 快照。`);
  const logs = record(snapshot.eraMeta.EditLogs) ? snapshot.eraMeta.EditLogs : {};
  const stat = structuredClone(snapshot.statData);
  for (let index = selected.length - 1; index > messageId; index -= 1) {
    const mk = selected[index];
    const entries = mk === null || !Array.isArray(logs[mk]) ? [] : logs[mk];
    for (let cursor = entries.length - 1; cursor >= 0; cursor -= 1) {
      revertLogEntry(stat, entries[cursor]);
    }
  }
  return stat;
}

/** 订阅只接收当前身份的已提交快照，避免 UI 用事件重放模拟状态。 */
function subscribePublicState(listener: (state: EraPublicState) => void): () => void {
  return subscribeSidecarRuntimeSnapshot(publishPublicState.bind(null, listener));
}

/** 将一次 Sidecar 发布转换为重新核对身份后的公共状态。 */
function publishPublicState(listener: (state: EraPublicState) => void): void {
  listener(currentState());
}

/**
 * 构造无兼容分支的 Facade。所有写入都进入 FIFO，浏览器对象本身只负责参数搬运
 * 与当前快照投影，避免重新形成第二套业务引擎。
 */
export function createEraFacade(): EraFacade {
  return Object.freeze({
    async commit(operations: readonly EraCommitOperation[], options: Readonly<{ scope?: EraCommitScope }> = {}) {
      const scope = options.scope ?? 'message';
      const settlement = await submit(ERA_FACADE_EVENT.COMMIT, {
        command: 'commit',
        scope,
        operations: structuredClone(operations),
        windowToken: captureEraLifecycleToken(),
      });
      const value = record(settlement.value) ? settlement.value : {};
      return Object.freeze({
        status: value.status === 'skipped' ? 'skipped' : 'committed',
        scope,
        messageId: Number(value.messageId ?? currentState().message_id ?? -1),
        state: currentState(),
      });
    },
    get: currentState,
    subscribe: subscribePublicState,
    async sync(options = {}) {
      await submit(ERA_FACADE_EVENT.SYNC, { command: 'sync', ...structuredClone(options) });
      return currentState();
    },
    history: Object.freeze({
      async atMessage(messageId: number) {
        const snapshot = readActiveSidecarRuntimeSnapshot();
        if (snapshot === null || !currentIdentityMatches(snapshot)) throw new Error('ERA_STATE_NOT_READY');
        return project(snapshot, rollbackToMessage(snapshot, messageId));
      },
    }),
  });
}

/**
 * 发布唯一公共对象。stop 后必须让旧引用立即失效，否则热重载前保存的 Facade
 * 仍可能向已停止的 Service 入队，并把事务写到错误的生命周期窗口。
 */
export function installEraPublicApi(): () => void {
  let active = true;
  const facade = createEraFacade();
  const guarded: EraFacade = Object.freeze({
    commit: (operations: readonly EraCommitOperation[], options?: Readonly<{ scope?: EraCommitScope }>) =>
      active ? facade.commit(operations, options) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    get: () => (active ? facade.get() : project(null)),
    /** 停止后的订阅返回空卸载器，不能重新挂到新页面实例。 */
    subscribe: (listener: (state: EraPublicState) => void) => (active ? facade.subscribe(listener) : () => undefined),
    sync: (options?: Readonly<{ mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }>) =>
      active ? facade.sync(options) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    history: Object.freeze({
      atMessage: (messageId: number) =>
        active ? facade.history.atMessage(messageId) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    }),
  });
  initializeGlobal('ERA', guarded);
  return () => {
    active = false;
  };
}
