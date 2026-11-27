import {
  buildTransaction,
  inspectWindow,
  validateCommit,
} from "../facade_api_engine.ts";
import {
  markEraFunctionCallDone,
  parseMessageBlocks,
} from "../domain/commands/message_function_calls.ts";
import type { EraBlockStepStateV1 } from "./sync_contracts.ts";

export function callAnchor(state: EraBlockStepStateV1): string {
  return `<!--era_fcall_anchor:${encodeURIComponent(state.functionFrame!.id)}-->`;
}

export function currentFunctionBlock(state: EraBlockStepStateV1): any {
  const plan: any = state.work.plan;
  const message = plan.messages[plan.execution.messageIndex];
  const block = parseMessageBlocks({ content: message.content.text })[
    state.functionFrame!.callIndex
  ];
  if (block?.kind !== "call") throw new Error("ERA_FUNCTION_ANCHOR_INVALID");
  return {
    block,
    message,
    text: message.content.text,
    index: plan.execution.messageIndex,
  };
}

export function replaceFunctionText(
  state: EraBlockStepStateV1,
  text: string,
): EraBlockStepStateV1 {
  const plan: any = state.work.plan;
  const { message, index } = currentFunctionBlock(state);
  const content = { kind: "text", text };
  return {
    ...state,
    work: {
      ...state.work,
      plan: {
        ...plan,
        messages: plan.messages.map((candidate: any, at: number) =>
          at === index ? { ...candidate, content } : candidate,
        ),
        messageUpdates: [
          ...plan.messageUpdates.filter(
            (update: any) => update.messageId !== message.messageId,
          ),
          {
            kind: "update-message-content",
            messageId: message.messageId,
            messageIndex: index,
            mk: plan.meta.SelectedMks[index],
            content,
          },
        ],
      },
    },
  };
}

export function finishFunction(
  state: EraBlockStepStateV1,
  error: any,
): EraBlockStepStateV1 {
  const { block, text, index } = currentFunctionBlock(state);
  const marked = markEraFunctionCallDone(text, block.call).replace(
    callAnchor(state),
    "",
  );
  const changed = replaceFunctionText(state, marked);
  const plan: any = changed.work.plan;
  return {
    ...changed,
    functionFrame: null,
    work: {
      ...changed.work,
      plan: {
        ...plan,
        execution: {
          ...plan.execution,
          blockIndex:
            state.functionFrame!.callIndex +
            1 +
            state.functionFrame!.appliedBlocks,
        },
        diagnostics: error
          ? [
              ...plan.diagnostics,
              { code: error.code, message: error.message, messageIndex: index },
            ]
          : plan.diagnostics,
      },
    },
  };
}

export function functionApiSettlement(
  state: EraBlockStepStateV1,
  request: any,
  value: any,
  error?: any,
): any {
  const id = `${state.functionFrame!.id}:api:${request.id}`;
  return error
    ? { eventId: id, sequence: request.id, status: "failed", error }
    : {
        eventId: id,
        sequence: request.id,
        status: "completed",
        taskId: state.functionFrame!.id,
        relation: "primary",
        value,
      };
}

/** Use the ordinary facade validation/scope/era_tx construction, then insert into this message. */
export function prepareFunctionApi(
  state: EraBlockStepStateV1,
  request: any,
  identity: any,
): any {
  const { text, message } = currentFunctionBlock(state);
  const plan: any = state.work.plan;
  const step: any = state.work.step;
  const frame = state.functionFrame!;
  // 草稿楼层尚未进入宿主来源依据；沿用当前阶段已构造的候选事实。
  // 已有真实消息仍以宿主依据为准，不把计划正文当作宿主已写入。
  const sourceMessages = new Map(
    [...step.dispatchContext.messages, ...state.sourceBasis!.messages].map(
      (item: any) => [item.messageId, item],
    ),
  );
  const messages = plan.messages.map((item: any) => ({
    ...sourceMessages.get(item.messageId),
    schemaVersion: 2,
    messageId: item.messageId,
    role: item.role,
    activeText: item.content.text,
    swipeIndex: sourceMessages.get(item.messageId)?.swipeIndex ?? 0,
  }));
  const event = {
    ...step.task.primaryEvent,
    eventId: `${frame.id}:api:${request.id}`,
    sequence: request.id,
    source: "era-api",
    type: request.type,
    args: [{ kind: "json", value: request.payload }],
  };
  const apiRequest = {
    task: {
      ...step.task,
      kind: "api",
      id: event.eventId,
      eventType: request.type,
      primaryEvent: event,
      sourceEvents: [event],
      args: event.args,
    },
    sources: [{ event, relation: "primary" }],
    detail: request.payload,
    dispatchContext: {
      ...step.dispatchContext,
      dispatchClass: "api",
      processingMessage: messages.find(
        (item: any) => item.messageId === message.messageId,
      ),
      sourceBasis: state.sourceBasis,
    },
  };
  const executionState: any = {
    schemaVersion: 1,
    nextState: {
      consecutiveMk: plan.nextConsecutiveState.mk,
      consecutiveProcessingCount: plan.nextConsecutiveState.count,
      scopeWindow: state.scopeWindow ?? {
        token: null,
        messageId: null,
        messageAdmission: null,
        branchAdmission: null,
      },
    },
  };
  const inspected = inspectWindow(
    apiRequest,
    executionState,
    identity,
    { schemaVersion: 2, messages },
    { messageId: message.messageId },
  );
  const validated: any = validateCommit(inspected);
  if (validated.route === "failed")
    return {
      state,
      settlement: functionApiSettlement(state, request, null, validated.error),
    };
  const scoped = { ...state, scopeWindow: validated.context.window };
  const value = {
    status: validated.route === "skipped" ? "skipped" : "committed",
    scope: validated.context.scope,
    messageId: message.messageId,
  };
  if (validated.route === "skipped")
    return {
      state: scoped,
      settlement: functionApiSettlement(state, request, value),
    };
  const transaction = buildTransaction(validated.context).transaction;
  const count = parseMessageBlocks({ content: transaction }).length;
  const anchor = callAnchor(state);
  if (!text.includes(anchor)) throw new Error("ERA_FUNCTION_ANCHOR_INVALID");
  const changed = replaceFunctionText(
    scoped,
    text.replace(anchor, `\n${transaction}${anchor}`),
  );
  const changedPlan: any = changed.work.plan;
  return {
    state: {
      ...changed,
      functionFrame: {
        ...frame,
        phase: "applying",
        remaining: count,
        appliedBlocks: frame.appliedBlocks + count,
        request: { ...request, receiptValue: value },
      },
      work: {
        ...changed.work,
        plan: {
          ...changedPlan,
          execution: {
            ...changedPlan.execution,
            blockIndex: frame.callIndex + 1 + frame.appliedBlocks,
          },
        },
      },
    },
    settlement: null,
  };
}
