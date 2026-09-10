import type { WorkbenchIntent } from '@era/vibeflow-workbench';
import { captureEraLifecycleToken, requestEraService, requireAccepted } from './client';

/** 内部工作台必须通过已有 FIFO 提交意图，避免在 UI 预先决定业务写入；失败沿用同一次 settlement。 */
export async function commitWorkbenchIntent(intent: WorkbenchIntent): Promise<{ status: string; messageId: number }> {
  const admission = requireAccepted(
    requestEraService(
      'era.facade.commit',
      [
        {
          command: 'workbench-commit',
          intent: JSON.parse(JSON.stringify(intent)),
          windowToken: captureEraLifecycleToken(),
        },
      ],
      'ui',
    ),
  );
  const settlement = await admission.done;
  if (settlement.status !== 'completed') {
    const detail = settlement.status === 'failed' ? settlement.error : settlement.status;
    throw new Error(
      typeof detail === 'object' && detail !== null && 'message' in detail ? String(detail.message) : String(detail),
    );
  }
  const result = settlement.value as { status?: string; messageId?: number } | undefined;
  return { status: result?.status ?? 'failed', messageId: result?.messageId ?? -1 };
}
