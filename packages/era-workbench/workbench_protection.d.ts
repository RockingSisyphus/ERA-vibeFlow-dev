// Generated from Service base_lib/workbench; do not edit.
/** 工作台共享纯计算；生产 Service 节点与 UI 预览由同一源码构建。 */
import { type EraCommitOperation, type VariableMutationKind, type VariableProtection, type VariablePlan, type ProtectionChoice } from './workbench_operations.js';
import type { FunctionPlan } from './workbench_draft.js';
/**
 * 收集目标及其所有祖先的变量保护。祖先限制会传递给子路径，
 * 所以只检查直接目标会让 UI 生成必然失败的 commit。
 */
export declare function variableProtections(root: unknown, path: readonly string[], kind: VariableMutationKind): VariableProtection[];
export declare function variablePlanProtections(root: unknown, plan: VariablePlan): VariableProtection[];
/** 解锁与可选恢复必须包在同一次 commit，否则中间失败会留下意外解锁状态。 */
export declare function wrapVariableProtection(operations: readonly EraCommitOperation[], protections: readonly VariableProtection[], choice: ProtectionChoice): readonly EraCommitOperation[];
export interface NamedFunctionProtection extends VariableProtection {
    readonly name: string;
}
/** 只读取与当前操作相关的函数保护，避免解锁不影响本次提交的元数据。 */
export declare function functionProtection(definition: unknown, kind: 'edit' | 'delete'): VariableProtection[];
/** 函数解锁必须环绕原操作且不改顺序，否则表达式重放将看到不同定义。 */
export declare function wrapFunctionProtection(name: string, operations: readonly EraCommitOperation[], protections: readonly VariableProtection[], choice: ProtectionChoice): readonly EraCommitOperation[];
/** 批量草稿必须保留保护对应的函数名，否则无法向正确定义发出解锁。 */
export declare function functionPlanProtections(original: Readonly<Record<string, unknown>>, plan: FunctionPlan): NamedFunctionProtection[];
/** 批量解锁先集中前置、恢复再逆序后置，避免父子保护的恢复顺序相反。 */
export declare function wrapFunctionPlanProtections(operations: readonly EraCommitOperation[], protections: readonly NamedFunctionProtection[], choice: ProtectionChoice): readonly EraCommitOperation[];
