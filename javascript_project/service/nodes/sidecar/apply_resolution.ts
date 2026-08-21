import {
  durableRestoreInstruction,
  enrich,
  inspectSidecar,
  recordFor,
  type SidecarResolutionV1,
  type SyncContextV1,
} from "../../base_lib/sidecar_binding.ts";

interface Ctx {
  readonly capabilities: {
    readonly "era.tavern.sidecar": {
      read_current(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      read_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      write_record(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      commit_metadata(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      create_id(input: Readonly<Record<string, unknown>>): { sidecarId: string };
      clear_prompt(input: Readonly<Record<string, unknown>>): unknown;
    };
    readonly "era.tavern.messages": {
      update_content(input: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `era.tavern.variables.read` 的正式返回值是 `{ scope, variables }`。Sidecar
 * 事务必须和同步引擎使用同一层实际聊天变量；同时保留对直接变量对象的兼容，便于
 * 纯节点单测而不把宿主包装泄漏为另一套业务模型。
 */
function variablesFromSync(sync: SyncContextV1): Record<string, unknown> {
  if (!isRecord(sync.variablesRaw)) throw new TypeError("当前同步上下文缺少聊天变量。");
  return isRecord(sync.variablesRaw.variables)
    ? sync.variablesRaw.variables
    : sync.variablesRaw;
}

function withVariables(sync: SyncContextV1, variables: Record<string, unknown>): SyncContextV1 {
  if (isRecord(sync.variablesRaw) && isRecord(sync.variablesRaw.variables)) {
    return { ...sync, variablesRaw: { ...sync.variablesRaw, variables } };
  }
  return { ...sync, variablesRaw: variables };
}

function withAppendedRestore(sync: SyncContextV1, messageId: number, restore: string): SyncContextV1 {
  const raw = sync.messagesRaw as {
    readonly schemaVersion?: unknown;
    readonly messages?: readonly {
      readonly messageId: number;
      readonly role: string;
      readonly activeText?: string;
      readonly content?: string;
    }[];
  };
  if (!Array.isArray(raw?.messages)) throw new TypeError("当前同步上下文缺少可重放消息。");
  let updated = false;
  const messages = raw.messages.map((message) => {
    if (message.messageId !== messageId) return message;
    const text = typeof message.activeText === "string"
      ? message.activeText
      : message.content;
    if (typeof text !== "string") {
      throw new TypeError("当前同步上下文中的目标 AI 消息缺少可重放文本。");
    }
    updated = true;
    // 同步引擎消费 Tavern 严格消息投影的 activeText。真实宿主更新已落盘，
    // 这里必须同步更新同一份工作流快照，否则当前任务会按写入前文本重算，
    // 导致复制/迁移的恢复指令要等下一次人工同步才生效。
    return typeof message.activeText === "string"
      ? { ...message, activeText: `${text}${restore}` }
      : { ...message, content: `${text}${restore}` };
  });
  if (!updated) throw new TypeError("当前同步上下文没有目标 AI 消息。");
  return { ...sync, messagesRaw: { ...raw, messages } };
}

function withSidecarId(sync: SyncContextV1, sidecarId: string): SyncContextV1 {
  const variables = variablesFromSync(sync);
  const meta = variables.ERAMetaData as Record<string, unknown>;
  return withVariables(sync, { ...variables, ERAMetaData: { ...meta, SidecarId: sidecarId } });
}

export async function run(inputs: Readonly<{
  "era.sidecar.binding.input": { readonly value: unknown };
  "era.sidecar.binding.resolution": { readonly value: unknown };
}>, _params: Readonly<Record<string, unknown>>, context: Ctx): Promise<any> {
  const sync = (inputs["era.sidecar.binding.input"].value as { readonly sync: SyncContextV1 }).sync;
  const resolution = inputs["era.sidecar.binding.resolution"].value as SidecarResolutionV1;
  const { facts, choice } = resolution;
  if (resolution.route === "continue") {
    return { sidecar_applied_context: enrich(sync, facts, "continue", choice), sidecar_binding_route: "continue" };
  }
  if (resolution.route === "blocked") {
    return { sidecar_applied_context: enrich(sync, facts, "blocked", choice), sidecar_binding_route: "blocked" };
  }
  if (facts.status === "create" && facts.current !== null) {
    const targetId = context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    await context.capabilities["era.tavern.sidecar"].commit_metadata({ sidecarId: targetId });
    const stat = variablesFromSync(resolved).stat_data ?? {};
    await context.capabilities["era.tavern.sidecar"].write_record({
      sidecarId: targetId,
      record: recordFor(targetId, facts.current, stat, null),
    });
    // `apply` 只属于本 Nodeset 内部的决议阶段；事务已经完成后，输出给
    // task_sync 的同步上下文必须是可继续的正式路由。把它泄露为 `apply`
    // 会在工作流数据合同校验处被拒绝，导致已经完成的宿主写入无法结算。
    return { sidecar_applied_context: enrich(resolved, facts, "continue", choice), sidecar_binding_route: "continue" };
  }
  if ((facts.status === "invalid" || facts.status === "matched") && facts.current !== null && choice === "repair") {
    // 修复不是静默降级：只有用户点击明确的修复动作后，才会保留可用 ID 或分配新 ID，
    // 并以当前聊天已提交/可重放的 stat_data 重建本地镜像。
    const rereadCurrent = await context.capabilities["era.tavern.sidecar"].read_current({});
    const rereadMeta = (rereadCurrent as Record<string, unknown>).meta as Record<string, unknown> | null;
    const rereadId = rereadMeta?.SidecarId;
    const rereadRecord = typeof rereadId === "string" && /^era_chat_[a-z0-9-]{8,80}$/iu.test(rereadId)
      ? await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: rereadId })
      : null;
    const rereadFacts = inspectSidecar(rereadCurrent, rereadRecord);
    if ((rereadFacts.status !== "invalid" && rereadFacts.status !== "matched") || rereadFacts.current === null) {
      throw new TypeError("Sidecar 修复状态已变化；请在当前聊天重新操作。");
    }
    const targetId = rereadFacts.sidecarId ?? context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    await context.capabilities["era.tavern.sidecar"].commit_metadata({ sidecarId: targetId });
    // repair 处理的是“文件镜像落后于已提交聊天变量”的情形。同步上下文可能
    // 来自该次 UI 选择之前的规划快照，不能拿它覆盖刚刚由 API 写入的当前状态。
    const stat = (rereadCurrent as Record<string, unknown>).stat;
    if (stat === undefined) throw new TypeError("当前聊天缺少可镜像的 stat_data；请修复当前聊天。");
    await context.capabilities["era.tavern.sidecar"].write_record({
      sidecarId: targetId,
      record: recordFor(targetId, rereadFacts.current, stat, rereadFacts.record),
    });
    context.capabilities["era.tavern.sidecar"].clear_prompt({});
    // repair 已经只通过当前聊天的已提交 stat_data 重建了本地镜像。继续进入
    // 普通同步会把 API 写入误当成聊天文本可重放状态，反而覆盖当前变量。
    return { sidecar_applied_context: enrich(resolved, rereadFacts, "applied", choice), sidecar_binding_route: "applied" };
  }
  if (facts.status !== "conflict" || facts.current === null || facts.record === null || choice === null) {
    throw new TypeError("Sidecar 绑定决议无效；请重新检查当前聊天。");
  }

  // 用户可能在弹窗出现后切卡/切聊天：任何身份、ID 或 revision 变化都 fail-closed。
  const rereadCurrent = await context.capabilities["era.tavern.sidecar"].read_current({});
  const rereadRecord = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: facts.record.sidecarId });
  const rereadFacts = inspectSidecar(rereadCurrent, rereadRecord);
  if (rereadFacts.status !== "conflict" || rereadFacts.current === null || rereadFacts.record === null ||
    rereadFacts.record.revision !== facts.record.revision || rereadFacts.sidecarId !== facts.sidecarId) {
    throw new TypeError("Sidecar 绑定弹窗已过期；请在当前聊天重新选择。");
  }

  const targetId = choice === "migrate"
    ? facts.record.sidecarId
    : context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
  let resolved = sync;
  if (choice === "migrate" || choice === "copy") {
    const messages = (sync.messagesRaw as { readonly messages?: readonly { readonly messageId: number; readonly role: string; readonly content: string }[] })?.messages ?? [];
    const lastAi = [...messages].reverse().find((item) => item.role === "assistant");
    if (lastAi === undefined) throw new TypeError("当前聊天没有可追加恢复指令的 AI 消息。");
    const restore = durableRestoreInstruction(variablesFromSync(sync).stat_data, facts.record.statData);
    if (restore === null) throw new TypeError("当前聊天含有无法安全替换的受保护变量；请先修复当前聊天。");
    await context.capabilities["era.tavern.messages"].update_content({
      messageId: lastAi.messageId,
      content: `${lastAi.content}${restore}`,
      purpose: "era-sidecar-restore",
    });
    resolved = withAppendedRestore(sync, lastAi.messageId, restore);
  }

  resolved = withSidecarId(resolved, targetId);
  await context.capabilities["era.tavern.sidecar"].commit_metadata({ sidecarId: targetId });
  const stat = choice === "independent"
    ? (variablesFromSync(resolved).stat_data ?? {})
    : facts.record.statData;
  await context.capabilities["era.tavern.sidecar"].write_record({
    sidecarId: targetId,
    record: recordFor(targetId, facts.current, stat, choice === "migrate" ? facts.record : null),
  });
  context.capabilities["era.tavern.sidecar"].clear_prompt({});
  // 同上：选择已经被事务消费，后续完整同步只接收规范的 continue 路由。
  return { sidecar_applied_context: enrich(resolved, facts, "continue", choice), sidecar_binding_route: "continue" };
}
