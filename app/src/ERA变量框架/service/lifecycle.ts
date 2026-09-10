/*
 * 模块职责：本模块负责编排 ERA 生产运行时的启动、热重载与 pagehide 生命周期，并保证
 * 页面只拥有一个 Host、client、宏和 UI 实例。模块边界：具体 Tavern 操作
 * 由 adapter 执行，领域语义与永久循环仍完全依赖生成的 AOT workflow。
 */

import { installEraServiceClient } from './client';
import { clearSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import type { EraAdmissionResult, EraRuntimeAdapter, EraStartupGateDecision, EraWorkflowHost } from './types';

export const ERA_ADAPTER_GLOBAL_KEY = '__ERA_VIBEFLOW_SERVICE_ADAPTER__';
export const ERA_RUNTIME_GLOBAL_KEY = '__ERA_VIBEFLOW_APP_RUNTIME__';

export interface EraUiLifecycle {
  readonly mounted: boolean;
  stop(): void;
}

export interface EraPageLifecycleTarget {
  addEventListener(type: 'pagehide', listener: () => void, options?: { readonly once?: boolean }): void;
  removeEventListener(type: 'pagehide', listener: () => void): void;
}

export interface EraLifecycleAdapterOptions {
  readonly onScriptVariablesCommitted: () => void;
}

/** 生产入口可替换依赖的完整集合，便于无 Tavern 环境验证生命周期。 */
export interface EraApplicationDependencies {
  readonly globals: Record<string, unknown>;
  readonly pageTarget: EraPageLifecycleTarget;
  readonly startupEventType: string;
  createAdapter(options: EraLifecycleAdapterOptions): EraRuntimeAdapter;
  createHost(): EraWorkflowHost;
  startMacro(): () => void;
  startPublicApi?(): () => void;
  startUi(): EraUiLifecycle;
  refreshSettings(): void;
  dispatchSettingsUpdated(): void;
  /** 等待主 workflow 的安装作用域决议；测试可注入稳定的兼容决议。 */
  awaitStartupGate(adapter: EraRuntimeAdapter): Promise<EraStartupGateDecision>;
  warnInstallationScope(decision: EraStartupGateDecision): void;
  warnAdmission(result: EraAdmissionResult, label: string): void;
  warnStop(error: unknown): void;
  reportFatal(error: unknown): void;
}

/** 已启动应用实例的公开句柄；stop 必须幂等并等待永久 workflow 收尾。 */
export interface EraAppRuntime {
  readonly adapter: EraRuntimeAdapter;
  readonly host: EraWorkflowHost;
  readonly servicePromise: Promise<unknown>;
  readonly ui: EraUiLifecycle;
  readonly stopping: boolean;
  stop(): Promise<void>;
}

function isExpectedStop(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { readonly code?: unknown }).code;
  return code === 'VF_ABORTED' || code === 'VF_HOST_NOT_STARTED' || code === 'ERA_HOST_NOT_STARTED';
}

function clearOwnedGlobal(globals: Record<string, unknown>, key: string, owner: unknown): void {
  if (globals[key] === owner) delete globals[key];
}

function runCleanup(cleanup: () => void, dependencies: EraApplicationDependencies): void {
  try {
    cleanup();
  } catch (error) {
    dependencies.warnStop(error);
  }
}

/** 为 Host 创建失败保留明确的 adapter 全局回收边界。 */
function createOwnedHost(dependencies: EraApplicationDependencies, adapter: EraRuntimeAdapter): EraWorkflowHost {
  try {
    return dependencies.createHost();
  } catch (error) {
    clearOwnedGlobal(dependencies.globals, ERA_ADAPTER_GLOBAL_KEY, adapter);
    throw error;
  }
}

/** 启动回执必须在宏和 UI 挂载前完成，否则首屏可能读取未初始化状态。 */
async function awaitStartupAdmission(
  adapter: EraRuntimeAdapter,
  dependencies: EraApplicationDependencies,
): Promise<void> {
  const admission = adapter.enqueue(dependencies.startupEventType, 'tavern', []);
  dependencies.warnAdmission(admission, '启动初始化事件');
  if (admission.accepted) await admission.done.catch(error => dependencies.warnStop(error));
}

/**
 * 保存运行时拥有的清理句柄。拆出控制器是为了让启动主线只表达固定顺序，
 * 同时确保任何失败路径都复用同一个幂等 stop 实现。
 */
class EraRuntimeController implements EraAppRuntime {
  private currentServicePromise: Promise<unknown> = Promise.resolve();
  private currentUi: EraUiLifecycle = Object.freeze({ mounted: false, stop: () => undefined });
  private disconnectClient = (): void => undefined;
  private stopMacro = (): void => undefined;
  private stopPublicApi = (): void => undefined;
  private detachPagehide = (): void => undefined;
  private stoppingState = false;
  private stopPromise: Promise<void> | null = null;

