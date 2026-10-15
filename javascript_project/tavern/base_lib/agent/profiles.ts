import {record as isRecord} from "../browser.ts";
export function profileId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id) ? id : null;
}
export function profileRecord(value: unknown): any | null {
  if (!isRecord(value)) return null;
  const id = profileId(value.id);
  if (
    id === null ||
    typeof value.name !== 'string' ||
    typeof value.apiUrl !== 'string' ||
    typeof value.key !== 'string'
  ) {
    return null;
  }
  return { id, name: value.name, apiUrl: value.apiUrl, key: value.key };
}
export function profileSummary(profile: any): Record<string, unknown> {
  return {
    id: profile.id,
    name: profile.name,
    apiUrl: profile.apiUrl,
    hasKey: profile.key.length > 0,
  };
}
export function requireApiUrl(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('连接方案缺少 API 地址。');
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) throw new TypeError('API 地址长度无效。');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    throw new TypeError('API 地址不是有效 URL。', { cause: error });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('API 地址仅支持 HTTP 或 HTTPS。');
  }
  return trimmed.replace(/\/+$/u, '');
}
