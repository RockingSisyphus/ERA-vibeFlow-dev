import { applyVariableWrite, arrayOperations, planVariableWrite, variableRuleAt, type VariablePath, type VariableOp } from "../../../base_lib/variable_write/variable_write.ts";
import { commandTagPattern, parseEraCommandPayload } from "../../../base_lib/command_payload/command_payload.ts";
/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
/**
 * Pure ERA command-layer interpreter and conservative compactor.
 *
 * This root deliberately owns no Tavern/Sidecar state.  It accepts one message
 * plus its layer-start data and returns a replacement text only where the
 * standard ERA command language can be proven safe to shorten.
 */
import { compileFunctionLibrary, countAutomaticRandomDraws, parseExpression, type Ast, } from "@era/vibeflow-expression/engine";
export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export type CommandKind = "insert" | "edit" | "delete" | "function-insert" | "function-edit" | "function-delete";
export interface CommandDiagnostic {
    readonly [key: string]: unknown;
    readonly code: string;
    readonly message: string;
    readonly commandIndex?: number;
    readonly path?: string;
}
export interface ParsedCommand {
    readonly [key: string]: unknown;
    readonly index: number;
    readonly kind: CommandKind;
    readonly tag: string;
    readonly data: readonly Record<string, unknown>[];
    readonly start: number;
    readonly end: number;
    readonly raw: string;
}
export interface CommandCompactionRequest {
    readonly [key: string]: unknown;
    readonly content: string;
    readonly initialStatData: Readonly<Record<string, unknown>>;
    readonly initialStatFunc?: Readonly<Record<string, unknown>>;
    /** 整条消息开始时的变量快照；分段压缩时与当前段起点不同。 */
    readonly snapshotStatData?: Readonly<Record<string, unknown>>;
    /** 整条消息开始时的函数快照；供 @f(...) 在任意 scope 段保持同一闭包。 */
    readonly snapshotStatFunc?: Readonly<Record<string, unknown>>;
    readonly eraMeta?: Readonly<Record<string, unknown>>;
    readonly templateContext?: Readonly<Record<string, unknown>>;
    /** Service passes the sealed message MK; no target path or persistent cursor. */
    readonly randomContext?: {
        readonly sourceKey: string;
        readonly drawOffset: number;
    };
}
export interface CommandCompactionResponse {
    readonly [key: string]: unknown;
    readonly status: "compacted" | "partial" | "unchanged" | "invalid";
    readonly content: string;
    readonly finalStatData: Readonly<Record<string, unknown>>;
    readonly finalStatFunc: Readonly<Record<string, unknown>>;
    readonly diagnostics: readonly CommandDiagnostic[];
    readonly reasons: readonly string[];
    readonly parsedCommands: readonly ParsedCommand[];
    readonly nextRandomDrawOffset: number;
}
export interface ParsedLayer {
    readonly [key: string]: unknown;
    readonly request: CommandCompactionRequest;
    readonly commands: readonly ParsedCommand[];
    readonly diagnostics: readonly CommandDiagnostic[];
}
export interface SemanticTrace extends ParsedLayer {
    readonly [key: string]: unknown;
    readonly finalStatData: Readonly<Record<string, unknown>>;
    readonly finalStatFunc: Readonly<Record<string, unknown>>;
    readonly diagnostics: readonly CommandDiagnostic[];
    readonly nextRandomDrawOffset: number;
}
export interface Candidate extends SemanticTrace {
    readonly [key: string]: unknown;
    readonly replacements: ReadonlyMap<number, string>;
    readonly reasons: readonly string[];
}
function tagInfo(value: string): {
    readonly kind: CommandKind;
    readonly tag: string;
} | null {
    if (value === "variableinsert")
        return { kind: "insert", tag: "VariableInsert" };
    if (value === "variableedit")
        return { kind: "edit", tag: "VariableEdit" };
    if (value === "variabledelete")
        return { kind: "delete", tag: "VariableDelete" };
    if (value === "functioninsert")
        return { kind: "function-insert", tag: "FunctionInsert" };
    if (value === "functionedit")
        return { kind: "function-edit", tag: "FunctionEdit" };
    if (value === "functiondelete")
        return { kind: "function-delete", tag: "FunctionDelete" };
    return null;
}
function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function plain(value: unknown): value is Record<string, unknown> {
    if (!record(value))
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
export function clone<T>(value: T): T {
    return structuredClone(value);
}
export function equal(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}
function diagnostic(code: string, message: string, commandIndex?: number, path?: string): CommandDiagnostic {
    return { code, message, ...(commandIndex === undefined ? {} : { commandIndex }), ...(path === undefined ? {} : { path }) };
}
function parseData(text: string, commandIndex: number): {
    readonly data: readonly Record<string, unknown>[];
    readonly diagnostic?: CommandDiagnostic;
} {
    try {
        const { values, skipped } = parseEraCommandPayload(text);
        if (!values.every(plain)) {
            return { data: [], diagnostic: diagnostic("ERA_COMPACT_COMMAND_DATA_INVALID", "指令内容必须是 JSON 对象或对象数组。", commandIndex) };
        }
        return { data: values as readonly Record<string, unknown>[],
            ...(skipped ? { diagnostic: diagnostic("ERA_COMPACT_COMMAND_JSON_INVALID", "部分 JSONL 输入无效，保留原文。", commandIndex) } : {}),
        };
    }
    catch (error) {
        return { data: [], diagnostic: diagnostic("ERA_COMPACT_COMMAND_JSON_INVALID", `指令 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`, commandIndex) };
    }
}
export function parseCommandLayer(input: unknown): ParsedLayer {
    const source = record(input) ? input : {};
    const request: CommandCompactionRequest = {
        content: typeof source.content === "string" ? source.content : "",
        initialStatData: plain(source.initialStatData) ? clone(source.initialStatData) : {},
        initialStatFunc: plain(source.initialStatFunc) ? clone(source.initialStatFunc) : {},
        snapshotStatData: plain(source.snapshotStatData)
            ? clone(source.snapshotStatData)
            : plain(source.initialStatData) ? clone(source.initialStatData) : {},
        snapshotStatFunc: plain(source.snapshotStatFunc)
            ? clone(source.snapshotStatFunc)
            : plain(source.initialStatFunc) ? clone(source.initialStatFunc) : {},
        eraMeta: plain(source.eraMeta) ? clone(source.eraMeta) : {},
        templateContext: plain(source.templateContext) ? clone(source.templateContext) : {},
        randomContext: plain(source.randomContext) &&
            typeof source.randomContext.sourceKey === "string" &&
            source.randomContext.sourceKey.length > 0 &&
            Number.isSafeInteger(source.randomContext.drawOffset) &&
            (source.randomContext.drawOffset as number) >= 0
            ? {
                sourceKey: source.randomContext.sourceKey,
                drawOffset: source.randomContext.drawOffset as number,
            }
            : undefined,
    };
    const commands: ParsedCommand[] = [];
    const diagnostics: CommandDiagnostic[] = [];
    const pattern = commandTagPattern();
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(request.content)) !== null) {
        const info = tagInfo((match[1] ?? "").toLowerCase());
        if (!info)
            continue;
        const index = commands.length;
        const parsed = parseData(match[2] ?? "", index);
        if (parsed.diagnostic)
            diagnostics.push(parsed.diagnostic);
        commands.push({
            index,
            kind: info.kind,
            tag: info.tag,
            data: parsed.data,
            start: match.index,
            end: match.index + match[0].length,
            raw: match[0],
        });
    }
    return { request, commands, diagnostics };
}
function getAt(root: unknown, segments: readonly string[]): unknown {
    let cursor: unknown = root;
    for (const segment of segments) {
        if (!record(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment))
            return undefined;
        cursor = cursor[segment];
    }
    return cursor;
}
function hasAt(root: unknown, segments: readonly string[]): boolean {
    let cursor: unknown = root;
    for (const segment of segments) {
        if (!record(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment))
            return false;
        cursor = cursor[segment];
    }
    return true;
}
function writeVariable(stat: Record<string, unknown>, path: VariablePath, op: VariableOp, value?: unknown): void {
    const write = planVariableWrite(stat, path, op, value);
    if (write) applyVariableWrite(stat, write);
}
function applyArrayOperations(stat: Record<string, unknown>, op: VariableOp, patch: unknown): boolean {
    const operations = arrayOperations(patch, op);
    if (!operations) return false;
    for (const { path, value } of operations) writeVariable(stat, path, op, value);
    return true;
}
function metaValue(value: unknown, key: string): unknown {
    return plain(value) && plain(value.$meta) ? value.$meta[key] : undefined;
}
function merge(left: unknown, right: unknown): unknown {
    if (!plain(left) || !plain(right))
        return clone(right);
    const output = clone(left);
    for (const [key, value] of Object.entries(right)) {
        output[key] = Object.prototype.hasOwnProperty.call(output, key)
            ? merge(output[key], value)
            : clone(value);
    }
    return output;
}
function inheritedTemplateContent(parentTemplate: unknown, key: string): unknown {
    if (!plain(parentTemplate))
        return undefined;
    const general = parentTemplate.$template;
    const specific = parentTemplate[key];
    if (plain(general) && plain(specific))
        return merge(general, specific);
    return plain(specific) ? specific : plain(general) ? general : undefined;
}
function resolvedTemplate(inherited: unknown, parentData: unknown): unknown {
    const own = plain(parentData) ? parentData.$template : undefined;
    const result = merge(plain(inherited) ? inherited : {}, plain(own) ? own : {});
    return plain(result) && Object.keys(result).length > 0 ? result : undefined;
}
function applyTemplate(template: unknown, patch: unknown): unknown {
    if (!plain(patch) || !plain(template))
        return clone(patch);
    return Object.keys(patch).length === 0 ? clone(template) : merge(template, patch);
}
export function applyInsertAt(stat: Record<string, unknown>, segments: readonly string[], patch: unknown, inheritedTemplate: unknown = undefined, parentData: unknown = undefined): void {
    if (segments.length === 0 && applyArrayOperations(stat, "insert", patch)) return;
    const current = getAt(stat, segments);
    const localTemplate = resolvedTemplate(inheritedTemplate, parentData);
    if (segments.length > 0 && current === undefined) {
        writeVariable(stat, segments, "insert", applyTemplate(localTemplate, patch));
        return;
    }
    if (!plain(current) || !plain(patch))
        return;
    for (const key of Object.keys(patch)) {
        applyInsertAt(stat, [...segments, key], patch[key], inheritedTemplateContent(localTemplate, key), current);
    }
}
function* expressionValueProgress(stat: Record<string, unknown>, layerStart: Record<string, unknown>, statFunc: Record<string, unknown>, startFunc: Record<string, unknown>, path: readonly string[], expr: string, randomCursor: {
    sourceKey: string;
    drawOffset: number;
} | null): Generator<any, {
    readonly value?: number;
    readonly diagnostic?: CommandDiagnostic;
}, any> {
    const request = {
        initialState: stat,
        snapshotState: layerStart,
        functionLibrary: statFunc,
        snapshotFunctionLibrary: startFunc,
        allowSnapshots: true,
        operations: [{ path: path.join("."), expr }],
        ...(randomCursor ? { randomContext: randomCursor } : {}),
    };
    const response = yield { kind: "expression", input: request };
    if (randomCursor)
        randomCursor.drawOffset = response.nextDrawOffset;
    const value = getAt(response.finalState, path);
    const issue = response.diagnostics[0];
    if (issue || typeof value !== "number" || !Number.isFinite(value)) {
        return { diagnostic: diagnostic(issue?.code ?? "ERA_COMPACT_EXPR_NON_FINITE", issue?.message ?? "$expr 必须得到有限数值。", undefined, path.join(".")) };
    }
    return { value };
}
export function* applyEditAtProgress(stat: Record<string, unknown>, layerStart: Record<string, unknown>, statFunc: Record<string, unknown>, startFunc: Record<string, unknown>, segments: readonly string[], patch: unknown, diagnostics: CommandDiagnostic[], commandIndex: number, randomCursor: {
    sourceKey: string;
    drawOffset: number;
} | null): Generator<any, void, any> {
    if (segments.length === 0 && applyArrayOperations(stat, "edit", patch)) return;
    const current = getAt(stat, segments);
    if (segments.length > 0 && current === undefined) return;
    if (plain(patch) && Object.keys(patch).length === 1 && typeof patch.$expr === "string") {
        if (segments.length === 0 || !hasAt(stat, segments) ||
            segments.some((_, index) => variableRuleAt(stat, segments.slice(0, index))?.updatable === false) ||
            variableRuleAt(stat, segments)?.updatable === false)
            return;
        const resolved = yield* expressionValueProgress(stat, layerStart, statFunc, startFunc, segments, patch.$expr, randomCursor);
        if (resolved.diagnostic)
            diagnostics.push({ ...resolved.diagnostic, commandIndex });
        else
            writeVariable(stat, segments, "edit", resolved.value);
        return;
    }
    if (!plain(patch)) {
        if (segments.length > 0 && hasAt(stat, segments))
            writeVariable(stat, segments, "edit", patch);
        return;
    }
    for (const [key, value] of Object.entries(patch)) {
        yield* applyEditAtProgress(stat, layerStart, statFunc, startFunc, [...segments, key], value, diagnostics, commandIndex, randomCursor);
    }
}
export function applyDeleteAt(stat: Record<string, unknown>, segments: readonly string[], patch: unknown): void {
    if (segments.length === 0 && applyArrayOperations(stat, "delete", patch)) return;
    if (segments.length > 0 && getAt(stat, segments) === undefined) return;
    if (plain(patch) && Object.keys(patch).length > 0) {
        for (const [key, value] of Object.entries(patch)) applyDeleteAt(stat, [...segments, key], value);
        return;
    }
    if (segments.length > 0) writeVariable(stat, segments, "delete");
}
function functionDiagnostic(code: string, message: string, commandIndex: number, name?: string): CommandDiagnostic {
    return diagnostic(code, message, commandIndex, name);
}
function functionMetaInvalid(value: unknown): string | null {
    const meta = plain(value) && plain(value.$meta) ? value.$meta : null;
    if (!meta)
        return null;
    if (Object.prototype.hasOwnProperty.call(meta, "unInsertAble"))
        return "函数是平面实体，不支持 $meta.unInsertAble。";
    if (meta.necessary === "children")
        return "函数是平面实体，不支持 $meta.necessary: children。";
    return null;
}
function* validateFunctionsProgress(library: Record<string, unknown>): Generator<any, CommandDiagnostic | null, any> {
    const result = yield { kind: "expression", input: { initialState: {}, functionLibrary: library, operations: [] } };
    const issue = result.diagnostics[0];
    return issue ? diagnostic(issue.code, issue.message, undefined, "<library>") : null;
}
function editFunction(current: unknown, patch: unknown): unknown {
    if (!plain(current) || !plain(patch))
        return clone(patch);
    const patchMeta = plain(patch.$meta) ? patch.$meta : null;
    if (Object.keys(patch).length === 1 && patchMeta) {
        const next = clone(current);
        next.$meta = merge(current.$meta, patchMeta);
        return next;
    }
    const next = clone(patch);
    if (!Object.prototype.hasOwnProperty.call(patch, "$meta") && Object.prototype.hasOwnProperty.call(current, "$meta"))
        next.$meta = clone(current.$meta);
    else if (patchMeta)
        next.$meta = merge(current.$meta, patchMeta);
    return next;
}
export function* applyFunctionProgress(library: Record<string, unknown>, type: Extract<CommandKind, `function-${string}`>, data: readonly Record<string, unknown>[], diagnostics: CommandDiagnostic[], commandIndex: number): Generator<any, Record<string, unknown>, any> {
    let current = clone(library);
    for (const root of data) {
        if (Object.keys(root).length === 0) {
            diagnostics.push(functionDiagnostic("ERA_FUNCTION_COMMAND_INVALID", "函数指令必须是非空对象。", commandIndex));
            continue;
        }
        const candidate = clone(current);
        const issues: CommandDiagnostic[] = [];
        for (const [name, patch] of Object.entries(root)) {
            const exists = Object.prototype.hasOwnProperty.call(current, name);
            if (type === "function-insert") {
                if (exists) {
                    issues.push(functionDiagnostic("ERA_FUNCTION_ALREADY_EXISTS", "FunctionInsert 只能新增不存在的函数。", commandIndex, name));
                    continue;
                }
                const invalid = functionMetaInvalid(patch);
                if (invalid) {
                    issues.push(functionDiagnostic("ERA_FUNCTION_META_UNSUPPORTED", invalid, commandIndex, name));
                    continue;
                }
                candidate[name] = clone(patch);
            }
            else if (type === "function-edit") {
                if (!exists) {
                    issues.push(functionDiagnostic("ERA_FUNCTION_NOT_FOUND", "FunctionEdit 只能修改既有函数。", commandIndex, name));
                    continue;
                }
                if (metaValue(current[name], "updatable") === false && !(plain(patch) && plain(patch.$meta) && patch.$meta.updatable === true))
                    continue;
                const next = editFunction(current[name], patch);
                const invalid = functionMetaInvalid(next);
                if (invalid) {
                    issues.push(functionDiagnostic("ERA_FUNCTION_META_UNSUPPORTED", invalid, commandIndex, name));
                    continue;
                }
                candidate[name] = next;
            }
            else {
                if (!plain(patch)) {
                    issues.push(functionDiagnostic("ERA_FUNCTION_DELETE_INVALID", "FunctionDelete 的函数值必须是空对象。", commandIndex, name));
                    continue;
                }
                if (Object.keys(patch).length === 0) {
                    if (exists && !["self", "all"].includes(String(metaValue(current[name], "necessary"))))
                        delete candidate[name];
                }
                else if (Object.keys(patch).length === 1 && plain(patch.$meta) && exists) {
                    const next = clone(current[name]) as Record<string, unknown>;
                    const metaPatch = patch.$meta as Record<string, unknown>;
                    if (plain(next.$meta)) {
                        for (const key of Object.keys(metaPatch))
                            delete (next.$meta as Record<string, unknown>)[key];
                    }
                    candidate[name] = next;
                }
                else
                    issues.push(functionDiagnostic("ERA_FUNCTION_DELETE_INVALID", "FunctionDelete 的函数值必须是空对象。", commandIndex, name));
            }
        }
        if (issues.length > 0) {
            diagnostics.push(...issues);
            continue;
        }
        const invalid = yield* validateFunctionsProgress(candidate);
        if (invalid) {
            diagnostics.push({ ...invalid, commandIndex });
            continue;
        }
        current = candidate;
    }
    return current;
}
