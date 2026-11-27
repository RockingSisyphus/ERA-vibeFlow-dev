/** 纯算法单元夹具只提供既有测试IO结果；实际图的调度和通信由独立AOT探针验证。 */
export function algorithmProgress(iterator: Generator<any, any, any>, context: any = {}): any {
  function next(value?: any, failed = false): any {
    const step = failed ? iterator.throw(value) : iterator.next(value);
    if (step.done) return step.value;
    const request = step.value;
    let response: any;
    try {
      if (request.kind === 'local_wait') response = request.value;
      else if (request.kind === 'resource')
        response = (
          typeof request.capability === 'string' ? context.capabilities[request.capability] : request.capability
        )[request.operation](request.input);
      else throw new Error('此纯算法夹具未提供计算工作流；请用正式AOT夹具验证。');
    } catch (error) {
      return next(error, true);
    }
    return response && typeof response.then === 'function'
      ? Promise.resolve(response).then(
          value => next(value),
          error => next(error, true),
        )
      : next(response);
  }
  return next();
}
