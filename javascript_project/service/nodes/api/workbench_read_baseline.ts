import { unescapeEraData } from '../../base_lib/domain/snapshot_query.ts';
import { inspectSidecar, sidecarIdFromVariables } from '../../base_lib/sidecar_binding.ts';
import { isRecord, jsonEqual } from '../../base_lib/domain/workbench_operations.js';
import { workbenchError, type Baseline, type Inspected } from '../../base_lib/domain/workbench_context.ts';
interface Context {
  capabilities: {
    'era.tavern.sidecar': { read_current(input: object): Promise<unknown>; read_record(input: object): Promise<unknown> };
    'era.tavern.identity': { read(input: object): unknown };
  };
}
/** 只读取既有绑定和 V3 文件；异步读取前后核对窗口，绝不触发绑定或迁移。 */
export async function run(inputs: any, _params: unknown, context: Context): Promise<any> {
  const inspected = inputs['era.api.commit.inspected'].value as Inspected;
  const baseline: Baseline = { inspected, current: null, record: null, error: null };
  try {
    const sidecar = context.capabilities['era.tavern.sidecar'];
    const current = await sidecar.read_current({});
    if (!isRecord(current)) throw new Error('当前 Sidecar 绑定不可用。');
    baseline.current = current;
    const { sidecarId } = sidecarIdFromVariables({ ERAMetaData: current.meta });
    if (!sidecarId) throw new Error('当前聊天尚未绑定 Sidecar。');
    const raw = await sidecar.read_record({ sidecarId });
    const after = await sidecar.read_current({});
    const identity = context.capabilities['era.tavern.identity'].read({ purpose: 'workbench-baseline' });
    if (!isRecord(after) || !isRecord(identity) || !jsonEqual(current.identity, after.identity) || !jsonEqual(current.meta, after.meta) ||
      ['characterId', 'groupId', 'chatId', 'lifecycleToken'].some(key => identity[key] !== inspected.identity[key]) ||
      inspected.request.detail.windowToken !== identity.lifecycleToken) throw new Error('读取草稿基准期间聊天或生命周期窗口已经变化。');
    const facts = inspectSidecar(after, raw);
    if (facts.status !== 'matched' || !facts.record) throw new Error(`Sidecar 尚未就绪：${facts.reason}`);
    baseline.record = { ...facts.record, state: { ...facts.record.state, statData: unescapeEraData(facts.record.state.statData) } };
  } catch (reason) { baseline.error = workbenchError(reason); }
  return { baseline };
}
