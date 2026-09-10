// Generated from Macro base_lib; do not edit.
export declare function decodeLazyMacro(value: string): string | null;
/**
 * 每个使用方都获取独立的正则实例，避免全局正则的 `lastIndex`
 * 在酒馆助手、DOM 刷新和单元测试之间相互污染。
 */
export declare function createEraMacroRegex(): RegExp;
export declare function containsEraMacro(text: string): boolean;
/** Tavern Helper 的同步宏回调只登记语义，真正的楼层快照由显示上下文决定。 */
export declare function createEraLazyMacroToken(source: string): string;
export declare function containsEraLazyMacroToken(value: string): boolean;
export declare function createLazyTokenRegex(): RegExp;
