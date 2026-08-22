import {
  durableRestoreInstruction,
  enrich,
  factsWithRecord,
  inspectSidecar,
  recordFor,
  stateFromRecord,
  type SidecarFactsV1,
  type SidecarRecordV1,
  type SidecarStateV2,
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
  if (isRecord(sync.variablesRaw.variables)) return sync.variablesRaw.variables;
  // Sidecar store 的入口故意只读宿主的 `{ identity, meta, stat }` 事实，
  // 而不是直接把整份 chat variables 交给同步路径。事务内部仍需要构造一次
  // 临时变量投影，以便给既有纯同步/恢复逻辑传递 SidecarId；这个投影不写回
  // Tavern，也不构成状态回退来源。
  if (Object.prototype.hasOwnProperty.call(sync.variablesRaw, "identity") &&
    (sync.variablesRaw.meta === null || isRecord(sync.variablesRaw.meta))) {
    const variables: Record<string, unknown> = {};
    if (isRecord(sync.variablesRaw.meta)) variables.ERAMetaData = sync.variablesRaw.meta;
    if (sync.variablesRaw.stat !== null && Object.prototype.hasOwnProperty.call(sync.variablesRaw, "stat")) {
      variables.stat_data = sync.variablesRaw.stat;
    }
    return variables;
  }
  return sync.variablesRaw;
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

function stateFromSync(sync: SyncContextV1, facts: SidecarFactsV1): SidecarStateV2 {
  if (facts.legacyState !== null) return facts.legacyState;
  // V1 用户文件没有聊天内 legacy stat_data 时，文件本身就是升级的唯一旧
  // 状态来源。不得把它误降级为空对象，否则一次格式升级会丢失变量。
  if (facts.legacyRecord !== null) {
    return { statData: facts.legacyRecord.statData, eraMeta: {} };
  }
  const value = variablesFromSync(sync);
  const eraMeta = isRecord(value.ERAMetaData) ? { ...value.ERAMetaData } : {};
  delete eraMeta.SidecarId;
  return { statData: value.stat_data ?? {}, eraMeta };
}

async function publish(context: Ctx, record: SidecarRecordV1): Promise<void> {
  // Host 只在文件已确认后，以同一机械 pointer 提交顺序发布易失快照；不在此处
  // 决定 owner、冲突或状态内容。
  const committed = await context.capabilities["era.tavern.sidecar"].commit_metadata({ sidecarId: record.sidecarId, snapshot: record });
  if (!isRecord(committed) || committed.status !== "committed") {
    throw new TypeError("ERA Sidecar 聊天指针提交失败。");
  }
}

async function commitV2(context: Ctx, record: SidecarRecordV1): Promise<void> {
  await context.capabilities["era.tavern.sidecar"].write_record({ sidecarId: record.sidecarId, record });
  // 指针绝不能先于文件公开。回读同时让上传成功但落盘内容异常的情况
  // 停在旧聊天状态，避免产生“指针已切换、唯一状态却不可读取”的半事务。
  const reread = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId: record.sidecarId });
  const verified = inspectSidecar(
    { identity: record.owner, meta: { SidecarId: record.sidecarId }, stat: null },
    reread,
  );
  if (verified.record === null || verified.record.revision !== record.revision ||
    verified.record.sidecarId !== record.sidecarId) {
    throw new TypeError("ERA Sidecar 文件提交后验证失败。");
  }
  await publish(context, record);
}

