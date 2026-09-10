// Generated from Service base_lib/domain; do not edit.
export type EraDataTransformDirection = 'escape' | 'unescape';
/** 同一遍历使用同一映射，保持原对象键和值的转换语义。 */
export declare function transformEraData<T>(data: T, direction: EraDataTransformDirection): T;
/**
 * 返回不含 `$` 元字段的深拷贝。
 * 必须在独立纯模块中完成，否则作者只读投影会反向依赖 Sidecar 运行时并扩大状态生命周期。
 */
export declare function removeMetaFields<T>(value: T): T;
export declare function selectedMks(meta: Readonly<Record<string, unknown>>): (string | null)[];
