import {encodePacket,decodePacket} from "../../../../base_lib/workflow_values/codec.mjs";
export function Decode(inputs,params,context){const wire=decodePacket(inputs["era.workflow.packet"].value);const value=inputs["era.workflow.host_resources"].value.restore({wire,mode:params.mode,boundary:params.boundary});return {frame:value,protocol_resources:inputs["era.workflow.host_resources"].value,entry_return:/** @type {"protocol"} */ ("protocol")};}
export function Encode(inputs,params,context){const value=(inputs["era.tavern.call.result"]??inputs["era.tavern.read_group.reply"]).value;return {packet:encodePacket((inputs["era.tavern.return_resources"] ?? inputs["era.workflow.host_resources"]).value.project({value,mode:params.mode,boundary:params.boundary}))};}

export function DecodeGroup(inputs,params,context){const wire=decodePacket(inputs["era.workflow.packet"].value);return {read_group:inputs["era.workflow.host_resources"].value.restore({wire,mode:params.mode,boundary:params.boundary})};}

export function PrepareRuntimeRequest(inputs) {
  return { ...PrepareDirectRequest(inputs), direct_return_resources: inputs["era.workflow.host_resources"].value, direct_host_resources: inputs["era.workflow.host_resources"].value };
}

export function PrepareDirectRequest(inputs) {
  return { direct_return_resources: {}, prepared_request: inputs["era.tavern.call.frame"].value, entry_return: /** @type {"direct"} */ ("direct") };
}

export function SelectEntryReturn(inputs) {
  return { return_route: inputs["era.workflow.entry_return"].value, selected_return_resources: inputs["era.tavern.return_resources"].value };
}
