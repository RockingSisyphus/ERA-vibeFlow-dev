/** 原宏语法与UTF-16延迟标记合同，不访问宿主。 */
function encodeLazyMacro(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    result += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return result;
}

export function decodeLazyMacro(value: string): string | null {
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
  return /{{\s*ERA(?:-withmeta)?\s*:/i.test(text);
}

/** Tavern Helper 的同步宏回调只登记语义，真正的楼层快照由显示上下文决定。 */
export function createEraLazyMacroToken(source: string): string {
  return `__ERA_LAZY_MACRO_V2_${encodeLazyMacro(source)}__`;
}

export function containsEraLazyMacroToken(value: string): boolean {
  return value.includes('__ERA_LAZY_MACRO_V2_');
}


export function createLazyTokenRegex(): RegExp { return /__ERA_LAZY_MACRO_V2_([0-9a-f]+)__/giu; }
