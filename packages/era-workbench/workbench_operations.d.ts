// Generated from Service base_lib/workbench; do not edit.
/** 工作台共享纯计算；生产 Service 节点与 UI 预览由同一源码构建。 */
export type EraCommitOperation = {
    insert: Record<string, unknown>;
} | {
    edit: Record<string, unknown>;
} | {
    delete: Record<string, unknown>;
} | {
    functionInsert: Record<string, unknown>;
} | {
    functionEdit: Record<string, unknown>;
} | {
    functionDelete: Record<string, unknown>;
};
export type JsonContainer = Record<string, unknown>;
export type VariableMutationKind = 'insert' | 'edit' | 'delete';
export type ProtectionChoice = 'temporary' | 'unlock';
/** 记录一个实际阻断操作的元数据字段、所在路径与原值。 */
export interface VariableProtection {
    readonly path: readonly string[];
    readonly field: 'updatable' | 'unInsertAble' | 'necessary';
    readonly value: unknown;
}
/** 包含变量草稿差异的有序操作、人类可读路径与保护检查事实。 */
export interface VariablePlan {
    readonly operations: readonly EraCommitOperation[];
    readonly changedPaths: readonly string[];
    readonly changes: readonly VariableChange[];
}
export interface VariableChange {
    readonly path: readonly string[];
    readonly kind: VariableMutationKind;
}
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void;
/** 按 JSON 结构比较两个草稿；必须忽略对象键顺序，否则纯排序会制造假操作。 */
export declare function jsonEqual(left: unknown, right: unknown): boolean;
/** 只沿自有键读取子树，避免原型属性被误当作可编辑的 ERA 变量。 */
export declare function valueAtPath(root: unknown, path: readonly string[]): unknown;
/** 把子树包装成 ERA CRUD 的嵌套 payload；必须克隆草稿，避免后续输入反向篡改 commit。 */
export declare function payloadAtPath(path: readonly string[], value: unknown): JsonContainer;
export declare function operation(kind: VariableMutationKind, path: readonly string[], value: unknown): EraCommitOperation;
export declare function pathLabel(path: readonly string[]): string;
/** 高级模式保留用户顺序，不推断或增加解锁。 */
export declare function normalizeOrderedOperations(value: unknown): readonly EraCommitOperation[];
/** 编辑意图是内部 JSON DTO；基准由 Service 核对，operations 仅用于显式高级模式。 */
export interface WorkbenchIntent {
    readonly domain: 'variable' | 'function' | 'ordered';
    readonly mode: 'add' | 'edit' | 'delete' | 'batch' | 'save-as';
    readonly identityKey: string;
    readonly sidecarId: string | null;
    readonly revision: number | null;
    readonly initial: unknown;
    readonly path?: readonly string[];
    readonly name?: string;
    readonly value?: unknown;
    readonly expression?: string;
    readonly operations?: readonly EraCommitOperation[];
    readonly protections: readonly (VariableProtection & {
        readonly name?: string;
    })[];
    readonly choice: ProtectionChoice | '';
}
