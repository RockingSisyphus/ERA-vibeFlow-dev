import _ from 'lodash';

/**
 * ERA 宏解析所需的只读快照。
 *
 * 解析器不主动读取酒馆变量。这样既能保证一次解析使用同一份状态，
 * 也能让核心规则在 Node 单元测试中运行，而无需模拟浏览器或酒馆环境。
 */
export interface EraMacroSnapshot {
  statWithMeta: unknown;
  statWithoutMeta: unknown;
}

type PromptContent = SillyTavern.SendingMessage['content'];

const ERA_MACRO_QUICK_CHECK = /{{\s*ERA(?:-withmeta)?\s*:/i;
const LAZY_TOKEN_PREFIX = '__ERA_LAZY_MACRO_V2_';
const LAZY_TOKEN_PATTERN = /__ERA_LAZY_MACRO_V2_([0-9a-f]+)__/giu;

function encodeLazyMacro(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    result += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return result;
}

function decodeLazyMacro(value: string): string | null {
  if (value.length % 4 !== 0) return null;
  let result = '';
  for (let index = 0; index < value.length; index += 4) {
    const code = Number.parseInt(value.slice(index, index + 4), 16);
    if (!Number.isFinite(code)) return null;
    result += String.fromCharCode(code);
  }
  return result;
}

/**
 * 每个使用方都获取独立的正则实例，避免全局正则的 `lastIndex`
 * 在酒馆助手、DOM 刷新和单元测试之间相互污染。
 */
export function createEraMacroRegex(): RegExp {
  return /{{\s*ERA(-withmeta)?\s*:\s*([^}]+?)\s*}}/gi;
}

export function containsEraMacro(text: string): boolean {
  return ERA_MACRO_QUICK_CHECK.test(text);
}

/** Tavern Helper 的同步宏回调只登记语义，真正的楼层快照由显示上下文决定。 */
export function createEraLazyMacroToken(source: string): string {
  return `${LAZY_TOKEN_PREFIX}${encodeLazyMacro(source)}__`;
}

export function containsEraLazyMacroToken(value: string): boolean {
  return value.includes(LAZY_TOKEN_PREFIX);
}

/**
 * 使用指定快照替换字符串中的全部 ERA 宏。
 *
 * - `{{ERA:path}}` 从不含 `$` 元字段的快照中读取。
 * - `{{ERA-withmeta:path}}` 从原始快照中读取。
 * - 路径为 `$ALLDATA` 时返回对应的完整快照。
 * - 路径不存在时沿用 ERA 既有语义，替换为空字符串。
 */
export function parseEraMacroText(text: string, snapshot: EraMacroSnapshot): string {
  if (!containsEraMacro(text)) {
    return text;
  }

  return text.replace(createEraMacroRegex(), (substring, withMeta: string | undefined, rawPath: string) => {
    const source = withMeta ? snapshot.statWithMeta : snapshot.statWithoutMeta;
    if (source === null || source === undefined) {
      return substring;
    }

    const path = rawPath.trim();
    const value = path === '$ALLDATA' ? source : _.get(source, path);
    if (value === undefined) {
      return '';
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value) ?? '';
    }

    return String(value);
  });
}

/** 使用调用方已经选定的最新或历史快照解析惰性宏。 */
export function resolveEraLazyMacroTokens(value: string, snapshot: EraMacroSnapshot): string {
  if (!containsEraLazyMacroToken(value)) return value;
  LAZY_TOKEN_PATTERN.lastIndex = 0;
  return value.replace(LAZY_TOKEN_PATTERN, (token, encoded: string) => {
    const source = decodeLazyMacro(encoded);
    return source === null ? token : parseEraMacroText(source, snapshot);
  });
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
