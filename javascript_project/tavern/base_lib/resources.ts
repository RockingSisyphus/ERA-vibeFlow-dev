/** 资源原语。这里只创建/取消句柄；准入、路由、结算顺序在 Config 和 Node 中。 */
export function deferred<T = any>(): any {
  let resolve: any;
  let reject: any;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

export function clock(): any {
  return {
    now: () => Date.now(),
    setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay),
    clearTimeout: (handle: any) => globalThis.clearTimeout(handle),
  };
}

/** 原始取消监听句柄。回调由资源 Node 提供，本原语不选择任何处理路径。 */
export function listenAbort(signal: AbortSignal, callback: () => void): () => void {
  signal.addEventListener("abort", callback, {once: true});
  return () => signal.removeEventListener("abort", callback);
}

export function linkedSignals(signals: (AbortSignal | undefined)[]): any {
  const controller = new AbortController();
  const removals: (() => void)[] = [];
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) { controller.abort(signal.reason); break; }
    const listener = () => controller.abort(signal.reason);
    signal.addEventListener("abort", listener, {once: true});
    removals.push(() => signal.removeEventListener("abort", listener));
  }
  return {signal: controller.signal, cleanup: () => { for (const remove of removals) remove(); }};
}

/** 每个 Promise 的局部取消清理在此原语中完成，不依赖不会再执行的尾节点。 */
export function abortable(operation: () => any, linked: any): Promise<any> {
  const signal: AbortSignal = linked.signal;
  if (signal.aborted) { linked.cleanup(); return Promise.reject(signal.reason); }
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (fn: () => void) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      linked.cleanup();
      fn();
    };
    const onAbort = () => finish(() => reject(signal.reason));
    signal.addEventListener("abort", onAbort, {once: true});
    try {
      Promise.resolve(operation()).then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    } catch (error) { finish(() => reject(error)); }
  });
}

/** 可取消的等待资源；拥有 Promise 的清理，不执行任务或事件选择。 */
export function waitResource(linked: any, onFinish: () => void): any {
  const d = deferred();
  const promise = abortable(() => d.promise, linked).finally(onFinish);
  return {promise, resolve: d.resolve, reject: d.reject};
}

/** 一次具体 API 操作的资源取消边界；operation 内容来自当前执行 Node。 */
export function suspendCall(frame: any, operation: (signal: AbortSignal) => any): Promise<any> {
  const s = frame.session;
  const linked = linkedSignals([s.lifecycle.signal, s.operational.signal, frame.options?.signal]);
  return abortable(() => s.resources.perform(() => operation(linked.signal)), linked);
}

/** 同步资源边界；不把即时操作推迟成 Promise 微任务。 */
export function syncCall(frame: any, operation: (signal: AbortSignal) => any): any {
  const s = frame.session;
  const linked = linkedSignals([s.lifecycle.signal, s.operational.signal, frame.options?.signal]);
  try {
    linked.signal.throwIfAborted();
    const value = operation(linked.signal);
    linked.signal.throwIfAborted();
    return value;
  } finally { linked.cleanup(); }
}

/** 只捕获一次已发起 IO 的结果。等待、分类和收尾由 Node 执行。 */
export function startResource(frame: any, operation: (signal: AbortSignal) => any, callback: (resource: any) => Promise<any>): any {
  const resource = completionResource(frame);
  resource.publicPromise = resource.promise;
  const raw = deferred();
  resource.promise = raw.promise;
  observeCompletion(resource, async () => await operation(resource.signal), outcome => {
    raw.resolve(outcome);
    return callback(resource);
  });
  return resource;
}

export async function resourceValue(frame: any): Promise<any> {
  if (frame.operationResource?.owner !== frame.session) throw new TypeError("等待资源不属于当前实例。");
  const outcome = await frame.operationResource.promise;
  if (outcome.status === "rejected") throw outcome.error;
  return outcome.value;
}
/** 单次 UI 事件原语；事件内容和是否调用由当前 Node 决定。 */
export function dispatchUi(api: any, type: string, detail: any): void {
  const target = api.window?.top ?? api.window;
  const EventType = api.CustomEvent ?? globalThis.CustomEvent;
  target?.dispatchEvent(new EventType(type, {detail}));
}
/** 原生扩展设置的局部存储引用；密钥不进入 Service DTO。 */
export function connectionStore(context: any): any {
  const original = context.extensionSettings.era_agent;
  const root = original !== null && typeof original === "object" && !Array.isArray(original) ? original : {};
  const profiles = root.connectionProfiles;
  if (profiles === null || typeof profiles !== "object" || Array.isArray(profiles)) root.connectionProfiles = {};
  context.extensionSettings.era_agent = root;
  return root.connectionProfiles;
}
/** 原始 IO 的完成回调和公开可取消等待分别拥有资源；不改变计数或处理结果。 */
export function completionResource(frame: any, signals?: (AbortSignal | undefined)[]): any {
  const s = frame.session, completion = deferred();
  const linked = linkedSignals(signals ?? [s.lifecycle.signal, s.operational.signal, frame.options?.signal]);
  const promise = abortable(() => completion.promise, linked);
  s.resources.track(completion.promise);
  s.resources.track(promise);
  return {owner: s, completion, signal: linked.signal, promise};
}
/** 一次原始 IO 的完成只转交已给定回调；这里不处理成功/失败、不归还租约。 */
export function observeCompletion(resource: any, operation: () => Promise<any>, callback: (outcome: any) => Promise<any>): void {
  const transfer = (outcome: any) => {
    let result;
    try { result = callback(outcome); }
    catch (error) { resource.completion.reject(error); return; }
    return Promise.resolve(result).then(resource.completion.resolve, resource.completion.reject);
  };
  let work;
  try {work=Promise.resolve(operation());}catch(error){work=Promise.reject(error);}
  const continuation=work.then(value=>transfer({status:"fulfilled",value}),error=>transfer({status:"rejected",error}));
  resource.owner.resources.track(continuation);
}

/** Capability 的一次实际 IO，只传原取消信号；原始 API 决定是否中止。
 * 公开等待由独立资源取消，后续动作和取消检查仍由原生 Node 执行。 */
export async function rawCall(frame: any, operation: (signal: AbortSignal) => any): Promise<any> {
  const linked = frame.operationResource?.signal
    ? {signal: frame.operationResource.signal, cleanup: () => {}}
    : linkedSignals([frame.session.lifecycle.signal, frame.session.operational.signal, frame.options?.signal]);
  try { return await operation(linked.signal); }
  finally { linked.cleanup(); }
}
