import {emit, takeFrame, assertRunning, EraServiceHostError} from "../base_lib/frames.ts";
export function CheckOperation(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  assertRunning(f.session);
  f.options?.signal?.throwIfAborted();
  if (f.input === null || typeof f.input !== "object" || Array.isArray(f.input)) throw new TypeError("Capability 输入必须是对象。");
  return emit({frame: f}, params);
}
export function ReturnOperation(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.session.lifecycle.signal.throwIfAborted();
  f.session.operational.signal.throwIfAborted();
  f.options?.signal?.throwIfAborted();
  return emit({frame: f}, params);
}

/** Agent 请求边界只解析本次已登记闭包，不展开密码内容。 */
export function CheckSecretOperation(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  assertRunning(f.session); f.options?.signal?.throwIfAborted();
  if (f.input === null || typeof f.input !== "object" || Array.isArray(f.input)) throw new TypeError("Capability 输入必须是对象。");
  const reference = f.input.keyReference;
  if (reference?.kind === "host-ref" && typeof reference.token === "string") {
    if (!f.session.refs.has(reference.token)) throw new EraServiceHostError("ERA_HOST_REF_UNKNOWN", `宿主引用令牌不存在或已经释放：${reference.token}`);
    const keyProvider = f.session.refs.get(reference.token);
    if (typeof keyProvider !== "function") throw new EraServiceHostError("ERA_HOST_REF_KIND", "Agent 密钥宿主引用必须解析为页面实例闭包。");
    const {keyReference, ...rest} = f.input;
    f.input = Object.freeze({...rest, keyProvider});
  }
  return emit({frame: f}, params);
}
