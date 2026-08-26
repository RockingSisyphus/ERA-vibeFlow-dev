import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const expressionRoot = path.join(root, "javascript_project/expression");
const caseFiles = ["valid.json", "random.json", "compaction.json", "invalid.json"];

function command(file, args, options = {}) {
  try {
    execFileSync(file, args, {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
      ...options
    });
  } catch (error) {
    const detail = [error.stdout, error.stderr].filter(Boolean).join("\n");
    throw new Error(`${file} ${args.join(" ")} failed.\n${detail}`);
  }
}

async function loadCases() {
  const loaded = await Promise.all(
    caseFiles.map(async (name) => {
      const text = await readFile(path.join(here, "cases", name), "utf8");
      return JSON.parse(text);
    })
  );
  return loaded.flat();
}

function comparable(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertApprox(actual, expected, tolerance, label) {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number", `${label} should be numeric`);
    assert.ok(
      Math.abs(actual - expected) <= tolerance,
      `${label}: expected ${expected}, received ${actual}, tolerance ${tolerance}`
    );
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${label} should be an array`);
    assert.equal(actual.length, expected.length, `${label} length`);
    for (const [index, item] of expected.entries())
      assertApprox(actual[index], item, tolerance, `${label}[${index}]`);
    return;
  }
  if (expected !== null && typeof expected === "object") {
    assert.ok(actual !== null && typeof actual === "object", `${label} should be an object`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label} keys`);
    for (const [key, value] of Object.entries(expected))
      assertApprox(actual[key], value, tolerance, `${label}.${key}`);
    return;
  }
  assert.equal(actual, expected, label);
}

function setPath(rootValue, dottedPath, value) {
  const result = structuredClone(rootValue);
  const pathParts = dottedPath.split(".");
  let cursor = result;
  for (const segment of pathParts.slice(0, -1)) {
    if (cursor[segment] === null || typeof cursor[segment] !== "object") cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[pathParts.at(-1)] = value;
  return result;
}

function replayCompaction(engine, request, response) {
  const normalized = engine.normaliseRequest(request);
  const parsedFunctions = engine.parseFunctionDefinitions(normalized);
  const dependencies = engine.extractFunctionDependencies(parsedFunctions);
  const diagnostics = [
    ...engine.validateFunctionPurity(parsedFunctions),
    ...engine.rejectRecursiveFunctions(dependencies)
  ];
  const compiled = engine.compileCallableFunctions(parsedFunctions, diagnostics);
  assert.equal(compiled.valid, true, "valid compaction fixture must compile");
  const sequence = {
    startState: structuredClone(normalized.initialState),
    currentState: structuredClone(normalized.initialState),
    compiled,
    snapshotCompiled: compiled,
    operations: [],
    cursor: 0,
    randomContext: normalized.randomContext,
    randomDrawsConsumed: 0,
    diagnostics: []
  };
  let replayed = structuredClone(normalized.initialState);
  for (const operation of response.compactedOperations) {
    const parsed = engine.parseExpression(operation.value.$expr, true);
    assert.ok(parsed.ast, `compressed ${operation.path} must parse with internal @path support`);
    assert.deepEqual(parsed.diagnostics, [], `compressed ${operation.path} diagnostics`);
    let frame = engine.createAstFrameState(sequence, parsed.ast);
    while (!frame.done) frame = engine.advanceAstFrame(frame);
    assert.equal(frame.result === null, false, `compressed ${operation.path} must evaluate`);
    assert.deepEqual(frame.diagnostics, [], `compressed ${operation.path} evaluation diagnostics`);
    replayed = setPath(replayed, operation.path, frame.result);
  }
  return replayed;
}

function assertExpected(testCase, result, engine) {
  const { expect } = testCase;
  const tolerance = expect.tolerance ?? 0;
  assert.equal(result.status, expect.status, `${testCase.id}: status`);
  assertApprox(result.finalState, expect.finalState, tolerance, `${testCase.id}: finalState`);
  assert.deepEqual(
    result.diagnostics.map((item) => item.code),
    expect.diagnostics,
    `${testCase.id}: diagnostics`
  );
  if ("compressed" in expect)
    assert.deepEqual(result.compressed, expect.compressed, `${testCase.id}: compressed`);
  for (const key of ["randomDrawsConsumed", "nextDrawOffset", "containsAutomaticRandom"])
    if (key in expect) assert.equal(result[key], expect[key], `${testCase.id}: ${key}`);
  if (expect.replayCompression) {
    const replayed = replayCompaction(engine, testCase.request, result);
    assertApprox(replayed, expect.finalState, tolerance, `${testCase.id}: compressed replay`);
  }
}

function invokeWorkflow(workflow, request) {
  try {
    return { response: workflow.runWorkflow({ expression_request: request }).expressionResponse };
  } catch (error) {
    return { errorCode: error && typeof error === "object" ? error.code : undefined };
  }
}

async function buildEntrypoints(tempDirectory) {
  await symlink(
    path.join(expressionRoot, "node_modules"),
    path.join(tempDirectory, "node_modules"),
    "dir"
  );
  const esbuild = path.join(expressionRoot, "node_modules/.bin/esbuild");
  const directEngine = path.join(tempDirectory, "expression_engine.mjs");
  command(esbuild, [
    "base_lib/expression_engine.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${directEngine}`
  ], { cwd: expressionRoot });
  for (const target of ["node", "browser"]) {
    command("python", [
      "run.py",
      "build",
      "--config",
      "javascript_project/expression/configs/era.expression.jsonc",
      "--target",
      target,
      "--profile",
      "esm-module",
      "--out-dir",
      path.join(tempDirectory, target)
    ]);
  }
  const engine = await import(pathToFileURL(directEngine).href);
  const nodeWorkflow = await import(pathToFileURL(path.join(tempDirectory, "node", "workflow.js")).href);
  const browserWorkflow = await import(pathToFileURL(path.join(tempDirectory, "browser", "workflow.js")).href);
  return { engine, nodeWorkflow, browserWorkflow };
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "era-expression-sandbox-"));
try {
  const cases = await loadCases();
  const { engine, nodeWorkflow, browserWorkflow } = await buildEntrypoints(temporaryDirectory);
  for (const testCase of cases) {
    const direct = engine.executeExpressionLayer(testCase.request);
    const node = invokeWorkflow(nodeWorkflow, testCase.request);
    const browser = invokeWorkflow(browserWorkflow, testCase.request);
    if (testCase.expect.workflowError) {
      assert.equal(node.errorCode, testCase.expect.workflowError, `${testCase.id}: Node AOT schema error`);
      assert.equal(browser.errorCode, testCase.expect.workflowError, `${testCase.id}: Browser AOT schema error`);
    } else {
      assert.deepEqual(comparable(node.response), comparable(direct), `${testCase.id}: Node AOT parity`);
      assert.deepEqual(comparable(browser.response), comparable(direct), `${testCase.id}: Browser AOT parity`);
    }
    assertExpected(testCase, direct, engine);
    console.log(`PASS ${testCase.id}`);
  }
  console.log(JSON.stringify({ status: "PASS", cases: cases.length }));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
