import {encodePacket,decodePacket} from "../../../../base_lib/workflow_values/codec.mjs";
export function Decode(inputs){return {request:decodePacket(inputs["era.workflow.packet"].value).compaction_request,entry_return:/** @type {"protocol"} */ ("protocol")};}
export function Encode(inputs){return {packet:encodePacket({compactionResponse:inputs["era.command_compaction.response"].value})};}

export function PrepareDirectRequest(inputs) {
  return { prepared_request: inputs["era.command_compaction.request"].value, entry_return: /** @type {"direct"} */ ("direct") };
}

export function SelectEntryReturn(inputs) {
  return { return_route: inputs["era.workflow.entry_return"].value };
}
