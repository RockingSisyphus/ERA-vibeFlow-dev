/** Helper真实消息页带有Date元数据；领域消息只保留当前候选及ERA阶段事实。 */
import assert from 'node:assert/strict';
import {agentMessage} from '../../../javascript_project/tavern/base_lib/agent/facts.ts';
import {encodePacket,decodePacket} from '../../../base_lib/workflow_values/codec.mjs';
const stage={status:'story-complete',cycleIndex:2,storyStart:10,storyEnd:20};
const raw={message_id:5,name:'Assistant',role:'assistant',is_hidden:false,swipe_id:1,
  swipes:['old story','current story'],swipes_info:[{}, {send_date:'2026-10-24',gen_started:new Date('2026-10-24T12:43:57.131Z'),gen_finished:new Date('2026-10-24T12:43:57.780Z'),extra:{era_agent:stage,otherExtension:{resource:new Map()}}}]};
assert.throws(()=>encodePacket(raw),/只接受普通对象和数组/);
const result=decodePacket(encodePacket({latestMessage:agentMessage(raw),messages:[agentMessage(raw)]}));
assert.equal(result.latestMessage.message,'current story');
assert.equal(result.latestMessage.swipe_id,1);
assert.deepEqual(result.latestMessage.extra,{era_agent:stage});
assert.deepEqual(result.messages[0],result.latestMessage);
assert.equal(Object.hasOwn(result.latestMessage.extra,'gen_started'),false);
assert.equal(raw.swipes_info[1].gen_started.getTime(),Date.parse('2026-10-24T12:43:57.131Z'));
assert.equal(raw.swipes[0],'old story');
assert.deepEqual(agentMessage({message_id:5,role:'assistant',message:'legacy fixture',extra:{era_agent:stage}}).extra,{era_agent:stage});
assert.equal(agentMessage({...raw,swipe_id:2}).message,'');
assert.equal(agentMessage(undefined),null);
console.log(JSON.stringify({status:'PASS',checks:['Helper dates remain local','current swipe preserved','ERA stage restored from Helper envelope','source unchanged','reserved next swipe stays empty']}));
