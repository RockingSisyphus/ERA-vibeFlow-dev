// Generated from Service base_lib/workbench; do not edit.
export type VariablePath = readonly (string | number)[];
export type VariableOp = "insert" | "edit" | "delete";
type RecordValue = Record<string, unknown>;
export declare function variablePathKey(path: VariablePath): string;
export declare function readVariablePath(tree: unknown, path: VariablePath): unknown;
export declare function arrayOperations(payload: unknown, op: VariableOp): {
    path: VariablePath;
    value?: unknown;
}[] | undefined;
export declare function variableRuleSource(tree: unknown, path: VariablePath): {
    rule: RecordValue | undefined;
    path: VariablePath;
};
export declare function variableRuleAt(tree: unknown, path: VariablePath): RecordValue | undefined;
export type VariableWrite = {
    path: VariablePath;
    value: unknown;
    op: VariableOp;
    arrayPath: VariablePath | undefined;
};
export declare function planVariableWrite(tree: unknown, path: VariablePath, op: VariableOp, value?: unknown): VariableWrite | undefined;
export declare function applyVariableWrite(tree: unknown, write: VariableWrite): void;
export {};
