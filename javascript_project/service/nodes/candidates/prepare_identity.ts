import { retainNativeWork, nativeCandidateRecovery } from '../../base_lib/working_state.ts';

/** 准备消息身份及待写正文；保存动作交给与变量提交共用的流程。 */
export function* runProgress(inputs: any): Generator<any, any, any> {
  const step = inputs['era.step.request.routed'].value;
  const prepared = step.dispatchContext;
  if (prepared.status !== 'ready') return {mk_save_request: {mode: 'settled', result: {
    step, status: 'failed', confirmedMessageWrites: 0, variablesCommitted: false, failure: prepared.failure,
  }}};
  const sidecar = 'era.tavern.sidecar';
  let working = (yield {kind: 'resource', capability: sidecar, operation: 'read_working', input: {}}).working;
  if (!working) return {mk_save_request: {mode: 'settled', result: {
    step, status: 'failed', confirmedMessageWrites: 0, variablesCommitted: false,
    failure: {code: 'ERA_WORKING_STATE_MISSING', message: '当前聊天变量尚未就绪。', category: 'domain', retryable: false},
  }}};
  const recovery = nativeCandidateRecovery(working, prepared.sourceBasis);
  if (recovery) working = (yield {kind: 'resource', capability: sidecar, operation: 'write_working', input: {...recovery, expectedVersion: working.version}}).working;
  // 派发准备已将仍匹配宿主消息的待写正文和本次标记合并成同一份写入计划。
  const messageWrites = prepared.stagedMessageUpdates;
  const meta = structuredClone(working.record.state.eraMeta);
  const selected = [...(meta.SelectedMks ?? [])];
  let identityChanged=false;
  if (prepared.processingMessage && prepared.processingMk) {
    while (selected.length <= prepared.processingMessage.messageId) selected.push(null);
    identityChanged=selected[prepared.processingMessage.messageId]!==prepared.processingMk;
    selected[prepared.processingMessage.messageId] = prepared.processingMk;
    meta.SelectedMks = selected;
  }
  if(!messageWrites.length&&!identityChanged&&!working.dirty) return {mk_save_request:{mode:'settled',result:{
    step,status:'no-op',floorIdentity:prepared.floorIdentity,confirmedMessageWrites:0,variablesCommitted:false,failure:null,
  }}};
  const nativeCandidate = retainNativeWork(working, prepared.sourceBasis, messageWrites);
  if (nativeCandidate) yield {kind: 'resource', capability: sidecar, operation: 'write_working', input: {
    ...working, expectedVersion: working.version, nativeCandidate,
  }};
  return {mk_save_request: {mode: 'commit', request: {
    schemaVersion: 2, step, identityOnly: true, plan: null, payload: null, messageWrites,
    sourceBasis: prepared.sourceBasis, stat: working.record.state.statData,
    statFunc: working.record.state.statFunc, meta,
    floorIdentity: prepared.floorIdentity, agentFloorCandidate: null, initialPresentation: null,
  }}};
}
