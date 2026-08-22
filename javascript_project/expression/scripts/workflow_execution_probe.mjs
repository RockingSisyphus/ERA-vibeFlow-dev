import assert from "node:assert/strict";

import { runWorkflow as runNode } from "../generated/node-release/workflow.js";
import { runWorkflow as runBrowser } from "../generated/browser-release/workflow.js";

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

const node = runNode(input).expressionResponse;
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
    finalState: node.finalState,
    compressed: node.compressed
  })
);
