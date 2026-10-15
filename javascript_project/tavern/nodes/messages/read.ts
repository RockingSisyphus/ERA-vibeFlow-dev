import {takeFrame, emit} from "../../base_lib/frames.ts";
import {syncCall} from "../../base_lib/resources.ts";
import {projectMessage} from "../../base_lib/messages/projection.ts";
export function ReadContext(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.input.projection !== "era-active-message-v1") throw new TypeError("消息读取请求必须指定 projection=era-active-message-v1。");
  f.result = syncCall(f, () => {
    const range = typeof f.input.range === "string" || typeof f.input.range === "number" ? f.input.range : "0--1";
    const raw = f.session.api.getChatMessages(range, {include_swipes: true});
    if (!Array.isArray(raw)) throw new TypeError("ERA 消息投影失败：Tavern 返回值不是数组。");
    return {schemaVersion: 2, messages: raw.map(projectMessage)};
  });
  return emit({frame: f}, params);
}
