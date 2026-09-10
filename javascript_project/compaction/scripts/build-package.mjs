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
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const repository = path.resolve(root, "../..");
const temp = await mkdtemp(path.join(os.tmpdir(), "era-compaction-package-"));
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
      { cwd: repository, stdio: "pipe" },
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
      { cwd: root, stdio: "pipe" },
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
    { cwd: root, stdio: "pipe" },
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
    { cwd: root, stdio: "pipe" },
  );
  const types = await readFile(
    path.join(declarations, "base_lib/command_compaction_engine.d.ts"),
    "utf8",
  );
  await writeFile(
    path.join(output, "engine.d.ts"),
    types +
      "\nexport declare function compactCommandLayer(input: unknown): CommandCompactionResponse;\n",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
