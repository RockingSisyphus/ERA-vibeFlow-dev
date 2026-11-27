import {encodePacket,decodePacket} from "../../../../base_lib/workflow_values/codec.mjs";
export function EncodeRequest(inputs){return {wire_inputs:{wire_request:encodePacket(inputs["era.workflow.inputs"].value)}};}
export function DecodeOutputs(inputs){const value=inputs["era.workflow.wire_outputs"].value;return {outputs:value.workflowFailure!==undefined?{workflowFailure:value.workflowFailure}:decodePacket(value.wireResponse)};}
