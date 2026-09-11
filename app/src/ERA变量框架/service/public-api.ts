/**
 * @file ERA 唯一公共对象
 * @description 本模块只负责向角色卡作者提供即时 commit、只读状态、订阅、同步和历史读取；不得承载业务事务，后者由 Service workflow 独占。
 */
import {
  generationSubscriptions,
  type EraGenerationListener,
  type EraGenerationStage,
} from './generation-subscriptions';

import { captureEraLifecycleToken, requestEraService } from './client';
import {
  readActiveSidecarRuntimeSnapshot,
  subscribeSidecarRuntimeSnapshot,
  type SidecarRuntimeSnapshot,
} from './sidecar-runtime-snapshot';
import type { EraSettlement } from './types';
import { currentTavernIdentityMatches, projectPublicState, projectPublicStateAtMessage } from './public-state';
import {
  assertNoPositionBinding,
  positionBoundCommit,
  positionBoundReceipt,
  positionBoundState,
} from './era-position-binding';
import type { EraStatusbarSource } from './statusbar-identity';

export const ERA_FACADE_EVENT = {
  COMMIT: 'era.facade.commit',
  SYNC: 'era.facade.sync',
} as const;

export type EraCommitScope = 'message' | 'branch' | 'always';
export type EraStatusbarOverflow = 'placeholder' | 'empty' | 'hidden';
export type EraGetOptions = Readonly<{ force?: boolean; overflow?: EraStatusbarOverflow }>;
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

/** ERA UI 展示的托管楼层摘要，不包含逐楼完整快照。 */
export interface EraStatusbarListItem {
  readonly messageId: number;
  readonly mk: string;
  readonly active: boolean;
  readonly selected: boolean;
  readonly summary: string;
}

/** 公共 API 只依赖状态栏生命周期端口，不反向依赖具体 Host 实现。 */
export interface EraStatusbarController {
  mount(frameWindow: Window): Promise<void>;
  list(): readonly EraStatusbarListItem[];
  select(messageId: number): Promise<void>;
  clearSelection(): void;
  stop(): void;
}

export type EraStatusbarFactory = (
  facade: EraFacade,
  commitFromStatusbar: (
    source: EraStatusbarSource,
    operations: readonly EraCommitOperation[],
    options?: Readonly<{ scope?: EraCommitScope }>,
  ) => Promise<EraCommitReceipt>,
) => EraStatusbarController;

/** 角色卡作者可用的唯一 ERA 公共接口，写入口只有 commit。 */
export interface EraFacade {
  commit(
    operations: readonly EraCommitOperation[],
    options?: Readonly<{ scope?: EraCommitScope }>,
  ): Promise<EraCommitReceipt>;
  get(options?: EraGetOptions): EraPublicState;
  ready(options?: EraGetOptions): Promise<EraPublicState>;
  subscribe(listener: (state: EraPublicState) => void): () => void;
  sync(options?: Readonly<{ mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }>): Promise<EraPublicState>;
  readonly generation: {
    subscribe(listener: EraGenerationListener, options?: { stages?: readonly EraGenerationStage[] }): () => void;
  };
  readonly history: {
    atMessage(messageId: number): Promise<EraPublicState>;
  };
  readonly statusbar: Pick<EraStatusbarController, 'mount' | 'list' | 'select' | 'clearSelection'>;
}

let installedFacade: EraFacade | null = null;

