import type { EraAdmissionResult, EraSettlement } from '../../service/types';

export const UI_SETTLEMENT_TIMEOUT_MS = 30_000;

export class UiServiceSettlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UiServiceSettlementError';
  }
}

/**
 * UI 只等待一次 Host receipt，不重试也不取消已接纳的工作。为了避免停滞的宿主
 * 请求永久锁住按钮，必须在固定时限后恢复 UI；超时后的迟到结算仍由 Service 正常
 * 处理，但不能再驱动当前用户操作的视觉状态。
 */
export async function awaitUiSettlement(
  admission: EraAdmissionResult,
  label: string,
  timeoutMs = UI_SETTLEMENT_TIMEOUT_MS,
): Promise<EraSettlement> {
  if (!admission.accepted) {
    throw new UiServiceSettlementError(`${admission.code}: ${admission.message}`);
  }

  let timer: ReturnType<typeof globalThis.setTimeout> | null = null;
  try {
    const settlement = await Promise.race([
      admission.done,
      new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => {
          reject(new UiServiceSettlementError(`${label}等待 ERA 服务结算超时。`));
        }, timeoutMs);
      }),
    ]);
    if (settlement.status !== 'completed') {
      throw new UiServiceSettlementError(`${label}未完成：${settlement.status}`);
    }
    return settlement;
  } finally {
    if (timer !== null) globalThis.clearTimeout(timer);
  }
}
