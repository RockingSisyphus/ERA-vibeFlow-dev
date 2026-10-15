import {record, identity} from "../browser.ts";
export function runtimeIdentity(value: any): any {
  if (!record(value) || typeof value.characterId !== "string" && value.characterId !== null ||
    typeof value.groupId !== "string" && value.groupId !== null || typeof value.chatId !== "string")
    throw new TypeError("ERA Sidecar 运行时快照身份无效。");
  return {characterId: value.characterId, groupId: value.groupId, chatId: value.chatId};
}
export function currentIdentity(api: any): any {
  const actual = identity(api);
  if (typeof actual.characterId !== "string" && actual.characterId !== null || typeof actual.chatId !== "string" || actual.chatId.length === 0)
    throw new TypeError("ERA 无法读取当前角色卡或聊天身份。");
  return actual;
}
export function sidecarId(value: any): string {
  if (typeof value !== "string" || !/^era_chat_[a-z0-9-]{8,80}$/iu.test(value)) throw new TypeError("ERA SidecarId 无效。");
  return value;
}
export function fileName(id: string): string { return `era-sidecar-v1-${id}.json`; }
export function filePath(id: string): string { return `/user/files/${encodeURIComponent(fileName(id))}`; }
export function workingKey(value: any): string { return JSON.stringify([value.characterId, value.groupId, value.chatId]); }
export function sameIdentity(left: any, right: any): boolean { return workingKey(left) === workingKey(right); }
/** 只验证并投影 Service 给出的记录，不发布、不选择归属路线。 */
export function snapshotFacts(input: any): any {
  const id = sidecarId(input.sidecarId);
  if (!record(input.snapshot)) throw new TypeError("ERA Sidecar 运行时发布缺少 snapshot。");
  const snapshot = input.snapshot, owner = runtimeIdentity(snapshot.owner), state = snapshot.state;
  if (!Number.isSafeInteger(snapshot.revision) || !record(state) || !record(state.eraMeta) || !record(state.statFunc) || !Object.hasOwn(state,"statData"))
    throw new TypeError("ERA Sidecar 提交后的快照无效。");
  return {sidecarId: id, identity: owner, revision: snapshot.revision, statData: structuredClone(state.statData),
    statFunc: structuredClone(state.statFunc), eraMeta: structuredClone(state.eraMeta)};
}
