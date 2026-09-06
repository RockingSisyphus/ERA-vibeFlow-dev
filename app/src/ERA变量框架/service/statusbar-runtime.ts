/**
 * ERA 托管状态栏 V2 的页面实例运行时。
 *
 * 本模块只管理 iframe 身份、有限的按楼投影和显示更新。持久化真相仍是
 * Sidecar 最新状态加完整日志；这里不得写入或保存逐楼快照集合。
 */

import { projectFloorSnapshots } from '@era/vibeflow-floor-snapshot';
import { settings } from '../utils/era_data';
import {
  currentTavernIdentityMatches,
  projectPublicState,
  projectPublicStateAtMessage,
  selectedMks,
} from './public-state';
import { readActiveSidecarRuntimeSnapshot, subscribeSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { activeMessageText } from './statusbar-message-identity';
import { createPendingStatusbarFacade } from './statusbar-facade';
import { waitForStatusbarIdentity, waitForStatusbarRoot } from './statusbar-mount';
import { verifyStatusbarIdentity, type EraStatusbarIdentity, type EraStatusbarSource } from './statusbar-identity';
import type {
  EraCommitOperation,
  EraCommitReceipt,
  EraCommitScope,
  EraFacade,
  EraGetOptions,
  EraPublicState,
  EraStatusbarController,
  EraStatusbarListItem,
  EraStatusbarOverflow,
} from './public-api';
import {
  activeStatusbarMessageIds,
  collectMacroBindings,
  effectiveOverflow,
  managedStatusbarMessageIds,
  projectionKey,
  record,
  sourceMatches,
  summaryFor,
  rootForcesDisplay,
  updateMacroBindings,
  type MacroBinding,
  type ManagedFrame,
} from './statusbar-runtime-support';

export type { EraStatusbarIdentity, EraStatusbarSource } from './statusbar-identity';

interface RuntimeDependencies {
  readonly facade: EraFacade;
  readonly commitFromStatusbar: (
    source: EraStatusbarSource,
    operations: readonly EraCommitOperation[],
    options?: Readonly<{ scope?: EraCommitScope }>,
  ) => Promise<EraCommitReceipt>;
}

interface Instance {
  readonly identity: EraStatusbarIdentity;
  readonly source: EraStatusbarSource;
  readonly frame: ManagedFrame;
  readonly root: HTMLElement;
  readonly disposeFacade: () => void;
  readonly listeners: Set<(state: EraPublicState) => void>;
  readonly readyWaiters: Set<{ resolve: (state: EraPublicState) => void; reject: (error: Error) => void }>;
  macroBindings: MacroBinding[];
  overflowRoot: HTMLElement | null;
  state: EraPublicState | null;
  activated: boolean;
  disposed: boolean;
  force: boolean;
  overflow: EraStatusbarOverflow;
}

let activeRuntime: EraStatusbarRuntime | null = null;

class EraStatusbarRuntime implements EraStatusbarController {
  private readonly pageEpoch = globalThis.crypto?.randomUUID?.() ?? `era-page-${Date.now()}-${Math.random()}`;
  private readonly instances = new Map<string, Instance>();
  // iframe reload 保留 WindowProxy 却替换 Document；挂载去重必须跟随文档而不是窗口。
  private readonly mounts = new WeakMap<Document, Promise<void>>();
  private readonly mountControllers = new Set<AbortController>();
  private selectedMessageId: number | null = null;
  private stopped = false;
  private readonly unsubscribeSnapshot: () => void;
  private projectionRevision: string | null = null;
  private readonly projectionCache = new Map<number, EraPublicState>();
  private readonly settingsHandler = () => void this.refreshAll();

  /** 登记唯一页面运行时，防止重复订阅对同一 iframe 多次推送。 */
  constructor(private readonly dependencies: RuntimeDependencies) {
    /** Sidecar 发布只驱动原地投影，绝不调用消息重绘。 */
    const onSnapshot = (): void => void this.refreshAll();
    this.unsubscribeSnapshot = subscribeSidecarRuntimeSnapshot(onSnapshot);
    if (typeof window !== 'undefined') window.addEventListener('era-settings-updated', this.settingsHandler);
    activeRuntime?.stop();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- Host 写入前必须从页面唯一运行时复核不透明实例来源。
    activeRuntime = this;
  }

  /**
   * 一次历史遍历同时生成所有激活楼层，避免每个 iframe 重复回放日志。
   * 缓存键变化后整体替换，不保留过往 revision 的逐楼快照。
   */
  private primeProjectionCache(): void {
    const snapshot = readActiveSidecarRuntimeSnapshot();
    const key = projectionKey(snapshot, this.selectedMessageId, settings.value['历史状态栏显示范围']);
    if (snapshot === null || key === null || !currentTavernIdentityMatches(snapshot)) {
      this.projectionRevision = null;
      this.projectionCache.clear();
      return;
    }
    if (this.projectionRevision === key) return;
    const desired = new Set(this.activeMessageIds());
    for (const instance of this.instances.values()) {
      if (instance.force && !instance.disposed) desired.add(instance.identity.messageId);
    }
    // 宿主可先创建新楼 DOM；在 SelectedMks 发布前它尚无可投影的历史状态。
    const committed = selectedMks(snapshot.eraMeta);
    for (const messageId of desired) if (!committed[messageId]) desired.delete(messageId);
    const floors = projectFloorSnapshots({
      messageIds: [...desired],
      stat: snapshot.statData,
      statFunc: snapshot.statFunc,
      meta: snapshot.eraMeta,
    });
    this.projectionCache.clear();
    for (const floor of floors) this.projectionCache.set(floor.messageId, projectPublicState(snapshot, floor));
    this.projectionRevision = key;
  }

  /**
   * 设置或 Sidecar 发布后串行刷新存活实例。
   * 单个已删除 iframe 的失败由身份复核隔离，不应阻断其他楼层。
   */
  private async refreshAll(): Promise<void> {
    this.projectionRevision = null;
    try {
      this.primeProjectionCache();
    } catch {
      this.projectionCache.clear();
    }
    for (const instance of this.instances.values()) await this.refresh(instance);
  }

  /** 范围计算统一使用角色卡托管消息集，不对普通消息分配快照。 */
  private activeMessageIds(): Set<number> {
    return activeStatusbarMessageIds(
      managedStatusbarMessageIds(),
      this.selectedMessageId,
      settings.value['历史状态栏显示范围'],
    );
  }

  /**
   * 为单个 iframe 安装不可伪造来源的 Facade。
   * 只有 commit 绑定本楼；sync 与显式 history 仍共享顶层公共契约。
   */
  private localFacade(instance: Instance): EraFacade {
    const globalFacade = this.dependencies.facade;
    /** 本楼订阅必须首次立即推送已就绪快照，避免作者漏掉挂载前的值。 */
    const subscribeLocal = (listener: (state: EraPublicState) => void): (() => void) => {
      instance.listeners.add(listener);
      if (instance.state) listener(instance.state);
      return () => instance.listeners.delete(listener);
    };
    const localFacade: EraFacade = Object.freeze({
      commit: (operations: readonly EraCommitOperation[], options?: Readonly<{ scope?: EraCommitScope }>) => {
        if (!instance.state || !this.verifyCurrentIdentity(instance))
          return Promise.reject(new Error('ERA_STATUSBAR_NOT_READY'));
        return this.dependencies.commitFromStatusbar(instance.source, operations, options);
      },
      get: (options: EraGetOptions = {}) => this.getForInstance(instance, options),
      ready: (options: EraGetOptions = {}) => this.readyForInstance(instance, options),
      subscribe: subscribeLocal,
      sync: (options?: Readonly<{ mode?: 'auto' | 'latest' | 'full'; rollbackTo?: number }>) =>
        globalFacade.sync(options),
      history: globalFacade.history,
      statusbar: globalFacade.statusbar,
    });
    return localFacade;
  }

  /**
   * 同步读只返回已激活本楼；未就绪时返回 loading 而非最新楼。
   * force 只扩展这一存活实例，不更改全局历史范围。
   */
  private getForInstance(instance: Instance, options: EraGetOptions): EraPublicState {
    let refreshNeeded = false;
    if (options.overflow && options.overflow !== instance.overflow) {
      instance.overflow = options.overflow;
      refreshNeeded = true;
    }
    if (options.force && !instance.force) {
      instance.force = true;
      this.projectionRevision = null;
      refreshNeeded = true;
    }
    if (refreshNeeded) void this.refresh(instance);
    return instance.state ?? projectPublicState(null);
  }

  /** 确定性读取在本楼快照就绪前保持等待，不用延时猜测宿主时序。 */
  private readyForInstance(instance: Instance, options: EraGetOptions): Promise<EraPublicState> {
    let refreshNeeded = false;
    if (options.overflow && options.overflow !== instance.overflow) {
      instance.overflow = options.overflow;
      refreshNeeded = true;
    }
    if (options.force && !instance.force) {
      instance.force = true;
      this.projectionRevision = null;
      refreshNeeded = true;
    }
    if (refreshNeeded) void this.refresh(instance);
    if (instance.state !== null) return Promise.resolve(instance.state);
    return new Promise((resolve, reject) => instance.readyWaiters.add({ resolve, reject }));
  }

  /**
   * 超出范围时作者模板与脚本都不激活。
   * 已激活实例只隐藏原 DOM，不销毁重建，以防再次执行加载写入。
   */
  private showOverflow(instance: Instance): void {
    const document = instance.frame.document;
    const behavior = instance.overflow;
    // 休眠楼层不得继续持有完整变量/函数投影；重新激活时再从日志按需计算。
    instance.state = null;
    document.body.dataset.eraManagedStatusbarV2 = 'overflow';
    instance.root.hidden = true;
    instance.root.inert = true;
    instance.overflowRoot?.remove();
    instance.overflowRoot = null;
    if (behavior !== 'placeholder') return;
    const placeholder = document.createElement('div');
    placeholder.dataset.eraStatusbarOverflow = 'placeholder';
    placeholder.textContent = `ERA 已休眠消息 #${instance.identity.messageId} 的历史状态栏。`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '显示本楼状态栏';
    /** 只在明确点击时申请额外投影，避免占位栏加载本身激活历史脚本。 */
    const expand = async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await this.select(instance.identity.messageId);
      } catch (error) {
        button.disabled = false;
        button.textContent = `显示失败，点击重试：${String(error)}`;
      }
    };
    button.addEventListener('click', expand);
    placeholder.append(button);
    instance.root.after(placeholder);
    instance.overflowRoot = placeholder;
  }

  /** 重新进入范围时复用原激活 DOM，只恢复可见性与宏绑定。 */
  private restoreActive(instance: Instance): void {
    const document = instance.frame.document;
    instance.overflowRoot?.remove();
    instance.overflowRoot = null;
    instance.root.hidden = false;
    instance.root.inert = false;
    document.body.dataset.eraManagedStatusbarV2 = 'ready';
    if (this.selectedMessageId === instance.identity.messageId) {
      const collapse = document.createElement('button');
      collapse.type = 'button';
      collapse.dataset.eraStatusbarCollapse = 'true';
      collapse.textContent = '收起本楼状态栏';
      /** 仅恢复范围策略，不销毁作者节点或模拟新一轮加载。 */
      const clear = () => this.clearSelection();
      collapse.addEventListener('click', clear);
      instance.root.after(collapse);
      instance.overflowRoot = collapse;
    }
  }

  /**
   * 身份、楼层快照与宏全部就绪后显示现有根节点。作者脚本由浏览器执行。
   */
  private async activate(instance: Instance): Promise<void> {
    if (instance.activated || instance.disposed || instance.state === null) return;
    const document = instance.frame.document;
    instance.macroBindings = collectMacroBindings(instance.root);
    updateMacroBindings(instance);
    this.restoreActive(instance);
    document.body.dataset.eraStatusbarInstanceId = instance.identity.instanceId;
    document.body.dataset.eraStatusbarMessageId = String(instance.identity.messageId);
    document.body.dataset.eraStatusbarMk = instance.identity.mk;
    instance.activated = true;
  }

  /** 每次读或写前重新核对当前 Swipe 与 MK，旧 iframe 不得跨分支继续活动。 */
  private verifyCurrentIdentity(instance: Instance): boolean {
    return !instance.disposed && !instance.frame.closed && verifyStatusbarIdentity(instance.identity);
  }

  /**
   * 单实例更新先完成身份复核和范围决策，再发布给作者订阅。
   * 无效身份保持不可见 loading，绝不保留上一 revision 的可见数值。
   */
  private async refresh(instance: Instance): Promise<void> {
    if (this.stopped || instance.disposed) return;
    if (!this.verifyCurrentIdentity(instance)) {
      instance.state = null;
      const body = instance.frame.document.body;
      body.dataset.eraManagedStatusbarV2 = 'loading';
      instance.root.hidden = true;
      instance.root.inert = true;
      return;
    }
    const inRange = this.activeMessageIds().has(instance.identity.messageId);
    if (!inRange && !instance.force) {
      this.showOverflow(instance);
      return;
    }
    const snapshot = readActiveSidecarRuntimeSnapshot();
    if (snapshot === null) return;
    this.primeProjectionCache();
    const state =
      this.projectionCache.get(instance.identity.messageId) ??
      projectPublicStateAtMessage(snapshot, instance.identity.messageId);
    instance.state = state;
    instance.frame.document.body.dataset.eraStatusbarRevision = state.revision === null ? '' : String(state.revision);
    if (!instance.activated) await this.activate(instance);
    else {
      updateMacroBindings(instance);
      this.restoreActive(instance);
    }
    for (const listener of [...instance.listeners]) listener(state);
    for (const waiter of [...instance.readyWaiters]) waiter.resolve(state);
    instance.readyWaiters.clear();
  }

  /** 真实 iframe 挂载只在三路 messageId 和 MK/Sidecar 同时一致后完成。 */
  mount(rawFrame: Window): Promise<void> {
    if (this.stopped) throw new Error('ERA_STATUSBAR_RUNTIME_UNAVAILABLE');
    const document = rawFrame.document;
    const existing = this.mounts.get(document);
    if (existing) return existing;
    const frame = rawFrame as ManagedFrame;
    const pending = createPendingStatusbarFacade(this.dependencies.facade);
    const controller = new AbortController();
    this.mountControllers.add(controller);
    Object.defineProperty(frame, 'ERA', { value: pending.facade, configurable: true, enumerable: true });
    /** 同一个取消信号覆盖 DOM 等待、身份等待和未完成 ready，避免卸载后泄漏。 */
    const closed = (): void => {
      controller.abort(new Error('ERA_STATUSBAR_FRAME_CLOSED'));
      pending.dispose();
      this.mountControllers.delete(controller);
    };
    frame.addEventListener('pagehide', closed, { once: true });
    /** 停止运行时释放原 iframe 的页面监听，避免闭包保留已停止的运行实例。 */
    const removePageListener = (): void => frame.removeEventListener('pagehide', closed);
    controller.signal.addEventListener('abort', removePageListener, { once: true });
    const mounted = this.bindFrame(frame, pending, controller.signal).catch(error => {
      pending.dispose(error instanceof Error ? error : new Error(String(error)));
      throw error;
    });
    this.mounts.set(document, mounted);
    return mounted;
  }

  /** 等待原生解析后只绑定现有根节点，保留作者 CSS、监听器与表单实例。 */
  private async bindFrame(
    frame: ManagedFrame,
    pending: ReturnType<typeof createPendingStatusbarFacade>,
    signal: AbortSignal,
  ): Promise<void> {
    const root = await waitForStatusbarRoot(frame, signal);
    frame.document.body.dataset.eraStatusbarLazyTokenCount = String(
      root.innerHTML.match(/__ERA_LAZY_MACRO_V2_/gu)?.length ?? 0,
    );
    frame.document.body.dataset.eraStatusbarLiteralMacroCount = String(
      root.innerHTML.match(/\{\{ERA(?:-withmeta)?:/giu)?.length ?? 0,
    );
    const identity = await waitForStatusbarIdentity(this.pageEpoch, frame, root, signal);
    const source: EraStatusbarSource = { kind: 'managed-statusbar-v2', ...identity };
    const instance: Instance = {
      identity,
      source,
      frame,
      root,
      disposeFacade: () => pending.dispose(),
      listeners: new Set(),
      readyWaiters: new Set(),
      macroBindings: [],
      overflowRoot: null,
      state: null,
      activated: false,
      disposed: false,
      force: rootForcesDisplay(root),
      overflow: effectiveOverflow(root, settings.value['历史状态栏超出范围行为']),
    };
    this.instances.set(identity.instanceId, instance);
    pending.bind(this.localFacade(instance));
    /** iframe 销毁后立即释放投影和监听，避免缓存随历史楼数增长。 */
    const onPagehide = (): void => {
      instance.disposed = true;
      instance.disposeFacade();
      instance.listeners.clear();
      for (const waiter of instance.readyWaiters) waiter.reject(new Error('ERA_STATUSBAR_FRAME_CLOSED'));
      instance.readyWaiters.clear();
      this.instances.delete(identity.instanceId);
      this.projectionCache.delete(identity.messageId);
      this.projectionRevision = null;
    };
    frame.addEventListener('pagehide', onPagehide, { once: true });
    await this.refresh(instance);
  }

  /** ERA UI 仅读取楼层摘要和激活标记，不触发历史快照持久化。 */
  list(): readonly EraStatusbarListItem[] {
    const active = this.activeMessageIds();
    const selected = selectedMks(readActiveSidecarRuntimeSnapshot()?.eraMeta ?? {});
    return managedStatusbarMessageIds()
      .filter(messageId => selected[messageId] !== null && selected[messageId] !== undefined)
      .map(messageId => ({
        messageId,
        mk: selected[messageId]!,
        active: active.has(messageId),
        selected: this.selectedMessageId === messageId,
        summary: summaryFor(activeMessageText(SillyTavern.chat?.[messageId]) ?? ''),
      }));
  }

  /** 原地展开只操作已挂载实例，永不为查看历史而刷新消息。 */
  async select(messageId: number): Promise<void> {
    if (
      ![...this.instances.values()].some(instance => instance.identity.messageId === messageId && !instance.disposed)
    ) {
      throw new RangeError(`消息 #${messageId} 没有已挂载的托管状态栏。`);
    }
    this.selectedMessageId = messageId;
    this.projectionRevision = null;
    for (const instance of this.instances.values()) await this.refresh(instance);
  }

  /** 取消指定后立即回归全局范围，同时释放额外楼层投影。 */
  clearSelection(): void {
    this.selectedMessageId = null;
    void this.refreshAll();
  }

  /** 只返回页面唯一运行时中仍存活且再次核对通过的来源。 */
  verifySource(value: unknown): EraStatusbarSource | null {
    if (!record(value) || value.kind !== 'managed-statusbar-v2') return null;
    const candidate = value as unknown as EraStatusbarSource;
    const instance = this.instances.get(candidate.instanceId);
    return instance && sourceMatches(instance.source, candidate) && this.verifyCurrentIdentity(instance)
      ? structuredClone(instance.source)
      : null;
  }

  /** 页面卸载时必须失效 pageEpoch 及全部内存投影，避免重启后复用旧身份。 */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.unsubscribeSnapshot();
    for (const controller of this.mountControllers) controller.abort(new Error('ERA_STATUSBAR_RUNTIME_UNAVAILABLE'));
    this.mountControllers.clear();
    if (typeof window !== 'undefined') window.removeEventListener('era-settings-updated', this.settingsHandler);
    for (const instance of this.instances.values()) {
      instance.disposed = true;
      instance.disposeFacade();
      instance.listeners.clear();
      for (const waiter of instance.readyWaiters) waiter.reject(new Error('ERA_STATUSBAR_RUNTIME_UNAVAILABLE'));
      instance.readyWaiters.clear();
    }
    this.instances.clear();
    this.projectionCache.clear();
    this.projectionRevision = null;
    if (activeRuntime === this) activeRuntime = null;
  }
}

export function createEraStatusbarRuntime(
  facade: EraFacade,
  commitFromStatusbar: RuntimeDependencies['commitFromStatusbar'],
): EraStatusbarController {
  return new EraStatusbarRuntime({ facade, commitFromStatusbar });
}

/** Host capability 在写消息前重新核对，外部 options 无法伪造页面实例来源。 */
export function verifyEraStatusbarCommitSource(value: unknown): EraStatusbarSource | null {
  return activeRuntime?.verifySource(value) ?? null;
}
