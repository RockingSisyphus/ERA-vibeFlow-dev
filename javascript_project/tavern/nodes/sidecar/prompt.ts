import {takeFrame, emit} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";
import {dispatchUi} from "../../base_lib/resources.ts";
import {assertCurrentMessageBasis, assertExpectedSidecarPointer} from "../../base_lib/messages/target.ts";
export function CreateId(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={sidecarId:`era_chat_${(f.session.api.crypto??globalThis.crypto).randomUUID()}`};return emit({frame:f},params);}
export function PresentPrompt(inputs:any,params:any):any {
  const f=takeFrame(inputs);if(!record(f.input.prompt))throw new TypeError("ERA Sidecar 弹窗缺少 prompt。");
  dispatchUi(f.session.api,"era-sidecar-binding-prompt",structuredClone(f.input.prompt));f.result={status:"presented"};return emit({frame:f},params);
}
export function ClearPrompt(inputs:any,params:any):any {
  const f=takeFrame(inputs);if(f.input.sourceBasis!==undefined)assertCurrentMessageBasis(f.session.api, f.input.sourceBasis, f.session);assertExpectedSidecarPointer(f.session.api,f.input);
  dispatchUi(f.session.api,"era-sidecar-binding-prompt",null);f.result={status:"cleared"};return emit({frame:f},params);
}
