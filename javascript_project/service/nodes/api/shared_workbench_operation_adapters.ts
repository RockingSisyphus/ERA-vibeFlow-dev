// Adapters with identical declared base libraries share this source.
import { normalizeOrderedOperations, isRecord, jsonEqual, valueAtPath, type WorkbenchIntent } from "../../base_lib/workbench/workbench_operations.js";
import { workbenchError, type Draft, type OperationPlan, type Baseline } from "../../base_lib/workbench/workbench_context.ts";

// Original node: nodes/api/workbench_normalize_ordered.ts
/** 显式操作不重排、不解锁；后续继续走原 Commit 事务校验。 */
export function WorkbenchNormalizeOrderedNode(inputs: any): any {
  const draft = inputs['era.workbench.draft'].value as Draft;
  const operation_plan: OperationPlan = { draft, operations: [], changes: [], error: null };
  try { operation_plan.operations = normalizeOrderedOperations(draft.request.operations); }
  catch (reason) { operation_plan.error = workbenchError(reason); }
  return { ordered_operation_plan: operation_plan };
}

// Original node: nodes/api/workbench_validate_draft.ts
/** 新增核对不存在；单项核对目标；整库编辑核对整库，保留无关兄弟项更新。 */
function WorkbenchValidateDraft_validate(baseline: Baseline, raw: unknown): asserts raw is WorkbenchIntent {
  if (!isRecord(raw) || !['variable', 'function', 'ordered'].includes(String(raw.domain)) ||
    !['add', 'edit', 'delete', 'batch', 'save-as'].includes(String(raw.mode)) || !Array.isArray(raw.protections) ||
    !['', 'temporary', 'unlock'].includes(String(raw.choice))) throw new Error('工作台编辑意图无效。');
  const record = baseline.record;
  if (!record || !baseline.current || raw.sidecarId !== record.sidecarId ||
    typeof raw.identityKey !== 'string' || !jsonEqual(JSON.parse(raw.identityKey), baseline.current.identity)) throw new Error('草稿所属聊天或 Sidecar 已经变化。');
  if (!Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0 || Number(raw.revision) > record.revision) throw new Error('草稿版本无效。');
  if (raw.domain === 'ordered' && raw.mode !== 'batch') throw new Error('有序操作只允许批量模式。');
  if (raw.domain !== 'ordered' && raw.mode !== 'delete' && raw.expression === undefined && !Object.prototype.hasOwnProperty.call(raw, 'value')) throw new Error('草稿缺少目标值。');
  const functions = raw.domain === 'function';
  if (!functions && raw.mode === 'save-as') throw new Error('变量不支持函数另存为模式。');
  const path = raw.path;
  if (!functions && (!Array.isArray(path) || !path.every(key => typeof key === 'string'))) throw new Error('变量路径无效。');
  if (!functions && raw.mode === 'batch' && (path as string[]).length !== 0) throw new Error('批量变量草稿必须基于完整根。');
  if (raw.mode !== 'batch' && (functions ? typeof raw.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(raw.name) : !(path as string[]).length)) throw new Error('编辑目标无效。');
  const root = functions ? record.state.statFunc : record.state.statData;
  const current = raw.mode === 'batch' ? root : valueAtPath(root, functions ? [String(raw.name)] : path as string[]);
  if (raw.mode === 'add' || raw.mode === 'save-as') {
    if (current !== undefined) throw new Error('目标已经存在，请重新打开编辑器。');
    if (!functions && !isRecord(valueAtPath(root, (path as string[]).slice(0, -1)))) throw new Error('新增变量的父对象已经变化。');
  } else if (!jsonEqual(current, raw.initial)) throw new Error('编辑目标在草稿打开后已经变化，请重新载入。');
}
export function WorkbenchValidateDraftNode(inputs: any): any {
  const baseline = inputs['era.workbench.baseline'].value as Baseline;
  const raw = baseline.inspected.request.detail.intent;
  const draft: Draft = { inspected: baseline.inspected, baseline, request: (isRecord(raw) ? raw : {}) as unknown as WorkbenchIntent, error: baseline.error };
  if (!draft.error) {
    try { WorkbenchValidateDraft_validate(baseline, raw); draft.request = raw; } catch (reason) { draft.error = workbenchError(reason); }
  }
  return { draft, draft_kind: draft.error ? 'failed' : draft.request.domain };
}
