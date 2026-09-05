/**
 * @file ERA 消息写入机械适配
 * @description 只负责保留 Tavern 消息结构并执行无刷新文本更新；窗口、事务和同步规则仍由 Service workflow 决定。
 */

/** 为了避免 ERA 自己的写回开启新窗口，读取当前活动 swipe 文本供事件入口核对。 */
export function currentEraMessageText(id: number): string | null {
  const message = getChatMessages(id, { include_swipes: true })[0];
  if (!message) return null;
  if (Array.isArray(message.swipes)) {
    const text = message.swipes[Number(message.swipe_id ?? 0)];
    return typeof text === 'string' ? text : null;
  }
  const text =
    (message as { message?: unknown; mes?: unknown }).message ?? (message as { message?: unknown; mes?: unknown }).mes;
  return typeof text === 'string' ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function messageId(input: Readonly<Record<string, unknown>>): number {
  const id = input.message_id ?? input.messageId;
  if (!Number.isSafeInteger(id) || Number(id) < 0) throw new TypeError('消息更新请求缺少有效 messageId。');
  return Number(id);
}

function rememberExpectedUpdate(update: Record<string, unknown>, internalMessageWrites: Map<number, string>): void {
  const rawId = update.message_id ?? update.messageId;
  if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) return;
  const id = Number(rawId);
  const direct = update.message ?? update.mes;
  if (typeof direct === 'string') {
    internalMessageWrites.set(id, direct);
    return;
  }
  if (!Array.isArray(update.swipes)) return;
  const current = getChatMessages(id, { include_swipes: true })[0];
  const expected = update.swipes[Number(current?.swipe_id ?? 0)];
  if (typeof expected === 'string') internalMessageWrites.set(id, expected);
}

async function updateManyMessages(
  updates: unknown[],
  refresh: 'none' | 'affected' | 'all',
  internalMessageWrites: Map<number, string>,
): Promise<readonly number[]> {
  const messageIds = new Set<number>();
  const hostUpdates: Record<string, unknown>[] = [];
  for (const update of updates) {
    if (!isRecord(update)) continue;
    rememberExpectedUpdate(update, internalMessageWrites);
    const rawId = update.message_id ?? update.messageId;
    if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) continue;
    const id = Number(rawId);
    messageIds.add(id);

    // Workflow 只携带可移植的 ERA 自有 extra 补丁。宿主消息可能包含
    // undefined 或其他只在 Tavern 内成立的字段，不能把整份宿主 extra 塞入
    // 严格 JSON DTO；在真正写入前于 Host 边界合并，才能同时保留附件和未知字段。
    const patch = isRecord(update.extra) ? update.extra : null;
    if (patch === null) {
      hostUpdates.push(update);
      continue;
    }
    const current = getChatMessages(id, { include_swipes: true })[0];
    const currentRecord: Record<string, unknown> = isRecord(current) ? current : {};
    const currentExtra = isRecord(currentRecord.extra) ? currentRecord.extra : {};
    hostUpdates.push({
      ...update,
      extra: { ...currentExtra, ...patch },
    });
  }
  await setChatMessages(hostUpdates as Array<{ message_id: number }>, { refresh });
  return [...messageIds];
}

async function updateOneMessage(
  input: Readonly<Record<string, unknown>>,
  refresh: 'none' | 'affected' | 'all',
  internalMessageWrites: Map<number, string>,
): Promise<readonly number[]> {
  const id = messageId(input);
  const content = input.content;
  if (typeof content !== 'string') throw new TypeError('消息更新请求缺少文本 content。');
  const current = getChatMessages(id)[0];
  if (!current) throw new Error(`找不到消息 #${id}。`);
  internalMessageWrites.set(id, content);
  // 必须只写 `message`：Tavern Helper 会同步当前 swipe 且保留该页 extra。
  // 整体回写 `swipes` 会从 swipe_info 重建 extra；新用户消息的 swipe_info
  // 尚未携带附件，因此那条路径会丢失图片、音频等宿主元数据。
  await setChatMessages([{ message_id: id, message: content }], { refresh });
  return [id];
}

/**
 * 执行 workflow 已批准的消息更新并登记预期文本。预期文本用于吞掉 ERA 自己触发的
 * 更新事件，否则即时 commit 会被误认成用户编辑并开启新 scope 窗口。
 */
export async function updateEraMessageContent(
  input: Readonly<Record<string, unknown>>,
  internalMessageWrites: Map<number, string>,
): Promise<readonly number[]> {
  const updates = Array.isArray(input.updates)
    ? structuredClone(input.updates)
    : isRecord(input.update)
      ? [structuredClone(input.update)]
      : null;
  const refresh = input.refresh === 'affected' || input.refresh === 'all' ? input.refresh : 'none';
  if (updates) {
    return updateManyMessages(updates, refresh, internalMessageWrites);
  }
  return updateOneMessage(input, refresh, internalMessageWrites);
}
