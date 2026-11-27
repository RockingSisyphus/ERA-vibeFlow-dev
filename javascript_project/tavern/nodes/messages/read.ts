import {takeFrame, emit} from "../../base_lib/frames.ts";
import {syncCall} from "../../base_lib/resources.ts";
import {readProjectedMessages} from "../../base_lib/messages/projection.ts";
import {assertMessageNotEditing} from "../../base_lib/messages/target.ts";
export function ReadContext(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  if (f.input.projection !== "era-active-message-v2") throw new TypeError("消息读取请求必须指定 projection=era-active-message-v2。");
  f.result = syncCall(f, () => {
    const range = typeof f.input.range === "string" || typeof f.input.range === "number" ? f.input.range : "0--1";
    if (Number.isSafeInteger(f.input.requireClosedEditorFor)) {
      assertMessageNotEditing(f.session.api, f.input.requireClosedEditorFor);
    }
    return {schemaVersion: 2, messages: readProjectedMessages(f.session.api, f.session, range)};
  });
  return emit({frame: f}, params);
}
