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
