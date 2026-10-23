import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  copyFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const repository = path.resolve(root, "../..");
const reports = path.join(repository, "reports");
await mkdir(reports, { recursive: true });
const temp = await mkdtemp(path.join(reports, ".compaction-package-"));
const buildEnv = { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp };
try {
  await symlink(
    path.join(root, "node_modules"),
    path.join(temp, "node_modules"),
    "dir",
  );
  const output = path.join(root, "generated/release");
  await mkdir(output, { recursive: true });
  for (const target of ["node", "browser"]) {
    const generated = path.join(temp, target);
    execFileSync(
      "python",
      [
        "run.py",
        "build",
        "--config",
        "javascript_project/compaction/configs/era.command_compaction.jsonc",
        "--target",
        target,
        "--profile",
        "esm-module",
        "--out-dir",
        generated,
      ],
      { cwd: repository, env: buildEnv, stdio: ["ignore", "ignore", "inherit"] },
    );
    execFileSync(
      path.join(root, "node_modules/.bin/esbuild"),
      [
        path.join(generated, "workflow.js"),
        "--bundle",
        `--platform=${target}`,
        "--format=esm",
        "--packages=external",
        `--outfile=${output}/${target}.js`,
      ],
      { cwd: root, env: buildEnv, stdio: "pipe" },
    );
    await copyFile(
      path.join(generated, "workflow.d.ts"),
      path.join(output, `${target}.d.ts`),
    );
  }
  await copyFile(
    path.join(output, "browser.js"),
    path.join(output, "workflow.js"),
  );
  await copyFile(
    path.join(output, "browser.d.ts"),
    path.join(output, "workflow.d.ts"),
  );
  execFileSync(
    path.join(root, "node_modules/.bin/esbuild"),
    [
      path.join(root, "api/engine.ts"),
      "--bundle",
      "--platform=neutral",
      "--format=esm",
      "--external:mathjs",
      "--external:@era/vibeflow-expression",
      "--external:@stdlib/math-base-special-gamma",
      `--outfile=${output}/engine.js`,
    ],
    { cwd: root, env: buildEnv, stdio: "pipe" },
  );
  const declarations = path.join(temp, "declarations");
  execFileSync(
    path.join(root, "node_modules/.bin/tsc"),
    [
      "--project",
      "tsconfig.json",
      "--noEmit",
      "false",
      "--declaration",
      "--emitDeclarationOnly",
      "--outDir",
      declarations,
    ],
    { cwd: root, env: buildEnv, stdio: "pipe" },
  );
  const types = await readFile(
    path.join(declarations, "base_lib/command_compaction_engine.d.ts"),
    "utf8",
  );
  await copyFile(
    path.join(declarations, "base_lib/command_compaction_interpreter.d.ts"),
    path.join(output, "command_compaction_interpreter.d.ts"),
  );
  await writeFile(
    path.join(output, "engine.d.ts"),
    'import type { CommandCompactionResponse } from "./command_compaction_interpreter.ts";\n' +
      types +
      "\nexport declare function compactCommandLayer(input: unknown): CommandCompactionResponse;\n",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
