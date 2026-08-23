import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = path.resolve(root, "../..");
const temp = await mkdtemp(path.join(os.tmpdir(), "era-command-compaction-probe-"));
try {
  await symlink(path.join(root, "node_modules"), path.join(temp, "node_modules"), "dir");
  const esbuild = path.join(root, "node_modules/.bin/esbuild");
  for (const target of ["node", "browser"]) {
    const generated = path.join(temp, `${target}-generated`);
    execFileSync("python", [
      "run.py", "build",
      "--config", "javascript_project/compaction/configs/era.command_compaction.jsonc",
      "--target", target,
      "--profile", "esm-module",
      "--out-dir", generated,
    ], { cwd: repository, stdio: "pipe" });
    execFileSync(esbuild, [
      path.join(generated, "workflow.js"),
      "--bundle",
      `--platform=${target}`,
      "--format=esm",
      `--outfile=${path.join(temp, `${target}.mjs`)}`,
    ], { cwd: root, stdio: "pipe" });
  }
  const node = await import(pathToFileURL(path.join(temp, "node.mjs")).href);
  const browser = await import(pathToFileURL(path.join(temp, "browser.mjs")).href);
  const input = { compaction_request: { content: "<VariableEdit>{\"a\":{\"$expr\":\"a+1\"}}</VariableEdit><VariableEdit>{\"b\":{\"$expr\":\"a*2\"}}</VariableEdit>", initialStatData: { a: 2, b: 0 } } };
  const nodeResponse = node.runWorkflow(input).compactionResponse;
  const browserResponse = browser.runWorkflow(input).compactionResponse;
  assert.deepEqual(browserResponse, nodeResponse);
  assert.deepEqual(nodeResponse.finalStatData, { a: 3, b: 6 });
  assert.match(nodeResponse.content, /@a \+ 1/u);
  console.log(JSON.stringify({ status: "PASS", result: nodeResponse }));
} finally {
  await rm(temp, { recursive: true, force: true });
}
