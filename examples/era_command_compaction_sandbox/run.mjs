import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const compactionRoot = path.join(root, "javascript_project/compaction");

function command(file, args, options = {}) {
  try { execFileSync(file, args, { cwd: root, stdio: "pipe", encoding: "utf8", ...options }); }
  catch (error) { throw new Error(`${file} ${args.join(" ")} failed.\n${[error.stdout, error.stderr].filter(Boolean).join("\n")}`); }
}

function comparable(value) { return JSON.parse(JSON.stringify(value)); }

function replay(engine, request, content) {
  return engine.compactCommandLayer({ ...request, content });
}

function withState(request, state) { return { ...request, initialStatData: state }; }

function checkEquivalent(engine, original, compacted, request, label) {
  const replayed = replay(engine, request, compacted.content);
  assert.deepEqual(comparable(replayed.finalStatData), comparable(original.finalStatData), `${label}: stat replay`);
  assert.deepEqual(comparable(replayed.finalStatFunc), comparable(original.finalStatFunc), `${label}: function replay`);
  assert.deepEqual(replayed.diagnostics.map(({ code, path }) => ({ code, path })), original.diagnostics.map(({ code, path }) => ({ code, path })), `${label}: diagnostics`);
}

async function entrypoints(temp) {
  await symlink(path.join(compactionRoot, "node_modules"), path.join(temp, "node_modules"), "dir");
  const esbuild = path.join(compactionRoot, "node_modules/.bin/esbuild");
  const direct = path.join(temp, "engine.mjs");
  command(esbuild, ["api/engine.ts", "--bundle", "--platform=node", "--format=esm", `--outfile=${direct}`], { cwd: compactionRoot });
  for (const target of ["node", "browser"]) command("python", ["run.py", "build", "--config", "javascript_project/compaction/configs/era.command_compaction.jsonc", "--target", target, "--profile", "esm-module", "--out-dir", path.join(temp, target)]);
  for (const target of ["node", "browser"]) command(esbuild, [
    path.join(temp, target, "workflow.js"),
    "--bundle",
    `--platform=${target}`,
    "--format=esm",
    `--outfile=${path.join(temp, `${target}-workflow.mjs`)}`,
  ], { cwd: compactionRoot });
  return {
    engine: await import(pathToFileURL(direct).href),
    node: await import(pathToFileURL(path.join(temp, "node-workflow.mjs")).href),
    browser: await import(pathToFileURL(path.join(temp, "browser-workflow.mjs")).href),
  };
}

const temp = await mkdtemp(path.join(os.tmpdir(), "era-command-compaction-sandbox-"));
try {
  const cases = [
    ...JSON.parse(await readFile(path.join(here, "cases/core.json"), "utf8")),
    ...JSON.parse(await readFile(path.join(here, "cases/random.json"), "utf8")),
  ];
  const { engine, node, browser } = await entrypoints(temp);
  for (const testCase of cases) {
    const direct = engine.compactCommandLayer(testCase.request);
    const nodeResponse = node.runWorkflow({ compaction_request: testCase.request }).compactionResponse;
    const browserResponse = browser.runWorkflow({ compaction_request: testCase.request }).compactionResponse;
    assert.deepEqual(comparable(nodeResponse), comparable(direct), `${testCase.id}: Node AOT parity`);
    assert.deepEqual(comparable(browserResponse), comparable(direct), `${testCase.id}: Browser AOT parity`);
    assert.equal(direct.status, testCase.expect.status, `${testCase.id}: status`);
    assert.deepEqual(comparable(direct.finalStatData), testCase.expect.stat, `${testCase.id}: final stat`);
    if (testCase.expect.functions) assert.deepEqual(comparable(direct.finalStatFunc), testCase.expect.functions, `${testCase.id}: functions`);
    for (const value of testCase.expect.includes ?? []) assert.ok(direct.content.includes(value), `${testCase.id}: includes ${value}`);
    for (const value of testCase.expect.excludes ?? []) assert.ok(!direct.content.includes(value), `${testCase.id}: excludes ${value}`);
    if (testCase.expect.diagnostics) assert.deepEqual(direct.diagnostics.map((item) => item.code), testCase.expect.diagnostics, `${testCase.id}: diagnostics`);
    if (typeof testCase.expect.nextRandomDrawOffset === "number") assert.equal(direct.nextRandomDrawOffset, testCase.expect.nextRandomDrawOffset, `${testCase.id}: random draw offset`);
    checkEquivalent(engine, direct, direct, testCase.request, `${testCase.id}: base`);
    for (const [index, variant] of (testCase.variants ?? []).entries()) {
      const variantRequest = withState(testCase.request, variant);
      const original = engine.compactCommandLayer(variantRequest);
      const frozen = engine.compactCommandLayer({ ...variantRequest, content: direct.content });
      assert.deepEqual(comparable(frozen.finalStatData), comparable(original.finalStatData), `${testCase.id}: frozen variant ${index}: stat replay`);
      assert.deepEqual(comparable(frozen.finalStatFunc), comparable(original.finalStatFunc), `${testCase.id}: frozen variant ${index}: function replay`);
      assert.deepEqual(frozen.diagnostics.map(({ code, path }) => ({ code, path })), original.diagnostics.map(({ code, path }) => ({ code, path })), `${testCase.id}: frozen variant ${index}: diagnostics`);
    }
    console.log(`PASS ${testCase.id}`);
  }
  console.log(JSON.stringify({ status: "PASS", cases: cases.length }));
} finally { await rm(temp, { recursive: true, force: true }); }
