import assert from "node:assert/strict";
import test from "node:test";

import { compactCommandLayer } from "../generated/test/command_compaction_engine.mjs";

function run(content, initialStatData, initialStatFunc = {}) {
  return compactCommandLayer({ content, initialStatData, initialStatFunc });
}

function runRandom(content, initialStatData, initialStatFunc = {}) {
  return compactCommandLayer({
    content,
    initialStatData,
    initialStatFunc,
    randomContext: { sourceKey: "compact-random", drawOffset: 0 }
  });
}

test("跨变量表达式保留层起始快照依赖", () => {
  const result = run(
    `<VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit>\n<VariableEdit>{"b":{"$expr":"a*2"}}</VariableEdit>\n<VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit>`,
    { a: 10, b: 0 },
  );
  assert.equal(result.status, "compacted");
  assert.deepEqual(result.finalStatData, { a: 12, b: 22 });
  assert.match(result.content, /"a":\{"\$expr":"@a \+ 2"\}/u);
  assert.match(result.content, /"b":\{"\$expr":"\(@a \+ 1\) \* 2"\}/u);
  assert.doesNotMatch(result.content, /@b \+ 22/u);
});

test("严格 Insert 的对象/原子形状冲突不合并", () => {
  const content = `<VariableInsert>{"a":1}</VariableInsert><VariableInsert>{"a":{"x":2}}</VariableInsert>`;
  const result = run(content, { a: {} });
  assert.equal(result.status, "unchanged");
  assert.equal(result.content, content);
  assert.deepEqual(result.finalStatData, { a: { x: 2 } });
});

test("直接数值 Edit 合并为直接末值，避免把类型覆盖变成数值表达式", () => {
  const result = run(
    `<VariableEdit>{"a":10}</VariableEdit><VariableEdit>{"a":11}</VariableEdit><VariableEdit>{"a":12}</VariableEdit>`,
    { a: 1 },
  );
  assert.equal(result.status, "compacted");
  assert.match(result.content, /"a":12/u);
  assert.doesNotMatch(result.content, /"\$expr":"12"/u);
  assert.deepEqual(result.finalStatData, { a: 12 });
});

test("函数事务与 meta 均保留为不可跨越屏障", () => {
  const result = run(
    `<FunctionInsert>{"f":{"params":["x"],"expr":"x+1","$meta":{"updatable":false}}}</FunctionInsert><FunctionEdit>{"f":{"params":["x"],"expr":"x+2"}}</FunctionEdit>`,
    {},
  );
  assert.equal(result.status, "unchanged");
  assert.equal(result.finalStatFunc.f.expr, "x+1");
  assert.equal(result.finalStatFunc.f.$meta.updatable, false);
});

test("单个 FunctionInsert 标签的任何定义无效时，整标签不提交", () => {
  const result = run(
    `<FunctionInsert>{"good":{"params":["x"],"expr":"x+1"},"bad":{"params":["x"],"expr":"bad(x)"}}</FunctionInsert>`,
    {},
  );
  assert.deepEqual(result.finalStatFunc, {});
  assert.equal(result.diagnostics[0]?.code, "ERA_EXPR_FUNCTION_RECURSION");
});

test("函数快照使用层起始函数库而普通调用使用当前位置函数库", () => {
  const result = run(
    `<FunctionEdit>{"f":{"params":["x"],"expr":"x*2"}}</FunctionEdit><VariableEdit>{"a":{"$expr":"@f(x)"},"b":{"$expr":"f(x)"}}</VariableEdit>`,
    { x: 3, a: 0, b: 0 },
    { f: { params: ["x"], expr: "x+1" } },
  );
  assert.deepEqual(result.finalStatData, { x: 3, a: 4, b: 6 });
});

test("无效标签不修改消息且报告诊断", () => {
  const result = run(`<VariableEdit>{not-json}</VariableEdit>`, { a: 1 });
  assert.equal(result.status, "invalid");
  assert.equal(result.content, `<VariableEdit>{not-json}</VariableEdit>`);
  assert.equal(result.diagnostics[0].code, "ERA_COMPACT_COMMAND_JSON_INVALID");
});

test("相邻同 scope 事务合并为一个 wrapper 并保留快照依赖", () => {
  const result = run(
    `<era_tx s="m"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>\n` +
      `<era_tx s="m"><VariableEdit>{"b":{"$expr":"a*2"}}</VariableEdit></era_tx>\n` +
      `<era_tx s="m"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>`,
    { a: 10, b: 0 },
  );
  assert.equal(result.status, "compacted");
  assert.equal((result.content.match(/<era_tx s="m">/gu) ?? []).length, 1);
  assert.match(result.content, /"a":\{"\$expr":"@a \+ 2"\}/u);
  assert.match(result.content, /"b":\{"\$expr":"\(@a \+ 1\) \* 2"\}/u);
  assert.deepEqual(result.finalStatData, { a: 12, b: 22 });
});

