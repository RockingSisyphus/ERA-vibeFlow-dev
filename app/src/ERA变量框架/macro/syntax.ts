import { runEraMacroWorkflow } from './vibeflow-adapter';
export {
  createEraMacroRegex,
  containsEraMacro,
  createEraLazyMacroToken,
  containsEraLazyMacroToken,
} from '@era/vibeflow-macro-syntax';
export interface EraMacroSnapshot {
  statWithMeta: unknown;
  statWithoutMeta: unknown;
}
type PromptContent = SillyTavern.SendingMessage['content'];

/** 使用调用方的显式双视图进入现有同步Macro AOT，避免再次反转义。 */
export function parseEraMacroText(text: string, snapshot: EraMacroSnapshot): string {
  return runEraMacroWorkflow(text, { kind: 'view', mode: 'raw', ...snapshot });
}
/** DOM调用只解析延迟标记，宏值由调用方选定的楼层快照决定。 */
export function resolveEraLazyMacroTokens(text: string, snapshot: EraMacroSnapshot): string {
  return runEraMacroWorkflow(text, { kind: 'view', mode: 'lazy', ...snapshot });
}

/**
 * 替换一段酒馆提示词内容中的 ERA 宏。
 *
 * 多模态内容只处理 `text` 片段，图片和视频描述保持原对象不变。
 * 函数返回新数组和新的文本片段，不修改调用方传入的数据。
 */
export function parseEraMacroContent(content: PromptContent, snapshot: EraMacroSnapshot): PromptContent {
  if (typeof content === 'string') {
    return parseEraMacroText(content, snapshot);
  }

  if (!Array.isArray(content)) {
    return content;
  }

  return content.map(part => {
    if (part.type !== 'text') {
      return part;
    }

    return {
      ...part,
      text: parseEraMacroText(part.text, snapshot),
    };
  });
}

/**
 * 对完整提示词执行纯函数式替换。
 *
 * 这里刻意不判断 `role`：ERA 宏在 system、user、assistant、tool
 * 消息中具有完全一致的语义。生产环境由酒馆助手遍历提示词，本函数
 * 则为其他调用方和单元测试提供同等规则的无副作用实现。
 */
export function parseEraMacroPrompt(
  prompt: readonly SillyTavern.SendingMessage[],
  snapshot: EraMacroSnapshot,
): SillyTavern.SendingMessage[] {
  return prompt.map(message => ({
    ...message,
    content: parseEraMacroContent(message.content, snapshot),
  }));
}
