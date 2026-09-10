import assert from "node:assert/strict";

import { runWorkflow as runNode } from "../generated/release/node.js";
import { runWorkflow as runBrowser } from "../generated/release/browser.js";

const input = {
  expression_request: {
    functionLibrary: {
      increment: { params: ["x"], expr: "x+1" },
      twice: { params: ["x"], expr: "increment(x)*2" },
      mix: { params: ["x", "y"], expr: "twice(x)+increment(y)" }
    },
    initialState: { a: 4, b: 3, answer: 0 },
    operations: [
      { path: "a", expr: "a+1" },
      { path: "answer", expr: "mix(a,b)" },
      { path: "a", expr: "a+1" }
    ]
  }
};

const trace = [];
const result = runNode(input, { trace: "full", onTrace: event => trace.push(event) });
assert.equal(typeof result?.then, "undefined");
assert.equal(trace.filter(event => event.kind === "node_start" && event.nodeId === "evaluate_ast").length, input.expression_request.operations.length);
assert.ok(!trace.some(event => event.nodeId === "ast_frame_loop"));
const node = result.expressionResponse;
const browser = runBrowser(input).expressionResponse;
assert.deepEqual(browser, node);
assert.deepEqual(node.finalState, { a: 6, b: 3, answer: 16 });
assert.deepEqual(node.compressed, {
  a: { $expr: "@a + 2" },
  answer: { $expr: "mix(@a + 1, @b)" }
});
console.log(
  JSON.stringify({
    status: "PASS",
    nodePaths: [...new Set(trace.filter(event => event.kind === "node_start").map(event => event.nodePath))],
    finalState: node.finalState,
    compressed: node.compressed
  })
);