export async function run(inputs: Readonly<{
  "era.sidecar.binding.input": { readonly value: unknown };
  "era.sidecar.binding.resolution": { readonly value: unknown };
}>, _params: Readonly<Record<string, unknown>>, context: Ctx): Promise<any> {
  const sync = (inputs["era.sidecar.binding.input"].value as { readonly sync: SyncContextV1 }).sync;
  const resolution = inputs["era.sidecar.binding.resolution"].value as SidecarResolutionV1;
  const { facts, choice } = resolution;
  // 派发上下文若已在 Sidecar 之前失败，就没有安全的消息/变量快照可迁移。
  // 此时保持原失败上下文由后续同步结果结算，绝不为了“修复绑定”去读取或清空
  // 聊天状态；否则一个无关的 Tavern 事件错误会制造 Sidecar 半事务。
  const syncStatus = (sync as { readonly status?: unknown }).status;
  if (syncStatus !== undefined && syncStatus !== "ready") {
    return {
      sidecar_applied_context: {
        ...sync,
        sidecarBinding: facts,
        sidecarBindingRoute: "continue",
        sidecarBindingChoice: null,
      },
      sidecar_binding_route: "continue",
    };
  }
  if (resolution.route === "continue") {
    if (facts.record !== null) await publish(context, facts.record);
    return { sidecar_applied_context: enrich(sync, facts, "continue", choice), sidecar_binding_route: "continue" };
  }
  if (resolution.route === "blocked") {
    return { sidecar_applied_context: enrich(sync, facts, "blocked", choice), sidecar_binding_route: "blocked" };
  }
  if (facts.status === "create" && facts.current !== null) {
    const targetId = context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    const record = recordFor(targetId, facts.current, stateFromSync(resolved, facts), null);
    await commitV2(context, record);
    // `apply` 只属于本 Nodeset 内部的决议阶段；事务已经完成后，输出给
    // task_sync 的同步上下文必须是可继续的正式路由。把它泄露为 `apply`
    // 会在工作流数据合同校验处被拒绝，导致已经完成的宿主写入无法结算。
    return { sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice), sidecar_binding_route: "continue" };
  }
  if (facts.status === "migrate-legacy" && facts.current !== null) {
    const targetId = facts.sidecarId ?? context.capabilities["era.tavern.sidecar"].create_id({}).sidecarId;
    const resolved = withSidecarId(sync, targetId);
    const record = recordFor(targetId, facts.current, stateFromSync(resolved, facts), facts.record ?? facts.legacyRecord);
    await commitV2(context, record);
    return { sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice), sidecar_binding_route: "continue" };
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
    // repair 处理的是“文件镜像落后于已提交聊天变量”的情形。同步上下文可能
    // 来自该次 UI 选择之前的规划快照，不能拿它覆盖刚刚由 API 写入的当前状态。
    const record = recordFor(targetId, rereadFacts.current, rereadFacts.record === null ? stateFromSync(resolved, rereadFacts) : stateFromRecord(rereadFacts.record), rereadFacts.record);
    await commitV2(context, record);
    context.capabilities["era.tavern.sidecar"].clear_prompt({});
    // 文件失败前已经确认写入的 Variable 指令是唯一可重放事实。repair 先恢复
    // 一个经过回读验证的 V2 基线，再强制完整同步，使该指令重新得出状态；绝不
    // 读取聊天变量作为后备状态，也不把旧 Sidecar 快照当作最终恢复结果。
    return { sidecar_applied_context: enrich(resolved, factsWithRecord(rereadFacts, record), "continue", choice), sidecar_binding_route: "continue" };
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
    const restore = durableRestoreInstruction(stateFromSync(sync, facts).statData, facts.record.state.statData);
    if (restore === null) throw new TypeError("当前聊天含有无法安全替换的受保护变量；请先修复当前聊天。");
    await context.capabilities["era.tavern.messages"].update_content({
      messageId: lastAi.messageId,
      content: `${lastAi.content}${restore}`,
      purpose: "era-sidecar-restore",
    });
    resolved = withAppendedRestore(sync, lastAi.messageId, restore);
  }

  resolved = withSidecarId(resolved, targetId);
  const state = choice === "independent" ? stateFromSync(resolved, facts) : stateFromRecord(facts.record);
  const record = recordFor(targetId, facts.current, state, choice === "migrate" ? facts.record : null);
  await commitV2(context, record);
  context.capabilities["era.tavern.sidecar"].clear_prompt({});
  // 同上：选择已经被事务消费，后续完整同步只接收规范的 continue 路由。
  return { sidecar_applied_context: enrich(resolved, factsWithRecord(facts, record), "continue", choice), sidecar_binding_route: "continue" };
}
