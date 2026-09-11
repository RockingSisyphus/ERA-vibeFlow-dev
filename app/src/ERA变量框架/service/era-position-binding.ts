/**
 * @file ERA 消息内函数调用的位置门面
 * @description 函数运行期间把 `ERA.commit` / `ERA.get` 接到**调用位置**：提交记录为
 * 该调用的操作并随消息重放生效，读取看到的是调用位置的累计状态（已提交侧车状态 +
 * 本条消息调用之前的块）。**绝不入队**——否则处理该消息的 FIFO 事件会与等待函数
 * 返回的自身互等。
 *
 * 为什么读取不回显本次函数自己的写入：把一次提交立刻并入位置状态需要一整套
 * 变量路径与表达式求值（真实 source 在 Service 的 CRUD 引擎里）。宿主复制一套会让
 * 两侧状态分歧，而入队求值会死锁。因此函数内不要依赖 `ERA.get()` 读回自己刚提交的
 * 效果；需要读回时请在函数内自行维护派生值。
 */

import { currentTavernIdentityMatches, projectPublicState } from './public-state';
import { readActiveSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import type { EraCommitOperation, EraCommitReceipt, EraPublicState } from './public-api';

/** 位置绑定提交的回执；与宿主调用会话保持一致的三态语义。 */
export interface EraPositionBindingReceipt {
  readonly status: 'applied' | 'rejected';
  readonly sequence: number | null;
  readonly message: string;
}

/** 位置绑定上下文的输入；全部来自 Service 交出的调用位置事实。 */
export interface EraPositionBindingInput {
  readonly invocationId: string;
  readonly messageId: number;
  readonly mk: string;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly commit: (operations: readonly EraCommitOperation[]) => Promise<EraPositionBindingReceipt>;
}

interface ActivePositionBinding extends EraPositionBindingInput {
  readonly scope: 'position';
}

/** 同一时刻只服务一个位置绑定调用；并发调用由宿主调用会话先行拒绝。 */
let activeBinding: ActivePositionBinding | null = null;

export function activateEraPositionBinding(input: EraPositionBindingInput): void {
  activeBinding = { ...input, scope: 'position' };
}

/** 只有当前调用自己能摘掉绑定，迟到的清理不会摘掉后来者的上下文。 */
export function deactivateEraPositionBinding(invocationId: string): void {
  if (activeBinding?.invocationId === invocationId) activeBinding = null;
}

export function activeEraPositionBindingId(): string | null {
  return activeBinding?.invocationId ?? null;
}

/** 位置绑定上下文不支持入口的类型化拒绝。 */
export function positionBindingUnsupported(api: string): Error {
  return new Error(
    `ERA_POSITION_BOUND_UNSUPPORTED: 位置绑定调用中不支持 ${api}；请在函数外使用，或在函数内只做 ERA.commit / ERA.get。`,
  );
}

/**
 * 调用位置的公共状态投影。
 *
 * 身份、MK 链与日志仍取自当前已提交侧车快照，只有变量与函数库换成调用位置的累计值
 * ——函数必须看到自己所在位置的变量，否则它读到的是旧侧车状态，产出的操作会按错误
 * 的基线计算。没有绑定或快照身份不匹配时返回 null，避免把上一聊天的状态当成当前
 * 位置；由调用方决定回退行为（按已提交状态返回或直接报错）。
 */
export function positionBoundState(): EraPublicState | null {
  if (activeBinding === null) return null;
  const snapshot = readActiveSidecarRuntimeSnapshot();
  if (snapshot === null || !currentTavernIdentityMatches(snapshot)) return null;
  return projectPublicState(snapshot, {
    messageId: activeBinding.messageId,
    mk: activeBinding.mk,
    stat: activeBinding.stat,
    statFunc: activeBinding.statFunc,
  });
}

/**
 * 位置绑定提交：记录为本次调用的操作并返回回执。
 *
 * **不得**改成入队：处理该消息的 FIFO 事件正在等待函数返回，入队会让双方互等、
 * 工作流永不前进。越界提交（如迟到回调、函数之外提交）必须按类型化拒绝回送，
 * 否则调用方会把没生效的写入当成成功。
 */
export async function positionBoundCommit(
  operations: readonly EraCommitOperation[],
): Promise<EraPositionBindingReceipt> {
  const binding = activeBinding;
  if (binding === null) {
    return {
      status: 'rejected',
      sequence: null,
      message: 'ERA_POSITION_BOUND_UNAVAILABLE: 当前没有位置绑定调用，不能就地提交。',
    };
  }
  return binding.commit(operations);
}

/**
 * 位置绑定提交的公共回执：与普通提交同形，状态恒为 committed。
 *
 * 被拒绝的提交必须抛错而不是返回 skipped：位置通道的拒绝说明调用上下文已经失效
 * （取消或越界），把它伪装成「跳过」会让作者以为写入被正常忽略。
 */
export function positionBoundReceipt(receipt: EraPositionBindingReceipt): EraCommitReceipt {
  if (receipt.status !== 'applied') throw new Error(receipt.message);
  const binding = activeBinding;
  return Object.freeze({
    status: 'committed' as const,
    scope: 'message' as const,
    messageId: binding?.messageId ?? -1,
    state: positionBoundState() ?? projectPublicState(null),
  });
}

/** 位置绑定期间不得触碰的入口：它们要么跨消息、要么要读历史快照。 */
export function assertNoPositionBinding(api: string): void {
  if (activeBinding !== null) throw positionBindingUnsupported(api);
}
