import {defineDataSchema} from "@vibeflow/plugin";

/** 候选保存流程的分支及显式通信进度合同。 */
export const nativeCandidatePersistenceRoute = defineDataSchema({
  type_key: "era.native_candidate.persistence.route", representation: "json",
  display_name: "原生候选保存选择",
  description: "主Service按实际目标候选事实选择写回、保留待写或结算失效；不代表新增公开API。",
  schema: {type: "string", enum: ["write", "defer", "invalid"]}
});

export const candidateIdentityState = defineDataSchema({"type_key": "era.communication.candidate_identity.state", "schema": {"type": "object"}});
export const candidateIdentityPending = defineDataSchema({"type_key": "era.communication.candidate_identity.state.pending", "schema": {"type": "object"}});
export const candidateIdentityReady = defineDataSchema({"type_key": "era.communication.candidate_identity.ready", "schema": {"type": "object"}});
export const candidateIdentityCompleted = defineDataSchema({"type_key": "era.communication.candidate_identity.completed", "schema": {"type": "object"}});
export const candidateIdentityRoute = defineDataSchema({"type_key": "era.communication.candidate_identity.route", "schema": {"type": "string"}});
export const candidateIdentityWaitRoute = defineDataSchema({"type_key": "era.communication.candidate_identity.wait_route", "schema": {"type": "string"}});
export const candidateIdentityDone = defineDataSchema({"type_key": "era.communication.candidate_identity.done", "schema": {"type": "boolean"}});
