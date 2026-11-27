/** 仅测试侧：把既有外部IO断言接到官方通信，生产代码不提供旧Capability回退。 */
import { encodePacket, decodePacket } from '../../../base_lib/workflow_values/codec.mjs';
import { readFileSync } from 'node:fs';
import { URL as ResourceURL } from 'node:url';
const declaration = JSON.parse(
  readFileSync(new ResourceURL('../../../javascript_project/tavern/bindings.jsonc', import.meta.url), 'utf8'),
);
export function resourceClient(native, resources, takePending = () => undefined) {
  const address = () => resources.metadata();
  const syncTarget = { root: 'era-tavern', path: 'configs/era.tavern.sync.jsonc', entry: 'protocol' };
  const asyncTarget = { root: 'era-tavern', path: 'configs/era.tavern.operation.jsonc', entry: 'protocol_operation' };
  function prefix(capability, operation, input) {
    const output = native.invoke_sync({
      workflow: syncTarget,
      inputs: { wire_request: encodePacket({ ownerToken: address().ownerToken, capability, operation, input }) },
    });
    return decodePacket(output.wireResponse).result;
  }
  async function complete(result, options) {
    if (!result.pending) return result.value;
    const { id } = await native.call(
      {
        workflow: asyncTarget,
        launch: { kind: 'in_process' },
        inputs: { wire_request: encodePacket({ ownerToken: address().ownerToken, operationToken: result.pending }) },
      },
      options,
    );
    let ended;
    try {
      ended = await native.wait({ id }, options);
    } catch (error) {
      ended = await native.kill({ id, workflow: asyncTarget });
      throw error;
    } finally {
      if (ended) resources.release(id);
    }
    if (ended.state !== 'succeeded') {
      const error = new Error(ended.error?.message ?? '酒馆测试操作失败');
      Object.assign(error, ended.error);
      throw error;
    }
    return decodePacket(ended.outputs.wireResponse).result;
  }
  function completePublic(value, options) {
    const resource = value.pending ? takePending(value.pending) : undefined;
    // 公开等待的取消只停止该IO的等待/信号，不强杀仍需执行确认尾段的独立流程。
    // 实际流程继续由官方Call/Wait执行，并由实例资源管理等待其真实终态。
    const actual = complete(value);
    actual.catch(() => {});
    if (resource && options?.signal) {
      const abort = () => resource.controller.abort(options.signal.reason);
      options.signal.addEventListener('abort', abort, { once: true });
      if (options.signal.aborted) abort();
      const remove = () => options.signal.removeEventListener('abort', abort);
      resource.promise.then(remove, remove);
    }
    return resource?.promise ?? actual;
  }
  const result = {};
  for (const cap of declaration.capabilities) {
    result[cap.capability] ??= {};
    result[cap.capability][cap.operation] =
      cap.completion === 'suspend'
        ? async (input, options) => {
            options?.signal?.throwIfAborted();
            return await completePublic(prefix(cap.capability, cap.operation, input), options);
          }
        : input => {
            const value = prefix(cap.capability, cap.operation, input);
            if (value.pending) throw new Error('即时测试操作返回了等待编号。');
            return value.value;
          };
  }
  result['vibeflow.port'] = {
    async receive(request, options) {
      native.send({ id: address().runtimeId, port: 'era.service.pull', payload: encodePacket({ kind: 'pull' }) });
      const message = await native.receive(request, options);
      return decodePacket(message.payload);
    },
    send({ port, value }) {
      return native.send({ id: address().runtimeId, port, payload: encodePacket({ value }) });
    },
  };
  return result;
}

/** 同页公开调用的夹具入口：函数和Signal作为本地资源保留，通信中只传帧编号。 */
export function localResourceClient(session) {
  /** @type {Record<string, Record<string, (...args: any[]) => any>>} */
  const result = {};
  for (const cap of declaration.capabilities) {
    result[cap.capability] ??= {};
    const prefix = (input, options) =>
      session.dispatch.sync({
        session,
        origin: 'presentation',
        action: 'capability',
        family: cap.family,
        operation: cap.operation,
        input,
        options,
      });
    result[cap.capability][cap.operation] =
      cap.completion === 'suspend'
        ? async (input, options) => {
            const frame = prefix(input, options);
            if (!frame.publicPromise) return frame.result;
            const actual = session.dispatch.async(frame);
            actual.catch(error => (frame.operationResource ?? frame.modelResource)?.completion.reject(error));
            return frame.publicPromise ?? actual.then(value => value.result);
          }
        : (input, options) => prefix(input, options).result;
  }
  return result;
}
