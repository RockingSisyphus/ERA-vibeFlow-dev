/**
 * 状态栏挂载等待：只等待宿主 DOM 和 Sidecar 发布，不参与作者页面渲染。
 * 所有等待共享实例取消信号，iframe 销毁或运行时停止后立即释放监听。
 */
import { subscribeSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { deriveStatusbarIdentity, type EraStatusbarIdentity } from './statusbar-identity';
import type { ManagedFrame } from './statusbar-runtime-support';

/** 浏览器完成原生解析后才寻找根节点，避免 bootstrap 位于根节点前方时漏绑。 */
export async function waitForStatusbarRoot(frame: ManagedFrame, signal: AbortSignal): Promise<HTMLElement> {
  signal.throwIfAborted();
  if (frame.document.readyState === 'loading') {
    await new Promise<void>((resolve, reject) => {
      const done = (): void => {
        signal.removeEventListener('abort', closed);
        resolve();
      };
      const closed = (): void => {
        frame.document.removeEventListener('DOMContentLoaded', done);
        reject(signal.reason);
      };
      frame.document.addEventListener('DOMContentLoaded', done, { once: true });
      signal.addEventListener('abort', closed, { once: true });
    });
  }
  signal.throwIfAborted();
  const root = frame.document.querySelector<HTMLElement>('[data-era-statusbar-root="v1"]');
  if (!root) throw new Error('ERA_STATUSBAR_ROOT_MISSING');
  root.hidden = true;
  root.inert = true;
  return root;
}

/** MK 与 Sidecar 可能依次发布；未一致时等待下一次真实发布，不能借用最新楼身份。 */
export function waitForStatusbarIdentity(
  pageEpoch: string,
  frame: ManagedFrame,
  root: HTMLElement,
  signal: AbortSignal,
): Promise<EraStatusbarIdentity> {
  return new Promise((resolve, reject) => {
    let settled = false;
    /** 完成或取消时解绑 Sidecar，避免悬空 iframe 保留聊天状态。 */
    let unsubscribe = (): void => undefined;
    const cleanup = (): void => {
      settled = true;
      unsubscribe();
      signal.removeEventListener('abort', closed);
    };
    const closed = (): void => {
      cleanup();
      reject(signal.reason);
    };
    const attempt = (): void => {
      if (settled) return;
      try {
        const identity = deriveStatusbarIdentity(pageEpoch, frame, root);
        cleanup();
        delete frame.document.body.dataset.eraStatusbarIdentityError;
        resolve(identity);
      } catch (error) {
        frame.document.body.dataset.eraStatusbarIdentityError = error instanceof Error ? error.message : String(error);
      }
    };
    if (signal.aborted) {
      closed();
      return;
    }
    signal.addEventListener('abort', closed, { once: true });
    /** 快照发布后重新求证完整身份，不能复用上次失败的部分结果。 */
    const onSnapshot = (): void => queueMicrotask(attempt);
    unsubscribe = subscribeSidecarRuntimeSnapshot(onSnapshot);
    attempt();
  });
}