test("不同 scope 是硬边界且相同 scope 不跨越合并", () => {
  const original =
    `<era_tx s="m"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>` +
    `<era_tx s="m"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>` +
    `<era_tx s="a"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>` +
    `<era_tx s="m"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>`;
  const result = run(original, { a: 0 });
  assert.equal((result.content.match(/<era_tx s="m">/gu) ?? []).length, 2);
  assert.equal((result.content.match(/<era_tx s="a">/gu) ?? []).length, 1);
  assert.doesNotMatch(result.content, /s="m,a"|s="m,b"/u);
  assert.deepEqual(result.finalStatData, { a: 4 });
});

test("普通正文阻止相同 scope 跨段合并", () => {
  const original =
    `<era_tx s="b"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>` +
    `正文边界` +
    `<era_tx s="b"><VariableEdit>{"a":{"$expr":"a+1"}}</VariableEdit></era_tx>`;
  const result = run(original, { a: 1 });
  assert.equal(result.content, original);
  assert.deepEqual(result.finalStatData, { a: 3 });
});

test("自动 random 是局部屏障，前后独立确定性区间仍各自压缩", () => {
  const randomCommand = `<VariableEdit>{"roll":{"$expr":"random()"}}</VariableEdit>`;
  const result = runRandom(
    `<VariableEdit>{"stable":{"$expr":"stable+1"}}</VariableEdit>` +
      `<VariableEdit>{"stable":{"$expr":"stable+1"}}</VariableEdit>` +
      randomCommand +
      `<VariableEdit>{"tail":{"$expr":"tail+1"}}</VariableEdit>` +
      `<VariableEdit>{"tail":{"$expr":"tail+1"}}</VariableEdit>`,
    { stable: 0, roll: 0, tail: 0 }
  );
  assert.equal(result.status, "partial");
  assert.match(result.content, /"stable":\{"\$expr":"@stable \+ 2"\}/u);
  assert.match(result.content, /"tail":\{"\$expr":"@tail \+ 2"\}/u);
  assert.ok(result.content.includes(randomCommand));
  assert.equal((result.content.match(/random\(\)/gu) ?? []).length, 1);
  assert.deepEqual(result.finalStatData, {
    stable: 2,
    roll: 0.16960479729646394,
    tail: 2
  });
  assert.equal(result.nextRandomDrawOffset, 1);
});

test("通过 statFunc 间接调用自动 random 同样保留原命令", () => {
  const content =
    `<VariableEdit>{"before":{"$expr":"before+1"}}</VariableEdit>` +
    `<VariableEdit>{"before":{"$expr":"before+1"}}</VariableEdit>` +
    `<VariableEdit>{"roll":{"$expr":"dice(1,6)"}}</VariableEdit>`;
  const result = runRandom(
    content,
    { before: 0, roll: 0 },
    {
      dice: {
        params: ["min", "max"],
        expr: "floor(random()*(max-min+1))+min"
      }
    }
  );
  assert.equal(result.status, "partial");
  assert.match(result.content, /"before":\{"\$expr":"@before \+ 2"\}/u);
  assert.match(result.content, /"roll":\{"\$expr":"dice\(1,6\)"\}/u);
  assert.equal(result.finalStatData.roll, 2);
  assert.equal(result.nextRandomDrawOffset, 1);
});

test("完全显式 random(seed,draw) 可作为普通确定性表达式压缩", () => {
  const result = run(
    `<VariableEdit>{"value":{"$expr":"random(42,7)"}}</VariableEdit>` +
      `<VariableEdit>{"value":{"$expr":"value+1"}}</VariableEdit>`,
    { value: 0 }
  );
  assert.equal(result.status, "compacted");
  assert.equal((result.content.match(/<VariableEdit>/gu) ?? []).length, 1);
  assert.match(result.content, /random\(42, 7\) \+ 1/u);
  assert.equal(result.finalStatData.value, 1.5746334423763604);
  assert.equal(result.nextRandomDrawOffset, 0);
});

test("普通标签与 era_tx 之间共享同一消息随机抽取序号", () => {
  const content =
    `<VariableEdit>{"first":{"$expr":"random()"}}</VariableEdit>` +
    `<era_tx s="m"><VariableEdit>{"second":{"$expr":"random()"}}</VariableEdit></era_tx>` +
    `<era_tx s="m"><VariableEdit>{"third":{"$expr":"random()"}}</VariableEdit></era_tx>`;
  const result = runRandom(content, { first: 0, second: 0, third: 0 });
  assert.equal(result.content, content);
  assert.deepEqual(result.finalStatData, {
    first: 0.16960479729646394,
    second: 0.9561148643509833,
    third: 0.9098112177707088
  });
  assert.equal(result.nextRandomDrawOffset, 3);
});
