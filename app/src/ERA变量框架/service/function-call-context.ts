import type { EraFacade } from './public-api';

/** 原始参数对象绑定这一处调用，避免用全局当前函数误判并发脚本的API来源。 */
const contexts = new WeakMap<object, EraFacade>();

export function bindFunctionCallContext(parameters: object, facade: EraFacade): () => void {
  contexts.set(parameters, facade);
  return () => contexts.delete(parameters);
}

export function functionCallContext(parameters: object): EraFacade {
  const facade = contexts.get(parameters);
  if (!facade) throw new Error('ERA_FUNCTION_CONTEXT_EXPIRED');
  return facade;
}
