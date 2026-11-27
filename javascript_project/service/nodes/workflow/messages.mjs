import {decodePacket} from "../../../../base_lib/workflow_values/codec.mjs";
const address=inputs=>inputs["era.workflow.host_resources"].value.metadata();
export function PreparePull(inputs,_params,context){return {send_request:{id:address(inputs).runtimeId,port:"era.service.pull",payload:{kind:"pull"}}};}
export function DecodeEvent(inputs,_params,context){const message=inputs["vibeflow.workflow.receive.result"].value;if(message.sender!==address(inputs).runtimeId||message.port!=="era.service.in")throw new TypeError("事件不是本实例酒馆发送的。");return {transport_event_raw:decodePacket(message.payload).value};}
export function PrepareBatch(inputs,_params,context){return {send_request:{id:address(inputs).runtimeId,port:"era.service.out",payload:{value:inputs["era.batch.result"].value}}};}
export function PrepareControl(inputs,_params,context){return {send_request:{id:address(inputs).runtimeId,port:"era.service.out",payload:{value:inputs["era.collection.control"].value}}};}
