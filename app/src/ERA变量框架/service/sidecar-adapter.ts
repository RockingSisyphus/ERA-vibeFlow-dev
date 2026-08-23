/*
 * 模块职责：负责作为 ERA Sidecar 的 Tavern Helper 宿主接线层，读取当前身份和聊天
 * 指针、执行当前用户 files I/O，并在事务成功后发布易失宏快照。模块边界：
 *
 * 这里只搬运宿主事实、当前用户 files 和 UI 通知；绝不判断 owner 是否冲突、
 * 绝不决定迁移/复制，也不生成 ERA 指令。那些业务规则必须位于 Service Nodeset。
 */

import type { EraCapabilityContext } from './types';
import { publishSidecarRuntimeSnapshot, type SidecarRuntimeIdentity } from './sidecar-runtime-snapshot';

export const SIDECAR_PROMPT_EVENT = 'era-sidecar-binding-prompt';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clonePortable<T>(value: T): T {
  return structuredClone(value);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('ERA 宿主操作已取消。', 'AbortError');
}

function topWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.top ?? window;
  } catch {
    return window;
  }
}

function currentIdentity(): Readonly<Record<string, unknown>> {
  const characterId = getCurrentCharacterId();
  const groupId = SillyTavern.groupId || null;
  const chatId = SillyTavern.getCurrentChatId();
  if ((typeof characterId !== 'string' && characterId !== null) || typeof chatId !== 'string' || chatId.length === 0) {
    throw new TypeError('ERA 无法读取当前角色卡或聊天身份。');
  }
  return { characterId, groupId, chatId };
}

function runtimeIdentity(value: unknown): SidecarRuntimeIdentity {
  if (
    !isRecord(value) ||
    (typeof value.characterId !== 'string' && value.characterId !== null) ||
    (typeof value.groupId !== 'string' && value.groupId !== null) ||
    typeof value.chatId !== 'string'
  ) {
    throw new TypeError('ERA Sidecar 运行时快照身份无效。');
  }
  return { characterId: value.characterId, groupId: value.groupId, chatId: value.chatId };
}

function sidecarId(value: unknown): string {
  if (typeof value !== 'string' || !/^era_chat_[a-z0-9-]{8,80}$/iu.test(value)) {
    throw new TypeError('ERA SidecarId 无效。');
  }
  return value;
}

function fileName(id: string): string {
  return `era-sidecar-v1-${id}.json`;
}

function fileUrl(id: string): string {
  return `/user/files/${encodeURIComponent(fileName(id))}`;
}

function requestHeaders(): HeadersInit {
  return typeof SillyTavern.getRequestHeaders === 'function'
    ? SillyTavern.getRequestHeaders()
    : { 'Content-Type': 'application/json' };
}

function encodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return btoa(unescape(encodeURIComponent(json)));
}

async function readCurrentSidecar(
  _input: Readonly<Record<string, unknown>>,
  context: EraCapabilityContext,
): Promise<unknown> {
  throwIfAborted(context.signal);
  const variables = clonePortable(getVariables({ type: 'chat' }));
  const meta = isRecord(variables.ERAMetaData) ? clonePortable(variables.ERAMetaData) : null;
  const stat =
    isRecord(variables) && Object.prototype.hasOwnProperty.call(variables, 'stat_data')
      ? clonePortable(variables.stat_data)
      : null;
  return { identity: currentIdentity(), meta, stat };
}

async function readSidecarFile(
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityContext,
): Promise<unknown> {
  throwIfAborted(context.signal);
  const id = sidecarId(input.sidecarId);
  const response = await fetch(fileUrl(id), { headers: requestHeaders(), signal: context.signal });
  if (response.status === 404) return { status: 'missing', sidecarId: id };
  if (!response.ok) throw new TypeError(`ERA Sidecar 文件读取失败：${response.status}`);
  const text = await response.text();
  try {
    return { status: 'found', sidecarId: id, record: clonePortable(JSON.parse(text)) };
  } catch {
    return { status: 'invalid', sidecarId: id };
  }
}

