/**
 * 连接展示层与唯一原生 Service 客户端，转交命令、当前位置接口、生成订阅和回执等待。
 * 客户端依赖宿主生命周期完成安装与注销；领域状态和实际任务执行由原生工作流负责。
 */
import type { EraAdmissionAccepted, EraAdmissionResult, EraEventSource, EraServiceIngress } from './types';

let activeClient: EraNativeClient | null = null;

/** 为了让测试观察原生请求，公开 UI 正在使用的同一客户端；注销器必须核对实例，避免旧资源清理误删新连接。 */
export function installEraServiceClient(adapter: EraNativeClient): () => void {
  if (activeClient && activeClient !== adapter) throw new Error('ERA Service client 已经连接到另一个宿主。');
  activeClient = adapter;
  Reflect.set(globalThis, '__ERA_VIBEFLOW_NATIVE_CLIENT__', adapter);
  let installed = true;
  return () => {
    if (!installed) return;
    installed = false;
    if (activeClient === adapter) activeClient = null;
    if (Reflect.get(globalThis, '__ERA_VIBEFLOW_NATIVE_CLIENT__') === adapter)
      Reflect.deleteProperty(globalThis, '__ERA_VIBEFLOW_NATIVE_CLIENT__');
  };
}

/**
 * 向当前唯一 Service 入站口提交命令。未连接时返回带类型拒绝，避免 UI
 * 绕过 Host receipt 或在热重载停止窗口调用旧实例。
 */
export function requestEraService(
  type: string,
  args: readonly unknown[] = [],
  source: Exclude<EraEventSource, 'timer' | 'tavern'> = 'ui',
): EraAdmissionResult {
  if (!activeClient) {
    return Object.freeze({
      accepted: false,
      code: 'ERA_APP_SERVICE_UNAVAILABLE',
      message: 'ERA Service client 尚未连接。',
    });
  }
  return activeClient.enqueue(type, source, args);
}

/** 捕获调用进入 FIFO 前的当前 Tavern 生命周期，用于写入前陈旧请求复核。 */
export function captureEraLifecycleToken(): number {
  if (!activeClient) throw new Error('ERA_APP_SERVICE_UNAVAILABLE: ERA Service client 尚未连接。');
  return activeClient.currentLifecycleToken();
}

/** 复用宿主现有高水位等待；尚未安装客户端时仍由原状态订阅等待初始化。 */
export async function waitForEraCurrentWork(): Promise<void> {
  if (activeClient) await activeClient.waitForCurrentWork();
}

export function requireAccepted(result: EraAdmissionResult): EraAdmissionAccepted {
  if (!result.accepted) throw new Error(`${result.code}: ${result.message}`);
  return result;
}

/** 原生入口向展示层交付的固定请求接线，不包含运行控制接口。 */
export type EraNativeClient = EraServiceIngress;
export function requestEraFunctionContext(parameters: object): import('./public-api').EraFacade {
  if (!activeClient?.forCall) throw new Error('ERA_FUNCTION_CONTEXT_EXPIRED');
  return activeClient.forCall(parameters);
}
/** 为避免跨实例取消作者任务，将订阅交给原生阶段流程；注销器只清理当前实例的订阅与等待。 */
export function subscribeEraGeneration(
  listener: import('./generation-subscriptions').EraGenerationListener,
  options?: { readonly stages?: readonly import('./generation-subscriptions').EraGenerationStage[] },
): import('./generation-subscriptions').GenerationSubscriptionStop {
  if (!activeClient?.subscribeGeneration) throw new Error('ERA_APP_SERVICE_UNAVAILABLE');
  return activeClient.subscribeGeneration(listener, options);
}
export function clearEraGenerationSubscriptions(): void {
  activeClient?.clearGenerationSubscriptions?.();
}
export function readCurrentAgentSession(): Record<string, unknown> | null {
  if (activeClient?.diagnostics?.().stopping) return null;
  return activeClient?.readAgentSession?.() ?? null;
}
