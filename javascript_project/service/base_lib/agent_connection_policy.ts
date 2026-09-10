/** 连接方案的保存与目标选择规则；输入仅为本机公开事实，不读取宿主或秘密值。 */
export interface ConnectionState {
  readonly entryCount: number;
  readonly entryExists: boolean;
  readonly profile: { readonly id: string; readonly name: string; readonly apiUrl: string; readonly hasKey: boolean } | null;
}

export function connectionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id) ? id : null;
}

export function planConnectionSave(input: Readonly<Record<string, unknown>>, state: ConnectionState): Readonly<Record<string, unknown>> {
  const requestedId = connectionId(input.id);
  const existing = state.profile;
  if (existing === null && state.entryCount >= 64) {
    throw new RangeError("本机连接方案不得超过 64 个。");
  }
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 128) : "";
  if (name.length === 0) throw new TypeError("连接方案名称不能为空。");
  return {
    sourceId: requestedId,
    id: existing?.id ?? requestedId,
    name,
    apiUrl: input.apiUrl,
    status: existing === null ? "created" : "updated",
    keyMode: input.clearKey === true ? "clear" : "replace-if-nonempty-otherwise-preserve",
  };
}

export function planConnectionDelete(idValue: unknown, state: ConnectionState): Readonly<Record<string, unknown>> {
  const id = connectionId(idValue);
  if (id === null || !state.entryExists) {
    throw new TypeError("ERA_AGENT_PROFILE_MISSING：本机连接方案不存在。");
  }
  return { id };
}

export function planConnectionClear(state: ConnectionState): Readonly<Record<string, unknown>> {
  if (state.profile === null) {
    throw new TypeError("ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。");
  }
  return { id: state.profile.id, name: state.profile.name, apiUrl: state.profile.apiUrl };
}