async function writeSidecarFile(
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityContext,
): Promise<unknown> {
  throwIfAborted(context.signal);
  const id = sidecarId(input.sidecarId);
  if (!isRecord(input.record)) throw new TypeError('ERA Sidecar 文件写入缺少 record。');
  const record = clonePortable(input.record);
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: requestHeaders(),
    signal: context.signal,
    body: JSON.stringify({ name: fileName(id), data: encodeJson(record) }),
  });
  if (!response.ok) throw new TypeError(`ERA Sidecar 文件写入失败：${response.status}`);
  return { status: 'committed', sidecarId: id, url: fileUrl(id) };
}

/**
 * 指针提交只能发生在 Service 已写入并回读文件后；否则宏可能看到无来源的
 * 新快照，或者聊天已清空而唯一状态尚未持久化。
 */
async function commitSidecarPointer(
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityContext,
): Promise<unknown> {
  throwIfAborted(context.signal);
  const id = sidecarId(input.sidecarId);
  updateVariablesWith(
    current => {
      delete current.stat_data;
      current.ERAMetaData = { SidecarId: id };
      return current;
    },
    { type: 'chat' },
  );
  if (isRecord(input.snapshot)) {
    const snapshot = input.snapshot;
    const owner = runtimeIdentity(snapshot.owner);
    const revision = snapshot.revision;
    const state = snapshot.state;
    if (
      !Number.isSafeInteger(revision) ||
      !isRecord(state) ||
      !isRecord(state.eraMeta) ||
      !Object.prototype.hasOwnProperty.call(state, 'statData')
    ) {
      throw new TypeError('ERA Sidecar 提交后的快照无效。');
    }
    const actual = runtimeIdentity(currentIdentity());
    if (
      actual.characterId === owner.characterId &&
      actual.groupId === owner.groupId &&
      actual.chatId === owner.chatId
    ) {
      publishSidecarRuntimeSnapshot({
        sidecarId: id,
        identity: owner,
        revision: revision as number,
        statData: clonePortable(state.statData),
        eraMeta: clonePortable(state.eraMeta),
      });
    }
  }
  return { status: 'committed', sidecarId: id, variables: clonePortable(getVariables({ type: 'chat' })) };
}

/**
 * 用原生 `/api/files` 读写当前 SillyTavern 用户的私有 files 目录。
 *
 * 必须让 Adapter 只承担浏览器/宿主 I/O：否则 owner 冲突、迁移和复制规则会散落在
 * Host，既无法由 VibeFlow 审核，也会绕过 Sidecar Nodeset 的提交前复核。
 */
export function createSidecarAdapter() {
  return {
    read_current: readCurrentSidecar,
    read_record: readSidecarFile,
    /**
     * 将完整、版本化记录原子地交给 SillyTavern 文件端点。
     *
     * 这里故意不吞掉网络或权限失败；workflow 必须能把失败呈现为可重试状态，
     * 否则聊天变量已经提交而本地镜像未提交时会被误报为成功。
     */
    write_record: writeSidecarFile,
    /**
     * 只提交当前聊天内的稳定 SidecarId，同时删除旧 ERA 状态字段。业务状态
     * 已在 workflow 先确认写入 Sidecar 文件；Host 不判断归属或迁移策略。
     */
    commit_metadata: commitSidecarPointer,
    create_id: (_input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      return { sidecarId: `era_chat_${globalThis.crypto.randomUUID()}` };
    },
    present_prompt: (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      if (!isRecord(input.prompt)) throw new TypeError('ERA Sidecar 弹窗缺少 prompt。');
      topWindow()?.dispatchEvent(new CustomEvent(SIDECAR_PROMPT_EVENT, { detail: clonePortable(input.prompt) }));
      return { status: 'presented' };
    },
    clear_prompt: (_input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      topWindow()?.dispatchEvent(new CustomEvent(SIDECAR_PROMPT_EVENT, { detail: null }));
      return { status: 'cleared' };
    },
  };
}
