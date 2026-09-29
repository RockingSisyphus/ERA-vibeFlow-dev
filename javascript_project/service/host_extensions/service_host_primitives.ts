import { isJsonValue,type EraTransportEventV1,type JsonValue } from "@era/vibeflow-contracts";
import type { EraAdmissionRejected,LinkedSignal,QueueEntry } from "./service_host_types.ts";
export class EraServiceHostError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EraServiceHostError";
    this.code = code;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function configuredPositiveInteger(value: unknown, fallback: number): number {
  return positiveInteger(value) ? value : fallback;
}

export function configuredNonNegativeInteger(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

export function abortReason(signal: AbortSignal, fallback: string): unknown {
  return signal.reason ?? new EraServiceHostError("ERA_HOST_ABORTED", fallback);
}

export function throwIfAborted(signal: AbortSignal, fallback: string): void {
  if (signal.aborted) throw abortReason(signal, fallback);
}

export function linkSignals(
  signals: readonly (AbortSignal | undefined)[],
): LinkedSignal {
  const controller = new AbortController();
  const listeners: Array<readonly [AbortSignal, () => void]> = [];
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const listener = () => controller.abort(signal.reason);
    signal.addEventListener("abort", listener, { once: true });
    listeners.push([signal, listener]);
  }
  return {
    signal: controller.signal,
    cleanup(): void {
      for (const [signal, listener] of listeners) {
        signal.removeEventListener("abort", listener);
      }
    },
  };
}

export function awaitWithAbort<T>(
  operation: () => T | Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal, "宿主异步操作已经取消。"));
  }
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void): void => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () =>
      finish(() => reject(abortReason(signal, "宿主异步操作已经取消。")));
    signal.addEventListener("abort", onAbort, { once: true });
    let result: T | Promise<T>;
    try {
      result = operation();
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    Promise.resolve(result).then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

export function cloneJsonValue(
  value: unknown,
): { readonly ok: true; readonly value: JsonValue } | { readonly ok: false } {
  try {
    // Tavern Helper 在 iframe 中执行用户脚本；跨 realm 的普通对象拥有不同的
    // Object.prototype。先结构化克隆到 Host realm，再做 JsonValue 严格校验，
    // 可避免把合法 API detail 误编码为不可供 workflow 读取的 host-ref。
    const cloned = structuredClone(value);
    if (!isJsonValue(cloned)) return { ok: false };
    return {
      ok: true,
      value: deepFreeze(cloned as JsonValue),
    };
  } catch {
    return { ok: false };
  }
}

export function refKind(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  const constructorName = (value as { constructor?: { name?: unknown } })
    .constructor?.name;
  return typeof constructorName === "string" && constructorName.length > 0
    ? constructorName
    : "object";
}

export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }
  return value;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function rejectAdmission(
  code: EraAdmissionRejected["code"],
  message: string,
): EraAdmissionRejected {
  return Object.freeze({ accepted: false, code, message });
}

export class HostReferenceRegistry {
  private readonly values = new Map<string, unknown>();
  private readonly tokensBySequence = new Map<number, readonly string[]>();

  commit(sequence: number, references: ReadonlyMap<string, unknown>): void {
    const tokens = [...references.keys()];
    for (const [token, value] of references) this.values.set(token, value);
    if (tokens.length > 0) this.tokensBySequence.set(sequence, tokens);
  }

  resolve(token: string): unknown {
    if (!this.values.has(token)) {
      throw new EraServiceHostError(
        "ERA_HOST_REF_UNKNOWN",
        `宿主引用令牌不存在或已经释放：${token}`,
      );
    }
    return this.values.get(token);
  }

  release(sequence: number): void {
    const tokens = this.tokensBySequence.get(sequence) ?? [];
    for (const token of tokens) this.values.delete(token);
    this.tokensBySequence.delete(sequence);
  }

  clear(): void {
    this.values.clear();
    this.tokensBySequence.clear();
  }

  get size(): number {
    return this.values.size;
  }
}

export class BoundedEventQueue {
  private readonly entries: QueueEntry[] = [];
  private byteCount = 0;

  constructor(
    private readonly maxEvents: number,
    private readonly maxBytes: number,
  ) {}

  canPush(bytes: number): boolean {
    return (
      this.entries.length < this.maxEvents &&
      this.byteCount + bytes <= this.maxBytes
    );
  }

  push(event: EraTransportEventV1): void {
    this.entries.push({ event });
    this.byteCount += event.encodedBytes;
  }

  shift(): EraTransportEventV1 | undefined {
    const entry = this.entries.shift();
    if (!entry) return undefined;
    this.byteCount -= entry.event.encodedBytes;
    return entry.event;
  }

  clear(): void {
    this.entries.splice(0, this.entries.length);
    this.byteCount = 0;
  }

  get length(): number {
    return this.entries.length;
  }

  get bytes(): number {
    return this.byteCount;
  }
}


export function createHostExtension(): { start(): void; stop(): void } { return { start() {}, stop() {} }; }