  constructor(
    readonly adapter: EraRuntimeAdapter,
    readonly host: EraWorkflowHost,
    private readonly dependencies: EraApplicationDependencies,
  ) {}

  get servicePromise(): Promise<unknown> {
    return this.currentServicePromise;
  }

  get ui(): EraUiLifecycle {
    return this.currentUi;
  }

  get stopping(): boolean {
    return this.stoppingState;
  }

  bindService(servicePromise: Promise<unknown>): void {
    this.currentServicePromise = servicePromise;
    void servicePromise.catch(error => {
      if (this.stoppingState || isExpectedStop(error)) return;
      try {
        this.dependencies.reportFatal(error);
      } finally {
        void this.stop();
      }
    });
  }

  bindClient(cleanup: () => void): void {
    this.disconnectClient = cleanup;
  }

  bindMacro(cleanup: () => void): void {
    this.stopMacro = cleanup;
  }

  bindPublicApi(cleanup: () => void): void {
    this.stopPublicApi = cleanup;
  }

  bindUi(ui: EraUiLifecycle): void {
    this.currentUi = ui;
  }

  attachPagehide(): void {
    let attached = true;
    const onPagehide = () => {
      if (!attached) return;
      attached = false;
      this.dependencies.pageTarget.removeEventListener('pagehide', onPagehide);
      void this.stop();
    };
    this.detachPagehide = () => {
      if (!attached) return;
      attached = false;
      this.dependencies.pageTarget.removeEventListener('pagehide', onPagehide);
    };
    this.dependencies.pageTarget.addEventListener('pagehide', onPagehide, { once: true });
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stoppingState = true;
    runCleanup(this.detachPagehide, this.dependencies);
    runCleanup(() => this.adapter.stopAccepting(), this.dependencies);
    runCleanup(this.stopMacro, this.dependencies);
    runCleanup(this.stopPublicApi, this.dependencies);
    clearSidecarRuntimeSnapshot();
    runCleanup(() => this.currentUi.stop(), this.dependencies);
    runCleanup(this.disconnectClient, this.dependencies);
    this.stopPromise = (async () => {
      try {
        // Host.stop 同时取消永久 workflow、receive、timer、receipt 与 Capability。
        await this.host.stop();
      } finally {
        await this.currentServicePromise.catch(error => {
          if (!isExpectedStop(error)) this.dependencies.warnStop(error);
        });
        clearOwnedGlobal(this.dependencies.globals, ERA_ADAPTER_GLOBAL_KEY, this.adapter);
        clearOwnedGlobal(this.dependencies.globals, ERA_RUNTIME_GLOBAL_KEY, this);
      }
    })();
    return this.stopPromise;
  }
}

/**
 * 启动唯一 ERA 生产运行时。
 *
 * 为了避免误装的全局/预设脚本先监听 Tavern，顺序固定为无监听器 Host 启动 →
 * 主 workflow 作用域决议 → allow 后才安装 client/APP_READY/宏/UI。
 */
export async function startEraApplication(dependencies: EraApplicationDependencies): Promise<EraAppRuntime> {
  const previous = dependencies.globals[ERA_RUNTIME_GLOBAL_KEY] as EraAppRuntime | undefined;
  if (previous) await previous.stop();

  const adapter = dependencies.createAdapter({
    onScriptVariablesCommitted: () => {
      dependencies.refreshSettings();
      dependencies.dispatchSettingsUpdated();
    },
  });
  dependencies.globals[ERA_ADAPTER_GLOBAL_KEY] = adapter;
  const host = createOwnedHost(dependencies, adapter);
  const runtime = new EraRuntimeController(adapter, host, dependencies);

  try {
    await host.start();
    runtime.bindService(host.runWorkflowAsync({}));
    const startup = await dependencies.awaitStartupGate(adapter);
    if (startup.warn) dependencies.warnInstallationScope(startup);
    if (startup.route === 'dormant') {
      await runtime.stop();
      return runtime;
    }
    runtime.bindClient(installEraServiceClient(adapter));
    runtime.bindPublicApi(dependencies.startPublicApi?.() ?? (() => undefined));
    dependencies.globals[ERA_RUNTIME_GLOBAL_KEY] = runtime;
    runtime.attachPagehide();
    await awaitStartupAdmission(adapter, dependencies);
    // stop/pagehide 可以在初始化回执等待中拆除 Facade。旧启动续体必须
    // 在这里结束，不能在停止已结算后重新挂载宏、UI 或监听器。
    if (runtime.stopping) {
      await runtime.stop();
      return runtime;
    }
    dependencies.refreshSettings();
    runtime.bindMacro(dependencies.startMacro());
    runtime.bindUi(dependencies.startUi());
    return runtime;
  } catch (error) {
    await runtime.stop();
    throw error;
  }
}
