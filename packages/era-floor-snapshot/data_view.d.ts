// Generated from Service base_lib/snapshot; do not edit.
/** ERA 可移植数据的共享视图转换；不读取宿主、状态或时间。 */
export type EraDataTransformDirection = "escape" | "unescape";
/** 同时转换纯对象的键和值；保留数组位置和缺项，不修改输入。 */
export declare function transformEraData<T>(value: T, direction: EraDataTransformDirection): T;
export declare function unescapeEraData<T>(value: T): T;
/** 复制可移植数据，递归移除纯对象中以美元符开头的元字段。 */
export declare function removeMetaFields<T>(value: T): T;
export declare function selectedMks(meta: Readonly<Record<string, unknown>>): (string | null)[];
/** 将点号和方括号写法转换为对象键。旧楼层日志忽略开头点号产生的空键。 */
export declare function pathSegments(path: string, preserveLeadingEmpty?: boolean): string[];
