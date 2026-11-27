import {encodePacket,decodePacket} from "../../../../base_lib/workflow_values/codec.mjs";
export function EncodeMessage(inputs){const request=inputs["vibeflow.workflow.send.request"].value;return {wire_message:{...request,payload:encodePacket(request.payload)}};}

export function EncodeRequest(inputs){return {wire_inputs:{wire_request:encodePacket(inputs["era.workflow.inputs"].value)}};}

export function DecodeOutputs(inputs){const value=inputs["era.workflow.wire_outputs"].value;return {outputs:value.workflowFailure!==undefined?{workflowFailure:value.workflowFailure}:decodePacket(value.wireResponse)};}

export function DecodeTerminal(inputs){const terminal=inputs["era.workflow.terminal"].value;return {decoded_terminal:terminal.state==="succeeded"?{...terminal,outputs:decodePacket(terminal.outputs.wireResponse)}:terminal};}

export function EncodeWaitRequest(inputs){return {wire_wait_inputs:{wire_request:encodePacket(inputs["era.workflow.inputs"].value)}};}

export function EncodeEndPull(inputs){const request=inputs["vibeflow.workflow.send.request"].value;return {wire_end_pull:{...request,payload:encodePacket(request.payload)}};}
