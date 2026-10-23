/** ERA 可移植数据的共享视图转换；不读取宿主、状态或时间。 */
export type EraDataTransformDirection = "escape" | "unescape";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mapData<T>(value: T, text: (value: string) => string, omitMeta: boolean): T {
  if (Array.isArray(value)) return value.map(item => mapData(item, text, omitMeta)) as T;
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (omitMeta && key.startsWith("$")) continue;
      // __proto__ 等是用户数据键，不能触发原型 setter。
      Object.defineProperty(result, text(key), {value: mapData(value[key], text, omitMeta), enumerable: true, configurable: true, writable: true});
    }
    return result as T;
  }
  return (typeof value === "string" ? text(value) : value) as T;
}

/** 同时转换纯对象的键和值；保留数组位置和缺项，不修改输入。 */
export function transformEraData<T>(value: T, direction: EraDataTransformDirection): T {
  const ESCAPE: Readonly<Record<string, string>> = {".": "__DOT__", '"': "__DQUOTE__", "'": "__SQUOTE__"};
  const UNESCAPE: Readonly<Record<string, string>> = {__DOT__: ".", __DQUOTE__: '"', __SQUOTE__: "'"};
  const mapping = direction === "escape" ? ESCAPE : UNESCAPE;
  const pattern = direction === "escape" ? /[."']/g : /__DOT__|__DQUOTE__|__SQUOTE__/g;
  return mapData(value, text => text.replace(pattern, token => mapping[token]!), false);
}

export function unescapeEraData<T>(value: T): T {
  return transformEraData(value, "unescape");
}

/** 复制可移植数据，递归移除纯对象中以美元符开头的元字段。 */
export function removeMetaFields<T>(value: T): T {
  return mapData(value, text => text, true);
}

export function selectedMks(meta: Readonly<Record<string, unknown>>): (string | null)[] {
  return Array.isArray(meta.SelectedMks) ? meta.SelectedMks.map(value => typeof value === "string" ? value : null) : [];
}
