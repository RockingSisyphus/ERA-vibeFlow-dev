// Generated from Service base_lib/workbench; do not edit.
/** 工作台共享纯计算；生产 Service 节点与 UI 预览由同一源码构建。 */
import { type EraCommitOperation, type VariablePlan } from './workbench_operations.js';
export declare function planVariableDiff(original: unknown, draft: unknown, path?: readonly string[]): VariablePlan;
export declare function planVariableInsert(path: readonly string[], value: unknown): VariablePlan;
export declare function planVariableDelete(path: readonly string[]): VariablePlan;
export declare function planVariableExpression(path: readonly string[], expr: string): VariablePlan;
/** 包含整个函数库草稿的有序差异及被改动的函数名。 */
export interface FunctionPlan {
    readonly operations: readonly EraCommitOperation[];
    readonly changedNames: readonly string[];
    readonly changes: readonly FunctionChange[];
}
export interface FunctionChange {
    readonly name: string;
    readonly kind: 'insert' | 'edit' | 'delete';
}
/** 函数库必须按 Insert、Edit、Delete 分批，因为引用关系要在删除前看到新定义。 */
export declare function planFunctionLibraryDiff(original: Readonly<Record<string, unknown>>, draft: Readonly<Record<string, unknown>>): FunctionPlan;