/** ERA 自身 UI 直接读取同一 bundle 内已经安装的 Facade，不反向依赖跨脚本全局出口。 */
export function getInstalledEraPublicApi(): EraFacade {
  if (installedFacade === null) throw new Error('ERA_APP_SERVICE_UNAVAILABLE');
  return installedFacade;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 同步读取当前页面实例已经发布的 Sidecar 状态。 */
function currentState(): EraPublicState {
  const snapshot = readActiveSidecarRuntimeSnapshot();
  return projectPublicState(snapshot !== null && currentTavernIdentityMatches(snapshot) ? snapshot : null);
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
export function createEraFacade(createStatusbar: EraStatusbarFactory): EraFacade {
  let statusbar: EraStatusbarController | null = null;
  const commit = async (
    operations: readonly EraCommitOperation[],
    options: Readonly<{ scope?: EraCommitScope }> = {},
    sourceContext?: EraStatusbarSource,
  ): Promise<EraCommitReceipt> => {
    const scope = options.scope ?? 'message';
    // 位置绑定调用期间，提交属于调用位置而不是 FIFO：入队会让处理该消息的事件
    // 与等待函数返回的自身互等。scope 跨消息语义在位置上不成立，按类型化拒绝。
    if (positionBoundState() !== null) {
      if (scope !== 'message')
        throw new Error('ERA_POSITION_BOUND_SCOPE_UNSUPPORTED: 位置绑定调用只支持 message 作用域提交。');
      return positionBoundReceipt(await positionBoundCommit(operations));
    }
    const settlement = await submit(ERA_FACADE_EVENT.COMMIT, {
      command: 'commit',
      scope,
      operations: structuredClone(operations),
      windowToken: captureEraLifecycleToken(),
      ...(sourceContext ? { sourceContext: structuredClone(sourceContext) } : {}),
    });
    const value = record(settlement.value) ? settlement.value : {};
    const snapshot = sourceContext ? readActiveSidecarRuntimeSnapshot() : null;
    return Object.freeze({
      status: value.status === 'skipped' ? 'skipped' : 'committed',
      scope,
      messageId: Number(value.messageId ?? sourceContext?.messageId ?? currentState().message_id ?? -1),
      state:
        sourceContext && snapshot ? projectPublicStateAtMessage(snapshot, sourceContext.messageId) : currentState(),
    });
  };
  const facade = {
    commit,
    generation: Object.freeze({ subscribe: generationSubscriptions.subscribe.bind(generationSubscriptions) }),
    // 位置绑定期间读取的是调用位置状态：函数必须看到自己所在位置的变量，而不是旧侧车状态。
    get: () => positionBoundState() ?? currentState(),
    async ready() {
      const immediate = positionBoundState() ?? currentState();
      if (immediate.status === 'ready') return immediate;
      return new Promise<EraPublicState>(resolve => {
        /** 等待期间不向作者暴露上一聊天快照，首个匹配身份的发布才结算。 */
        const onState = (state: EraPublicState): void => {
          if (state.status !== 'ready') return;
          stop();
          resolve(state);
        };
        const stop = subscribePublicState(onState);
      });
    },
    subscribe: subscribePublicState,
    async sync(options = {}) {
      assertNoPositionBinding('ERA.sync');
      await submit(ERA_FACADE_EVENT.SYNC, { command: 'sync', ...structuredClone(options) });
      return currentState();
    },
    history: Object.freeze({
      async atMessage(messageId: number) {
        assertNoPositionBinding('ERA.history');
        const snapshot = readActiveSidecarRuntimeSnapshot();
        if (snapshot === null || !currentTavernIdentityMatches(snapshot)) throw new Error('ERA_STATE_NOT_READY');
        return projectPublicStateAtMessage(snapshot, messageId);
      },
    }),
    get statusbar() {
      assertNoPositionBinding('ERA.statusbar');
      if (statusbar === null) throw new Error('ERA_STATUSBAR_RUNTIME_UNAVAILABLE');
      return statusbar;
    },
  } satisfies EraFacade;
  statusbar = createStatusbar(facade, (source, operations, options) => commit(operations, options, source));
  return Object.freeze(facade);
}

/**
 * 发布唯一公共对象。stop 后必须让旧引用立即失效，否则热重载前保存的 Facade
 * 仍可能向已停止的 Service 入队，并把事务写到错误的生命周期窗口。
 */
export function installEraPublicApi(createStatusbar: EraStatusbarFactory): () => void {
  let active = true;
  const facade = createEraFacade(createStatusbar);
  const guarded: EraFacade = Object.freeze({
    generation: Object.freeze({
      /** 停止后不再接受订阅，避免旧 Facade 把回调挂到新实例。 */
      subscribe: (listener: EraGenerationListener, options?: { stages?: readonly EraGenerationStage[] }) =>
        active ? facade.generation.subscribe(listener, options) : () => undefined,
    }),
    commit: (operations: readonly EraCommitOperation[], options?: Readonly<{ scope?: EraCommitScope }>) =>
      active ? facade.commit(operations, options) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    get: (options?: EraGetOptions) => (active ? facade.get(options) : projectPublicState(null)),
    ready: (options?: EraGetOptions) =>
      active ? facade.ready(options) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    /** 停止后的订阅返回空卸载器，不能重新挂到新页面实例。 */
    subscribe: (listener: (state: EraPublicState) => void) => (active ? facade.subscribe(listener) : () => undefined),
    sync: (options?: Readonly<{ mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }>) =>
      active ? facade.sync(options) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    history: Object.freeze({
      atMessage: (messageId: number) =>
        active ? facade.history.atMessage(messageId) : Promise.reject(new Error('ERA_APP_SERVICE_UNAVAILABLE')),
    }),
    statusbar: facade.statusbar,
  });
  installedFacade = guarded;
  initializeGlobal('ERA', guarded);
  return () => {
    active = false;
    generationSubscriptions.clear();
    if (installedFacade === guarded) installedFacade = null;
    (facade.statusbar as EraStatusbarController).stop();
  };
}
