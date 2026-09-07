/** 设置面板使用的稳定行模型；value 保留原类型，type 只决定编辑控件。 */
export type EraSettingRow = {
  key: string;
  value: unknown;
  type: 'boolean' | 'number' | 'string' | 'json';
};

/** 非有限数字不能由 number 控件可靠往返，因此与对象一样使用 JSON 编辑。 */
export function detectSettingType(value: unknown): EraSettingRow['type'] {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'string') return 'string';
  return 'json';
}

/** 过滤宿主自管的悬浮球开关，避免设置面板与独立悬浮球生命周期产生两个写入者。 */
export function buildEditableSettingRows(settings: Readonly<Record<string, unknown>>): EraSettingRow[] {
  return Object.entries(settings)
    .filter(([key]) => key !== '开启悬浮球')
    .map(([key, value]) => ({ key, value, type: detectSettingType(value) }));
}

export function settingTypeLabel(type: EraSettingRow['type']): string {
  return type === 'boolean' ? '布尔' : type === 'number' ? '数字' : type === 'string' ? '字符串' : 'JSON';
}

/** 循环引用等异常值仍需在 UI 中可见，避免设置面板因单个值而整体失效。 */
export function stringifySetting(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function settingControlId(key: string): string {
  return `era-setting-${encodeURIComponent(key)}`;
}

/** JSON 草稿只做语法校验，不改变待保存值或已提交设置。 */
export function validateSettingJson(text: string) {
  if (!text.trim()) return { bad: true, ok: false, msg: '不能为空（若要设为 null 请写 null）' };
  try {
    JSON.parse(text);
    return { ok: true, bad: false, msg: 'JSON 格式有效' };
  } catch (error) {
    return { bad: true, ok: false, msg: `JSON 格式错误：${error instanceof Error ? error.message : ''}` };
  }
}

/** 先完整解析编辑值再提交，避免一个非法 JSON 导致部分设置提前写入。 */
export function collectSettingEdits(
  rows: readonly EraSettingRow[],
  edits: Record<string, unknown>,
  buffers: Record<string, string>,
  states: Record<string, { bad?: boolean }>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.type === 'json') {
      if (states[row.key]?.bad) throw new Error(`键 ${row.key} 的 JSON 格式不正确`);
      if (buffers[row.key] != null) result[row.key] = JSON.parse(buffers[row.key]);
    } else if (edits[row.key] !== undefined) result[row.key] = edits[row.key];
  }
  return result;
}
