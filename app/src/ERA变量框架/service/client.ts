import type { EraAdmissionAccepted, EraAdmissionResult, EraEventSource, EraServiceIngress } from './types';

let activeAdapter: EraServiceIngress | null = null;

export function installEraServiceClient(adapter: EraServiceIngress): () => void {
  if (activeAdapter && activeAdapter !== adapter) throw new Error('ERA Service client 已经连接到另一个宿主。');
  activeAdapter = adapter;
  let installed = true;
  return () => {
    if (!installed) return;
    installed = false;
    if (activeAdapter === adapter) activeAdapter = null;
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
  if (!activeAdapter) {
    return Object.freeze({
      accepted: false,
      code: 'ERA_APP_SERVICE_UNAVAILABLE',
      message: 'ERA Service client 尚未连接。',
    });
  }
  return activeAdapter.enqueue(type, source, args);
}

/** 捕获调用进入 FIFO 前的当前 Tavern 生命周期，用于写入前陈旧请求复核。 */
export function captureEraLifecycleToken(): number {
  if (!activeAdapter) throw new Error('ERA_APP_SERVICE_UNAVAILABLE: ERA Service client 尚未连接。');
  return activeAdapter.currentLifecycleToken();
}

export function requireAccepted(result: EraAdmissionResult): EraAdmissionAccepted {
  if (!result.accepted) throw new Error(`${result.code}: ${result.message}`);
  return result;
}
