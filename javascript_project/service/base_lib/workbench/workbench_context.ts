/** 节点间的工作台准备数据；失败沿用现有 Commit failure_context。 */
import type { WorkbenchIntent, EraCommitOperation, VariableMutationKind } from './workbench_operations.js';
import type { SidecarRecordV1 } from '../sidecar_binding.ts';
export interface Inspected extends Record<string, unknown> {
  request: { detail: Record<string, unknown>; [key: string]: unknown };
  identity: Record<string, unknown>;
}
export interface WorkbenchError { code: string; message: string; category: 'input'; retryable: false }
export interface Baseline {
  inspected: Inspected;
  current: Record<string, unknown> | null;
  record: SidecarRecordV1 | null;
  error: WorkbenchError | null;
}
export interface Draft {
  inspected: Inspected;
  baseline: Baseline;
  request: WorkbenchIntent;
  error: WorkbenchError | null;
}
export interface OperationPlan {
  draft: Draft;
  operations: readonly EraCommitOperation[];
  changes: readonly { domain: 'variable' | 'function'; kind: VariableMutationKind; path?: readonly string[]; name?: string }[];
  error: WorkbenchError | null;
}
export type Inputs<T, K extends string> = Readonly<Record<K, { readonly value: T }>>;
export function workbenchError(reason: unknown): WorkbenchError {
  return { code: 'ERA_WORKBENCH_INVALID', message: reason instanceof Error ? reason.message : String(reason), category: 'input', retryable: false };
}
export function rejected(inspected: Inspected, error: WorkbenchError) {
  return { route: 'failed' as const, inspected, failure: { route: 'failed', context: inspected, error } };
}
