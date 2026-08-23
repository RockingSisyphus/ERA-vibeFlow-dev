import { normalizeLegacySafeObjectV1 } from "@era/vibeflow-contracts";

interface Envelope<T> { readonly value: T; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObjectEvent(value: string): boolean {
  return value === "era:insertByObject" || value === "era:updateByObject" || value === "era:deleteByObject" ||
    value === "era:functionInsertByObject" || value === "era:functionEditByObject" || value === "era:functionDeleteByObject";
}

export function run(inputs: Readonly<{ "era.api.request": Envelope<unknown> }>): any {
  const request = inputs["era.api.request"].value;
  if (!isRecord(request) || !isRecord(request.task)) {
    throw new TypeError("安全对象规范化缺少完整 API 请求。");
  }
  const eventType = String(request.task.eventType ?? "");
  if (!isObjectEvent(eventType)) return { safe_api_request: request };
  if (!Object.prototype.hasOwnProperty.call(request, "detail")) {
    throw new TypeError(`${eventType} 缺少对象 payload。`);
  }
  return {
    safe_api_request: {
      ...request,
      detail: normalizeLegacySafeObjectV1(request.detail),
    },
  };
}
