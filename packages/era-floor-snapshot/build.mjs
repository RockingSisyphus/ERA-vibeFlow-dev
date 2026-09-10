import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const ts = require('typescript');
const source = fileURLToPath(new URL('../../javascript_project/service/base_lib/domain/floor_snapshot.ts', import.meta.url));
const output = fileURLToPath(new URL('.', import.meta.url));
const program = ts.createProgram([source], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true, skipLibCheck: true, declaration: true, types: [], outDir: output });
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: p => p, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }));
program.emit(undefined, (name, content) => {
  const filename = name.endsWith('.d.ts') ? 'index.d.ts' : 'index.js';
  writeFileSync(new URL(filename, import.meta.url), '// Generated from Service base_lib/domain/floor_snapshot.ts; do not edit.\n' + content);
});
