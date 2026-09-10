/** 页面观察记录的估算预算；不限制实际请求或业务状态。 */
export const AGENT_RECORD_BUDGET_BYTES = 32 * 1024 * 1024;

/** 超过预算便停止遍历，因为调用方只需要判定能否保留观察副本。 */
export function observationBytes(value: unknown, limit = Infinity): number {
  if (typeof value === 'string') return 24 + value.length * 2;
  if (!value || typeof value !== 'object') return 8;
  let bytes = Array.isArray(value) ? 32 + value.length * 8 : 48;
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    bytes += 16 + key.length * 2 + observationBytes((value as Record<string, unknown>)[key], limit - bytes);
    if (bytes > limit) break;
  }
  return bytes;
}

/** 按插入顺序淘汰观察项；活动请求仅保护观察副本，不保证一定保留。 */
export class AgentRecordBudget {
  private readonly items = new Map<string, { bytes: number; active: boolean; release: () => void }>();
  private used = 0;
  constructor(readonly limit = AGENT_RECORD_BUDGET_BYTES) {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new TypeError('记录预算必须为非负整数。');
  }
  get stats() {
    return { usedBytes: this.used, limitBytes: this.limit, count: this.items.size };
  }
  remove(key: string): void {
    const item = this.items.get(key);
    if (!item) return;
    this.items.delete(key);
    this.used -= item.bytes;
    item.release();
  }
  /** 先释放被替换项的配额，再淘汰旧观察；拒绝保存也不能留下无计量旧副本。 */
  reserve(key: string, value: unknown, active: boolean, release: () => void): boolean {
    const bytes = 96 + key.length * 2 + observationBytes(value, this.limit);
    const previous = this.items.get(key);
    if (previous) {
      this.items.delete(key);
      this.used -= previous.bytes;
    }
    if (bytes > this.limit) {
      previous?.release();
      return false;
    }
    for (const [oldKey, item] of this.items) {
      if (this.used + bytes <= this.limit) break;
      if (!item.active) this.remove(oldKey);
    }
    if (this.used + bytes > this.limit) {
      previous?.release();
      return false;
    }
    this.items.set(key, { bytes, active, release });
    this.used += bytes;
    return true;
  }
  clear(): void {
    for (const key of this.items.keys()) this.remove(key);
  }
}
