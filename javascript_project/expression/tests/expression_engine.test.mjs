import assert from "node:assert/strict";
import test from "node:test";

import { executeExpressionLayer } from "../generated/test/expression_engine.mjs";

function run(input) {
  return executeExpressionLayer({
    functionLibrary: {},
    initialState: {},
    operations: [],
    ...input
  });
}

function codes(result) {
  return result.diagnostics.map((item) => item.code);
}

test("按出现顺序读取已经更新的变量状态，并压缩为起始快照表达式", () => {
  const result = run({
    functionLibrary: {
      f: { params: ["x"], expr: "x+1" },
      g: { params: ["x"], expr: "f(x)*2" }
    },
    initialState: { a: 10, b: 0 },
    operations: [
      { path: "a", expr: "a+1" },
      { path: "b", expr: "g(a)" },
      { path: "a", expr: "a+1" }
    ]
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.finalState, { a: 12, b: 24 });
  assert.deepEqual(result.compressed, {
    a: { $expr: "@a + 2" },
    b: { $expr: "g(@a + 1)" }
  });
});

test("指数遵循标准数学优先级，并保持右结合与负指数", () => {
  const result = run({
    initialState: { unaryPower: 0, grouped: 0, negativeExponent: 0, chain: 0 },
    operations: [
      { path: "unaryPower", expr: "-2^2" },
      { path: "grouped", expr: "(-2)^2" },
      { path: "negativeExponent", expr: "2^-2" },
      { path: "chain", expr: "2^3^2" }
    ]
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.finalState, {
    unaryPower: -4,
    grouped: 4,
    negativeExponent: 0.25,
    chain: 512
  });
});

test("压缩合并同一路径连续加减的常数", () => {
  const result = run({
    initialState: { a: 7 },
    operations: [{ path: "a", expr: "a+1+2-3+4" }]
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.finalState, { a: 11 });
  assert.deepEqual(result.compressed, { a: { $expr: "@a + 4" } });
});

test("支持前向声明、函数体嵌套调用和调用实参嵌套", () => {
  const result = run({
    functionLibrary: {
      f: { params: ["x", "y"], expr: "g(x)+h(y)" },
      h: { params: ["value"], expr: "value+3" },
      g: { params: ["value"], expr: "value*2" },
      combo: { params: ["x", "y"], expr: "f(g(x),h(y))" }
    },
    initialState: { a: 2, b: 5, answer: 0 },
    operations: [{ path: "answer", expr: "combo(a,b)" }]
  });
  assert.equal(result.status, "ok");
  assert.equal(result.finalState.answer, 19);
  assert.equal(result.diagnostics.length, 0);
});

test("拒绝直接与间接递归", () => {
  const direct = run({
    functionLibrary: { f: { params: ["x"], expr: "f(x)" } },
    initialState: { value: 1 },
    operations: [{ path: "value", expr: "f(value)" }]
  });
  assert.ok(codes(direct).includes("ERA_EXPR_FUNCTION_RECURSION"));
  assert.equal(direct.finalState.value, 1);

  const indirect = run({
    functionLibrary: {
      f: { params: ["x"], expr: "g(x)" },
      g: { params: ["x"], expr: "f(x)" }
    },
    initialState: { value: 1 },
    operations: [{ path: "value", expr: "f(value)" }]
  });
  assert.ok(codes(indirect).includes("ERA_EXPR_FUNCTION_RECURSION"));
  assert.equal(indirect.finalState.value, 1);
});

test("函数体只能读取形参，未知外部状态不会被捕获", () => {
  const result = run({
    functionLibrary: { f: { params: ["x"], expr: "x+outside" } },
    initialState: { outside: 4, value: 1 },
    operations: [{ path: "value", expr: "f(value)" }]
  });
  assert.ok(codes(result).includes("ERA_EXPR_FUNCTION_IMPURE"));
  assert.equal(result.finalState.value, 1);
});

test("函数定义诊断只记录一次", () => {
  const result = run({
    functionLibrary: { sin: { params: ["x"], expr: "x" } },
    initialState: { value: 1 },
    operations: [{ path: "value", expr: "sin(value)" }]
  });
  assert.deepEqual(codes(result), ["ERA_EXPR_FUNCTION_NAME_CONFLICT"]);
});

test("函数元数据不进入表达式编译或计算", () => {
  const result = run({
    functionLibrary: {
      f: {
        params: ["x"],
        expr: "x*2",
        $meta: { updatable: false, necessary: "all", note: "service-owned" }
      }
    },
    initialState: { value: 3, result: 0 },
    operations: [{ path: "result", expr: "f(value)" }]
  });
  assert.equal(result.status, "ok");
  assert.equal(result.finalState.result, 6);
  assert.deepEqual(result.diagnostics, []);
});

test("支持原生数学、Gamma、阶乘、任意正阶导数和确定性积分", () => {
  const result = run({
    functionLibrary: {
      poly: { params: ["x"], expr: "x^7" },
      square: { params: ["x"], expr: "x^2" }
    },
    initialState: {
      gammaValue: 0,
      factorialValue: 0,
      trig: 0,
      derivativeValue: 0,
      integralValue: 0
    },
    operations: [
      { path: "gammaValue", expr: "gamma(5)" },
      { path: "factorialValue", expr: "factorial(5)" },
      { path: "trig", expr: "sin(0)+cos(0)+sqrt(9)" },
      { path: "derivativeValue", expr: "derivative(poly,2,5)" },
      { path: "integralValue", expr: "integral(square,0,3)" }
    ]
  });
  assert.equal(result.status, "ok");
  assert.equal(result.finalState.gammaValue, 24);
  assert.equal(result.finalState.factorialValue, 120);
  assert.equal(result.finalState.trig, 4);
  assert.equal(result.finalState.derivativeValue, 10080);
  assert.ok(Math.abs(result.finalState.integralValue - 9) < 1e-8);
});

test("原始用户表达式禁止 @ 快照，但无效操作不会影响合法同层操作", () => {
  const result = run({
    initialState: { a: 1, b: 2 },
    operations: [
      { path: "a", expr: "@a+1" },
      { path: "b", expr: "b+3" }
    ]
  });
  assert.equal(result.finalState.a, 1);
  assert.equal(result.finalState.b, 5);
  assert.deepEqual(codes(result), ["ERA_EXPR_SNAPSHOT_FORBIDDEN"]);
});

test("@f 调用层起始函数库，且其嵌套闭包不受当前函数编辑影响", () => {
  const result = run({
    allowSnapshots: true,
    functionLibrary: {
      f: { params: ["x"], expr: "g(x)+10" },
      g: { params: ["x"], expr: "x*3" }
    },
    snapshotFunctionLibrary: {
      f: { params: ["x"], expr: "g(x)+1" },
      g: { params: ["x"], expr: "x*2" }
    },
    initialState: { a: 3, snapshotValue: 0, currentValue: 0 },
    operations: [
      { path: "snapshotValue", expr: "@f(a)" },
      { path: "currentValue", expr: "f(a)" }
    ]
  });
  assert.equal(result.status, "ok");
  assert.equal(result.finalState.snapshotValue, 7);
  assert.equal(result.finalState.currentValue, 19);
});

test("@ 只能用于调用自定义函数，不能调用内建函数", () => {
  const result = run({
    allowSnapshots: true,
    initialState: { value: 1 },
    operations: [{ path: "value", expr: "@sin(0)" }]
  });
  assert.equal(result.finalState.value, 1);
  assert.ok(codes(result).includes("ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED"));
});

test("函数参数错误、非有限数和不存在变量均保持操作前状态", () => {
  const result = run({
    functionLibrary: { f: { params: ["x"], expr: "x+1" } },
    initialState: { a: 3, b: 4, c: 5 },
    operations: [
      { path: "a", expr: "f(1,2)" },
      { path: "b", expr: "1/0" },
      { path: "c", expr: "missing+1" }
    ]
  });
  assert.deepEqual(result.finalState, { a: 3, b: 4, c: 5 });
  assert.ok(codes(result).includes("ERA_EXPR_FUNCTION_ARITY"));
  assert.ok(codes(result).includes("ERA_EXPR_RESULT_NON_FINITE"));
  assert.ok(codes(result).includes("ERA_EXPR_REFERENCE_NON_NUMERIC"));
});

test("保留可迁移的旧项目基础与嵌套函数使用方式", () => {
  const result = run({
    functionLibrary: {
      area: { params: ["r"], expr: "pi(r)*r" },
      pi: { params: ["r"], expr: "3.141592653589793*r" },
      scaledArea: { params: ["r", "scale"], expr: "area(r)*scale" }
    },
    initialState: { radius: 2, scale: 0.5, result: 0 },
    operations: [{ path: "result", expr: "scaledArea(radius,scale)" }]
  });
  assert.equal(result.status, "ok");
  assert.ok(Math.abs(result.finalState.result - 6.283185307179586) < 1e-12);
});
