import { projectMessage, readProjectedMessages } from './projection.ts';

/** 紧贴消息更新的宿主事实核对；是否忽略过时同步由 Service 决定。 */
export interface MessageWriteTarget {
  readonly messageId: number;
  readonly swipeId: number;
  readonly sourceText: string;
  readonly role?: string;
}

/** 消息所属聊天的完整身份，避免同名聊天或相同楼号跨角色误写。 */
export interface MessageWriteChat {
  readonly characterId: string | null;
  readonly chatId: string;
  readonly groupId: string | null;
}

export class MessageWriteTargetChanged extends Error {
  readonly code = 'ERA_MESSAGE_WRITE_TARGET_CHANGED';
  readonly written = false;

  constructor(
    readonly reason: 'chat' | 'missing-message' | 'swipe' | 'source-text' | 'message-count' | 'role' | 'binding',
    readonly messageId: number | null,
  ) {
    super(`消息写入目标已变化：${reason}${messageId === null ? '' : ` (#${messageId})`}。`);
    this.name = 'MessageWriteTargetChanged';
  }
}

/** 明确尚未发生消息副作用，由Service统一保留待写项。 */
export class MessageCandidatePending extends Error {
  readonly code = 'ERA_MESSAGE_CANDIDATE_PENDING';
  readonly written = false;
  constructor(readonly messageId: number, readonly candidate: ReturnType<typeof projectMessage>) {
    super(`消息 #${messageId} 的候选仍由原生生成持有。`);
    this.name = 'MessageCandidatePending';
  }
}

export function assertMessageNotEditing(api: any, messageId: number): void {
  const document = (api.window?.top ?? api.window)?.document;
  const floor = document?.querySelector?.("#chat .mes .edit_textarea")?.closest(".mes[mesid]");
  if (floor && Number(floor.getAttribute("mesid")) === messageId) {
    throw Object.assign(new Error("目标楼层正在编辑，请保存或取消编辑后再提交。"), {
      code: "ERA_API_MESSAGE_EDITING", written: false,
    });
  }
}

/** 只检查本批真正要写的目标；必须紧贴setChatMessages且中间不得await。 */
export function assertWritableCandidates(api: any, session: any, updates: readonly any[]): void {
  const messages = readProjectedMessages(api, session);
  for (const update of updates) {
    const id = update.message_id ?? update.messageId;
    const message = messages.find(item => item.messageId === id);
    if (!message) throw new MessageWriteTargetChanged('missing-message', id);
    if (!message.candidate.exists || message.candidate.phase === 'generating') throw new MessageCandidatePending(id, message);
  }
}

/** 为了防止等待后的消息写回越过来源，必须同步核对事实，不持有引用或改变选择。 */
export function assertCurrentMessageBasis(api: any, value: unknown, session?: any): void {
  const basis = value as {
    identity?: MessageWriteChat;
    messages?: Array<{ messageId: number; swipeIndex: number | null; activeText: string; role: string; candidate?: any }>;
  } | null;
  if (!basis?.identity || !Array.isArray(basis.messages)) throw new TypeError('消息提交缺少源聊天和消息依据。');
  const actualChat = {
    characterId: api.getCurrentCharacterId(),
    chatId: api.SillyTavern.getCurrentChatId(),
    groupId: api.SillyTavern.groupId || null,
  };
  // 先核对聊天，避免读到另一个聊天的数据并给出误导诊断。
  assertMessageWriteTargets(basis.identity, actualChat, [], () => null);
  const messages = readProjectedMessages(api, session);
  // 后续楼层不改变已计算范围；必须校验原范围内的文本、角色和Swipe以避免覆盖用户编辑。
  if (messages.length < basis.messages.length) throw new MessageWriteTargetChanged('message-count', null);
  const byId = new Map(messages.map(message => [message.messageId, message]));
  if (session) {
    const candidates = byId;
    for (const source of basis.messages) {
      const now=candidates.get(source.messageId);
      if(source.candidate?.generation!==null && source.candidate?.generation!==undefined && now?.candidate.generation!==source.candidate.generation &&
        !(now?.candidate.phase==='preparing'&&now.candidate.predecessor===source.candidate.generation))
        throw new MessageWriteTargetChanged('swipe',source.messageId);
      if(source.candidate?.phase!== 'cancelled' && now?.candidate.phase==='cancelled')
        throw new MessageWriteTargetChanged('swipe',source.messageId);
    }
  }
  assertMessageWriteTargets(
    basis.identity,
    actualChat,
    basis.messages.map(message => ({
      messageId: message.messageId,
      swipeId: message.swipeIndex ?? 0,
      sourceText: message.activeText,
      role: message.role,
    })),
    id => {
      const message = byId.get(id);
      if (!message) return null;
      return { swipeId: message.swipeIndex ?? 0, text: message.activeText, role: message.role };
    },
  );
}

/** 此函数及调用者到 setChatMessages 之间不得 await。只读事实，不切回旧 Swipe。 */
export function assertMessageWriteTargets(
  expectedChat: MessageWriteChat,
  currentChat: MessageWriteChat,
  targets: readonly MessageWriteTarget[],
  readMessage: (id: number) => { readonly swipeId: number; readonly text: string; readonly role?: string } | null,
): void {
  if (
    expectedChat.characterId !== currentChat.characterId ||
    expectedChat.chatId !== currentChat.chatId ||
    expectedChat.groupId !== currentChat.groupId
  ) {
    throw new MessageWriteTargetChanged('chat', null);
  }
  for (const target of targets) {
    const current = readMessage(target.messageId);
    if (current === null) throw new MessageWriteTargetChanged('missing-message', target.messageId);
    if (current.swipeId !== target.swipeId) throw new MessageWriteTargetChanged('swipe', target.messageId);
    if (target.role !== undefined && current.role !== target.role)
      throw new MessageWriteTargetChanged('role', target.messageId);
    if (current.text !== target.sourceText) throw new MessageWriteTargetChanged('source-text', target.messageId);
  }
}

/** 在实际副作用前同步核对 Service 决议对应的聊天绑定。 */
export function assertExpectedSidecarPointer(api: any, input: Readonly<Record<string, unknown>>): void {
  if (!Object.hasOwn(input, 'expectedSidecarId')) return;
  const variables = api.getVariables({ type: 'chat' });
  const meta = variables.ERAMetaData;
  const value = meta !== null && typeof meta === 'object' ? (meta as Record<string, unknown>).SidecarId : null;
  const actual = typeof value === 'string' && /^era_chat_[a-z0-9-]{8,80}$/iu.test(value) ? value : null;
  if (actual !== input.expectedSidecarId) throw new MessageWriteTargetChanged('binding', null);
}
