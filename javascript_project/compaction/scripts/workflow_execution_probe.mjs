/** 验证已构建的两种公开入口，避免重复编译和绑定内部节点名称。 */
import assert from "node:assert/strict";
import * as node from "../generated/release/node.js";
import * as browser from "../generated/release/browser.js";
  const input = { compaction_request: { content: "<VariableEdit>{\"a\":{\"$expr\":\"a+1\"}}</VariableEdit><VariableEdit>{\"b\":{\"$expr\":\"a*2\"}}</VariableEdit>", initialStatData: { a: 2, b: 0 } } };
  const nodeResponse = node.runWorkflow(input).compactionResponse;
  const browserResponse = browser.runWorkflow(input).compactionResponse;
  assert.deepEqual(browserResponse, nodeResponse);
  assert.deepEqual(nodeResponse.finalStatData, { a: 3, b: 6 });
  assert.match(nodeResponse.content, /@a \+ 1/u);
  console.log(JSON.stringify({ status: "PASS", result: nodeResponse, targets: ["node", "browser"] }));
