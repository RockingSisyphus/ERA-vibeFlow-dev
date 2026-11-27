/** 只保留原业务算法的局部进度，不执行通信、不调度工作流。 */
export interface BusinessProgress { iterator: Generator<any, any, any>; environment: any; request: any; result: any; done: boolean; reply?: any; waitToken?: string; }
export function createProgress(factory: any, inputs: any, params: any): BusinessProgress {
  const environment: any = {signal: undefined};
  return {iterator: factory(inputs, params, environment), environment, request: null, result: undefined, done: false};
}
function settle(state: BusinessProgress, step: IteratorResult<any>): BusinessProgress {
  state.done = step.done === true;
  if (state.done) {state.result = step.value; state.request = null;} else state.request = step.value;
  return state;
}
export function advanceSync(state: BusinessProgress, value?: any, failure?: any, signal?: AbortSignal): BusinessProgress {
  state.environment.signal = signal;
  try {
    const step = failure === undefined ? state.iterator.next(value) : state.iterator.throw(failure);
    if (!step.done && step.value?.kind === 'local_wait') throw new TypeError('同步业务步骤返回了需要等待的计算。');
    return settle(state, step);
  } finally {state.environment.signal = undefined;}
}
export async function advanceAsync(state: BusinessProgress, value?: any, failure?: any, signal?: AbortSignal): Promise<BusinessProgress> {
  state.environment.signal = signal;
  try {
    let step = failure === undefined ? state.iterator.next(value) : state.iterator.throw(failure);
    while (!step.done && step.value?.kind === 'local_wait') {
      try {step = state.iterator.next(await step.value.value);} catch(error) {step = state.iterator.throw(error);}
    }
    return settle(state, step);
  } finally {state.environment.signal = undefined;}
}
export function* mapProgress(items: readonly any[], transform: any, thisArg?: any): Generator<any, any[], any> {
  const result = new Array(items.length);
  for (let i = 0; i < items.length; i++) if (i in items) result[i] = yield* transform.call(thisArg, items[i], i, items);
  return result;
}
