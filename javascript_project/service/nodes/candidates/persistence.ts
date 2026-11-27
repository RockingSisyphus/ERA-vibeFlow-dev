/** 只检查本批真正写回的消息；空任务沿原保存链交回，不扩大到整个聊天。 */
export function Plan(inputs: any): any {
  const envelope = inputs['era.tavern.commit.request'].value;
  let route = 'write';
  if (envelope.mode === 'commit') {
    const request = envelope.request;
    for (const write of request.messageWrites) {
      const source = request.sourceBasis.messages.find((message: any) => message.messageId === write.messageId);
      if (!source || !source.candidate.exists && source.candidate.phase === 'cancelled') { route = 'invalid'; break; }
      if (!source.candidate.exists || source.candidate.phase === 'generating') route = 'defer';
    }
  }
  return {candidate_save_request: envelope, candidate_write_route: route};
}

/** 操作和有序正文已由工作状态节点保存，此处只明确交回未持久化的事实。 */
export function Retain(inputs: any): any {
  const envelope = inputs['era.tavern.commit.request'].value;
  return {pending_candidate_result: {...envelope.request, status: 'deferred', confirmedMessageWrites: 0, variablesCommitted: false, failure: null}};
}

/** 不覆盖宿主；既有来源变化结算会将真实历史交回同步器。 */
export function Invalid(inputs: any): any {
  const envelope = inputs['era.tavern.commit.request'].value;
  return {invalid_candidate_result: {...envelope.request, status: 'no-op', confirmedMessageWrites: 0, variablesCommitted: false,
    sourceChanged: true, failure: null}};
}

export function IdentityResult(inputs: any): any {
  const result = inputs['era.tavern.commit.result'].value;
  return {prepared_mk_outcome: {
    schemaVersion: 1, step: result.step, status: result.status,
    mk: result.floorIdentity?.mk ?? null,
    messageChanged: result.confirmedMessageWrites > 0, variablesChanged: result.variablesCommitted === true,
    failure: result.failure ?? null,
  }};
}
