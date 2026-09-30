import { inspectRelativePatch } from "./operation_traversal.ts";
import {
  prepareValueExpression,
  evaluateExpression,
  routeExpressionResult,
} from "./operation_expressions.ts";
/** 正式操作图与只读历史重放共用的一套有序语义；此模块只保留旧调用接口的适配。 */
import {
  type EraApplyMessageCommandsInput,
  type EraApplyMessageCommandsResult,
  type EraEditContext,
  type EraCrudCommand,
  type EraCrudResult,
  type EraCrudDiagnostic,
} from "./crud_parser.ts";
import { seedCommandOperations, operationResult } from "./operation_state.ts";
import { foldOperations } from "./operation_fold.ts";
export * from "./crud_parser.ts";
export * from "./crud_mutations.ts";

export function applyMessageCommands(
  input: EraApplyMessageCommandsInput,
): EraApplyMessageCommandsResult {
  try {
    return operationResult(foldOperations(seedCommandOperations(input)));
  } catch {
    const state = seedCommandOperations({ ...input, content: "" });
    return operationResult(state);
  }
}
function applyRoots(
  type: EraCrudCommand["type"],
  roots: readonly unknown[],
  stat: unknown,
  context?: EraEditContext,
): EraApplyMessageCommandsResult {
  const state = seedCommandOperations({
    content: "",
    initialStat: stat,
    initialStatFunc: context?.statFunc,
    messageId: context?.messageId ?? 0,
    meta: context?.meta ?? {},
    messageStartStat: context?.layerStartStat,
    messageStartStatFunc: context?.layerStartStatFunc,
    randomSourceKey: context?.randomCursor?.sourceKey,
    randomDrawOffset: context?.randomCursor?.drawOffset,
  });
  state.commands = [{ type, data: roots }];
  const completed = foldOperations(state);
  if (context?.randomCursor && completed.randomCursor)
    context.randomCursor.drawOffset = completed.randomCursor.drawOffset;
  return operationResult(completed);
}
export function applyInsert(
  roots: readonly unknown[],
  stat: unknown,
): EraCrudResult {
  const { finalStat, editLog } = applyRoots("insert", roots, stat);
  return { finalStat, editLog };
}
export function applyDelete(
  roots: readonly unknown[],
  stat: unknown,
): EraCrudResult {
  const { finalStat, editLog } = applyRoots("delete", roots, stat);
  return { finalStat, editLog };
}
export function applyEditWithDiagnostics(
  roots: readonly unknown[],
  stat: unknown,
  context: EraEditContext,
): EraCrudResult & { readonly diagnostics: readonly EraCrudDiagnostic[] } {
  const { finalStat, editLog, diagnostics } = applyRoots(
    "edit",
    roots,
    stat,
    context,
  );
  return { finalStat, editLog, diagnostics };
}
export function applyEdit(
  roots: readonly unknown[],
  stat: unknown,
  context: EraEditContext,
): EraCrudResult {
  const { finalStat, editLog } = applyEditWithDiagnostics(roots, stat, context);
  return { finalStat, editLog };
}

/** 兼容旧领域接口，复用图中相同的公式形状检查和求值步骤。 */
export function resolveRelativeEdit(
  patch: unknown,
  current: unknown,
  path: string,
  stat: unknown = {},
  context: EraEditContext = { messageId: 0, meta: {} },
):
  | { kind: "not-operator" }
  | { kind: "invalid"; diagnostic: EraCrudDiagnostic }
  | { kind: "resolved"; value: unknown } {
  const classified = inspectRelativePatch(patch, current, path, stat);
  if (classified.kind === "invalid") return classified;
  if (classified.kind === "not-operator") return { kind: "not-operator" };
  const state = seedCommandOperations({
    content: "",
    initialStat: stat,
    initialStatFunc: context.statFunc,
    messageId: context.messageId,
    meta: context.meta,
    messageStartStat: context.layerStartStat,
    messageStartStatFunc: context.layerStartStatFunc,
    randomSourceKey: context.randomCursor?.sourceKey,
    randomDrawOffset: context.randomCursor?.drawOffset,
  });
  state.pendingAction = { kind: "edit", path, patch, current };
  const routed = routeExpressionResult(
    evaluateExpression(prepareValueExpression(state)),
  );
  if (context.randomCursor && routed.state.randomCursor)
    context.randomCursor.drawOffset = routed.state.randomCursor.drawOffset;
  return routed.route === "value-failed"
    ? { kind: "invalid", diagnostic: routed.state.pendingAction!.diagnostic! }
    : {
        kind: "resolved",
        value: Object.is(routed.state.pendingAction!.value, -0)
          ? 0
          : routed.state.pendingAction!.value,
      };
}
