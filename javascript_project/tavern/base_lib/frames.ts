/** 辅助 root 的内部资源句柄只在当前页面传递；不会进入主 Service DTO。 */
export interface CallFrame {
  action: string;
  /** 固定机械接线的调用来源。展示端据此返回关闭拒绝码；Service发起的跨Node资源由辅助流程持有，不沿用发起Node的短暂信号。仅在辅助root内部传递，不进入Service事件DTO。 */
  origin?: "presentation" | "service";
  input?: any;
  options?: any;
  session?: any;
  config?: any;
  extensionId?: string;
  dispatch?: any;
  result?: any;
  [key: string]: any;
}

/** 只解包原生输入 envelope。集合只允许当前互斥分支的唯一实际结果。 */
export function takeFrame(inputs: any): CallFrame {
  const envelopes = Object.values(inputs).flat().filter(Boolean) as any[];
  if (envelopes.length !== 1 || !envelopes[0].value)
    throw new Error("当前路径必须恰好提供一份辅助流程调用资料。");
  return {...envelopes[0].value};
}

export function route(frame: CallFrame, value: string): any {
  return {frame, route: value};
}

/** 把内部输出角色映射到 Node 的唯一 contract key，不改变数据或选择路径。 */
export function emit(values: Record<string, any>, params: any): any {
  return Object.fromEntries(Object.entries(values).map(([role, value]) => [params.outputKeys[role], value]));
}

export class EraServiceHostError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "EraServiceHostError";
  }
}

export function rejection(code: string, message: string): any {
  return Object.freeze({accepted: false, code, message});
}

export function assertRunning(s: any, fatal = true): void {
  if (!s.started || s.stopping || s.lifecycle.signal.aborted)
    throw new EraServiceHostError("ERA_HOST_NOT_STARTED", "ERA 服务宿主未启动或正在停止。");
  if (fatal && (s.fatalTransitioning || s.fatalLatched))
    throw new EraServiceHostError("ERA_HOST_FATAL", "ERA 服务宿主已进入致命态。");
}

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function warn(s: any, message: string, details: any = {}): void {
  try {
    if (s.warn) s.warn(message, details);
    else s.log.warn(message, details);
  } catch (error) { s.log.error("ERA 服务宿主告警回调发生异常。", error); }
}
