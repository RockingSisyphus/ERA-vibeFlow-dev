import { createHash } from 'node:crypto';
import fs, { type Dirent } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseForESLint as parseTypeScriptForEslint } from '@typescript-eslint/parser';
import {
  findConfigFile,
  formatDiagnostics,
  parseJsonConfigFileContent,
  readConfigFile,
  resolveModuleName,
  sys,
  type CompilerOptions,
  type Diagnostic,
} from 'typescript';
import { parseForESLint as parseVueForEslint } from 'vue-eslint-parser';

import type {
  CommentFact,
  FunctionFact,
  IdentifierUse,
  ImportFact,
  ParsedFile,
  QualityPolicy,
  TypeFact,
} from './types.ts';

interface ParserResult {
  ast: any;
  visitorKeys?: Record<string, string[]>;
  scopeManager?: any;
  services?: Record<string, any>;
}

interface ParseContext {
  root: string;
  compilerOptions: CompilerOptions;
  configDirectory: string;
  pathAliases: Record<string, string[]>;
}

interface RawComment {
  kind: CommentFact['kind'];
  section: CommentFact['section'];
  text: string;
  raw: string;
  range: [number, number];
}

interface FunctionWithAttachment {
  fact: FunctionFact;
  attachmentStart: number;
}

interface TypeWithAttachment {
  fact: TypeFact;
  attachmentStart: number;
}

interface VueSections {
  scriptRanges: Array<[number, number]>;
  templateRanges: Array<[number, number]>;
  styleRanges: Array<[number, number]>;
  styleLineCommentRanges: Array<[number, number]>;
  htmlComments: RawComment[];
}

interface ResolvedImport {
  external: boolean;
  targetPath?: string;
  targetModule?: string;
}

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue'];
const RESOLVABLE_EXTENSIONS = [...CODE_EXTENSIONS, '.d.ts', '.json', '.html', '.css', '.scss', '.sass', '.svg'];
const BRANCH_NODE_TYPES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
]);
const NESTING_NODE_TYPES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'CatchClause',
]);
const FUNCTION_NODE_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const IGNORED_SCAN_DIRECTORIES = new Set(['.git', 'node_modules', 'dist']);

/**
 * Discover and parse every TypeScript/Vue source selected by the quality policy.
 *
 * Any parser failure, unresolved project-local import, unreadable tsconfig, or
 * empty scan is fatal. This fail-closed behavior prevents an incomplete scan
 * from being mistaken for a clean project.
 */
export async function parseProject(root: string, policy: QualityPolicy): Promise<ParsedFile[]> {
  const absoluteRoot = path.resolve(root);
  const sourcePaths = await discoverSourceFiles(absoluteRoot, policy.include);
  if (sourcePaths.length === 0) {
    throw new Error(`ERA 质检没有发现任何 .ts 或 .vue 文件；include=${policy.include.join(', ')}`);
  }

  const parseContext = loadTypeScriptConfig(absoluteRoot);
  const files: ParsedFile[] = [];
  for (const sourcePath of sourcePaths) {
    if (process.env.ERA_QUALITY_DEBUG === '1') {
      process.stderr.write(`[era-quality] parsing ${toPosix(path.relative(absoluteRoot, sourcePath))}\n`);
    }
    files.push(await parseSourceFile(sourcePath, parseContext));
  }

  const moduleByPath = new Map(files.map(file => [normalizeAbsolute(file.absolutePath), file.moduleName]));
  for (const file of files) {
    for (const imported of file.imports) {
      if (imported.external || imported.resource || imported.targetPath === undefined) {
        continue;
      }
      const absoluteTarget = path.resolve(absoluteRoot, imported.targetPath);
      const scannedModule = moduleByPath.get(normalizeAbsolute(absoluteTarget));
      if (scannedModule === undefined && !(imported.typeOnly && imported.targetPath.endsWith('.d.ts'))) {
        throw new Error(
          `项目内部代码依赖落在质检扫描范围外：${file.path} -> ${imported.targetPath}；请扩展 include 或移除跨边界依赖。`,
        );
      }
      imported.targetModule = scannedModule;
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

async function discoverSourceFiles(root: string, includePatterns: string[]): Promise<string[]> {
  const discovered = new Set<string>();

  for (const originalPattern of includePatterns) {
    const pattern = normalizeRelativePath(originalPattern);
    const staticPrefix = pattern.slice(0, firstGlobIndex(pattern));
    const prefixWithoutPartialSegment = staticPrefix.endsWith('/')
      ? staticPrefix.slice(0, -1)
      : staticPrefix.slice(0, Math.max(0, staticPrefix.lastIndexOf('/')));
    const candidate = path.resolve(root, hasGlob(pattern) ? prefixWithoutPartialSegment || '.' : pattern);
    assertInsideRoot(root, candidate, `include 路径越出项目根目录: ${originalPattern}`);

    let candidateStat;
    try {
      candidateStat = await stat(candidate);
    } catch {
      throw new Error(`ERA 质检 include 不存在: ${originalPattern}`);
    }

    if (candidateStat.isFile()) {
      const relativePath = toPosix(path.relative(root, candidate));
      if (isSupportedSource(candidate) && (!hasGlob(pattern) || matchesGlob(relativePath, pattern))) {
        discovered.add(normalizeAbsolute(candidate));
      }
      continue;
    }
    if (!candidateStat.isDirectory()) {
      throw new Error(`ERA 质检 include 既不是文件也不是目录: ${originalPattern}`);
    }

    const paths = await walkDirectory(candidate);
    for (const absolutePath of paths) {
      const relativePath = toPosix(path.relative(root, absolutePath));
      if (isSupportedSource(absolutePath) && (!hasGlob(pattern) || matchesGlob(relativePath, pattern))) {
        discovered.add(normalizeAbsolute(absolutePath));
      }
    }
  }

  return [...discovered].sort((left, right) => left.localeCompare(right, 'en'));
}

async function walkDirectory(directory: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_SCAN_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walkDirectory(absolutePath)));
    } else if (isRegularFile(entry)) {
      result.push(absolutePath);
    }
  }
  return result;
}

function isRegularFile(entry: Dirent): boolean {
  return entry.isFile();
}

function isSupportedSource(filePath: string): boolean {
  return filePath.endsWith('.ts') && !filePath.endsWith('.d.ts') ? true : filePath.endsWith('.vue');
}

function hasGlob(pattern: string): boolean {
  return /[*?{[]/u.test(pattern);
}

function firstGlobIndex(pattern: string): number {
  const index = pattern.search(/[*?{[]/u);
  return index === -1 ? pattern.length : index;
}

function matchesGlob(filePath: string, pattern: string): boolean {
  return expandBraces(pattern).some(expanded => globToRegExp(expanded).test(filePath));
}

function expandBraces(pattern: string): string[] {
  const opening = pattern.indexOf('{');
  if (opening === -1) {
    return [pattern];
  }
  const closing = pattern.indexOf('}', opening + 1);
  if (closing === -1) {
    throw new Error(`include glob 的花括号未闭合: ${pattern}`);
  }
  const prefix = pattern.slice(0, opening);
  const suffix = pattern.slice(closing + 1);
  return pattern
    .slice(opening + 1, closing)
    .split(',')
    .flatMap(option => expandBraces(`${prefix}${option}${suffix}`));
}

function globToRegExp(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index += 1;
        if (pattern[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(character);
    }
  }
  return new RegExp(`${source}$`, 'u');
}

function loadTypeScriptConfig(root: string): ParseContext {
  const configPath = findConfigFile(root, sys.fileExists, 'tsconfig.json');
  if (configPath === undefined) {
    throw new Error(`无法在 ${root} 找到 tsconfig.json`);
  }
  const readResult = readConfigFile(configPath, sys.readFile);
  if (readResult.error !== undefined) {
    throw new Error(`读取 tsconfig.json 失败:\n${formatTypeScriptDiagnostics([readResult.error])}`);
  }
  const configDirectory = path.dirname(configPath);
  const parsed = parseJsonConfigFileContent(readResult.config, sys, configDirectory);
  if (parsed.errors.length > 0) {
    throw new Error(`解析 tsconfig.json 失败:\n${formatTypeScriptDiagnostics(parsed.errors)}`);
  }
  return {
    root,
    compilerOptions: parsed.options,
    configDirectory,
    pathAliases:
      (readResult.config as { compilerOptions?: { paths?: Record<string, string[]> } }).compilerOptions?.paths ?? {},
  };
}

function formatTypeScriptDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return formatDiagnostics(diagnostics, {
    getCanonicalFileName: value => value,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  });
}

async function parseSourceFile(absolutePath: string, context: ParseContext): Promise<ParsedFile> {
  const startedAt = performance.now();
  const debugStage = (stage: string): void => {
    if (process.env.ERA_QUALITY_DEBUG === '1') {
      process.stderr.write(
        `[era-quality]   ${stage} ${(performance.now() - startedAt).toFixed(1)}ms ${path.basename(absolutePath)}\n`,
      );
    }
  };
  const text = await readFile(absolutePath, 'utf8');
  const relativePath = toPosix(path.relative(context.root, absolutePath));
  const kind: ParsedFile['kind'] = absolutePath.endsWith('.vue') ? 'vue' : 'ts';
  const parserResult = parseWithEslintParser(text, absolutePath, kind);
  debugStage('parser');
  const lineMap = new LineMap(text);

  let sections: VueSections;
  if (kind === 'vue') {
    sections = extractVueSections(text, parserResult, relativePath);
  } else {
    sections = {
      scriptRanges: [[0, text.length]],
      templateRanges: [],
      styleRanges: [],
      styleLineCommentRanges: [],
      htmlComments: [],
    };
  }
  debugStage(
    `sections(script=${sections.scriptRanges.length},template=${sections.templateRanges.length},style=${sections.styleRanges.length})`,
  );

  const rawComments = [
    ...extractScriptComments(text, parserResult.ast.comments ?? []),
    ...sections.htmlComments,
    ...sections.styleRanges.flatMap(range =>
      scanCssComments(
        text,
        range,
        relativePath,
        sections.styleLineCommentRanges.some(candidate => candidate[0] === range[0] && candidate[1] === range[1]),
      ),
    ),
  ].sort((left, right) => left.range[0] - right.range[0] || left.range[1] - right.range[1]);
  debugStage(`raw-comments(${rawComments.length})`);
  const comments = materializeComments(relativePath, text, rawComments, lineMap, sections);
  debugStage('comments');

  const parentMap = new WeakMap<object, any>();
  const astNodes: any[] = [];
  walkAst(parserResult.ast, parserResult.visitorKeys, (node, parent) => {
    astNodes.push(node);
    if (parent !== null) {
      parentMap.set(node, parent);
    }
  });
  debugStage(`walk(${astNodes.length})`);

  const exportedNames = collectExportedNames(parserResult.ast);
  const functionData = extractFunctions(
    relativePath,
    astNodes,
    parentMap,
    parserResult.visitorKeys,
    exportedNames,
    lineMap,
    text,
    comments,
  );
  debugStage(`functions(${functionData.length})`);
  const typeData = extractTypes(relativePath, astNodes, parentMap, exportedNames, lineMap);
  attachLeadingComments(text, comments, functionData, typeData);
  debugStage('types/comments');

  const imports = extractImports(astNodes, parserResult.scopeManager).map(imported => {
    const resolved = resolveImport(imported.rawSpecifier, absolutePath, context);
    return { ...imported, ...resolved };
  });
  debugStage(`imports(${imports.length})`);
  const { identifierUses, declaredNames } = extractIdentifierUses(
    astNodes,
    parentMap,
    parserResult.scopeManager,
    functionData,
  );
  debugStage(`uses(${identifierUses.length})`);

  const branchCount = astNodes.reduce((sum, node) => sum + branchWeight(node), 0);
  const functions = functionData.map(item => item.fact);
  const classes = astNodes.filter(node => node.type === 'ClassDeclaration' || node.type === 'ClassExpression');
  const moduleName = moduleNameFromPath(relativePath);

  return {
    path: relativePath,
    absolutePath,
    moduleName,
    kind,
    text,
    bytes: Buffer.byteLength(text),
    codeLines: countCodeLines(text, [[0, text.length]], comments, lineMap),
    lines: lineMap.lineCount,
    scriptCodeLines: countScriptCodeLines(text, sections.scriptRanges, comments, lineMap),
    functionCount: functions.length,
    classCount: classes.length,
    exportCount: exportedNames.size,
    branchCount,
    maxNestingDepth: Math.max(0, ...functions.map(fn => fn.maxNestingDepth)),
    comments,
    functions,
    types: typeData.map(item => item.fact),
    imports,
    identifierUses,
    declaredNames,
    internal: {
      ast: parserResult.ast,
      visitorKeys: parserResult.visitorKeys,
      scriptRanges: sections.scriptRanges,
    },
  };
}

function parseWithEslintParser(text: string, filePath: string, kind: ParsedFile['kind']): ParserResult {
  const options = {
    filePath,
    loc: true,
    range: true,
    comment: true,
    tokens: true,
    ecmaVersion: 'latest' as const,
    sourceType: 'module' as const,
  };
  try {
    if (kind === 'vue') {
      return parseVueForEslint(text, {
        ...options,
        parser: { parseForESLint: parseTypeScriptForEslint },
      }) as unknown as ParserResult;
    }
    return parseTypeScriptForEslint(text, options) as unknown as ParserResult;
  } catch (error) {
    throw new Error(`解析源码失败 (${filePath}): ${errorMessage(error)}`, { cause: error });
  }
}

function extractVueSections(text: string, result: ParserResult, relativePath: string): VueSections {
  const getDocumentFragment = result.services?.getDocumentFragment;
  if (typeof getDocumentFragment !== 'function') {
    throw new Error(`Vue parser 未提供 document fragment: ${relativePath}`);
  }
  const documentFragment = getDocumentFragment.call(result.services);
  // vue-eslint-parser reports HTML's self-closing rule even for Vue component
  // tags. Vue SFC explicitly permits that syntax, so it is a compatibility
  // diagnostic rather than a source parse failure.
  const parserErrors: Array<{ code?: string; message?: string; lineNumber?: number; column?: number }> = (
    documentFragment.errors ?? []
  ).filter((error: { code?: string }) => error.code !== 'non-void-html-element-start-tag-with-trailing-solidus');
  if (parserErrors.length > 0) {
    const messages = parserErrors.map(error => {
      const location = error.lineNumber === undefined ? '' : `:${error.lineNumber}:${(error.column ?? 0) + 1}`;
      return `${relativePath}${location} ${error.message ?? '未知 Vue 语法错误'}`;
    });
    throw new Error(`Vue 模板解析失败:\n${messages.join('\n')}`);
  }

  const scriptRanges: Array<[number, number]> = [];
  const templateRanges: Array<[number, number]> = [];
  const styleRanges: Array<[number, number]> = [];
  const styleLineCommentRanges: Array<[number, number]> = [];
  walkDocument(documentFragment, element => {
    if (element.type !== 'VElement') {
      return;
    }
    const name = String(element.rawName ?? element.name ?? '').toLowerCase();
    if (name !== 'script' && name !== 'template' && name !== 'style') {
      return;
    }
    const contentStart = element.startTag?.range?.[1];
    const contentEnd = element.endTag?.range?.[0] ?? element.range?.[1];
    if (typeof contentStart !== 'number' || typeof contentEnd !== 'number' || contentEnd < contentStart) {
      throw new Error(`无法确定 Vue <${name}> 的源码范围: ${relativePath}`);
    }
    const range: [number, number] = [contentStart, contentEnd];
    if (name === 'script') {
      scriptRanges.push(range);
    } else if (name === 'template') {
      templateRanges.push(range);
    } else {
      styleRanges.push(range);
      const startTag = text.slice(element.startTag.range[0], element.startTag.range[1]);
      if (
        /\blang\s*=\s*(?:"(?:scss|sass|less|stylus)"|'(?:scss|sass|less|stylus)'|(?:scss|sass|less|stylus)\b)/iu.test(
          startTag,
        )
      ) {
        styleLineCommentRanges.push(range);
      }
    }
  });

  const htmlComments: RawComment[] = (documentFragment.comments ?? []).map((comment: any) => {
    const range = asRange(comment.range, relativePath);
    const raw = text.slice(range[0], range[1]);
    return {
      kind: 'html',
      section: 'template',
      text: typeof comment.value === 'string' ? comment.value : stripCommentDelimiters(raw, 'html'),
      raw,
      range,
    };
  });
  return {
    scriptRanges: sortRanges(scriptRanges),
    templateRanges: sortRanges(templateRanges),
    styleRanges: sortRanges(styleRanges),
    styleLineCommentRanges: sortRanges(styleLineCommentRanges),
    htmlComments,
  };
}

function walkDocument(node: any, visitor: (node: any) => void): void {
  if (node === null || typeof node !== 'object') {
    return;
  }
  visitor(node);
  for (const key of ['children']) {
    const children = node[key];
    if (Array.isArray(children)) {
      children.forEach(child => walkDocument(child, visitor));
    }
  }
}

function extractScriptComments(text: string, parserComments: any[]): RawComment[] {
  return parserComments.map(comment => {
    const range = asRange(comment.range, '<script>');
    const raw = text.slice(range[0], range[1]);
    const kind: CommentFact['kind'] = comment.type === 'Line' ? 'line' : raw.startsWith('/**') ? 'jsdoc' : 'block';
    return {
      kind,
      section: 'script',
      text: typeof comment.value === 'string' ? comment.value : stripCommentDelimiters(raw, kind),
      raw,
      range,
    };
  });
}

function scanCssComments(
  text: string,
  range: [number, number],
  relativePath: string,
  allowLineComments: boolean,
): RawComment[] {
  const comments: RawComment[] = [];
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = range[0]; index < range[1]; index += 1) {
    const character = text[index]!;
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character !== '/') {
      continue;
    }
    if (allowLineComments && text[index + 1] === '/' && ![':', '('].includes(text[index - 1] ?? '')) {
      const start = index;
      const newline = text.indexOf('\n', index + 2);
      const end = newline === -1 ? range[1] : Math.min(newline, range[1]);
      const raw = text.slice(start, end);
      comments.push({
        kind: 'css',
        section: 'style',
        text: raw.slice(2),
        raw,
        range: [start, end],
      });
      index = end - 1;
      continue;
    }
    if (text[index + 1] !== '*') {
      continue;
    }

    const start = index;
    const endMarker = text.indexOf('*/', index + 2);
    if (endMarker === -1 || endMarker + 2 > range[1]) {
      throw new Error(`CSS 注释未闭合: ${relativePath} offset ${start}`);
    }
    const end = endMarker + 2;
    const raw = text.slice(start, end);
    comments.push({
      kind: 'css',
      section: 'style',
      text: raw.slice(2, -2),
      raw,
      range: [start, end],
    });
    index = end - 1;
  }
  return comments;
}

function materializeComments(
  relativePath: string,
  text: string,
  rawComments: RawComment[],
  lineMap: LineMap,
  sections: VueSections,
): CommentFact[] {
  const comments = rawComments.map((comment, index): CommentFact => {
    const start = lineMap.location(comment.range[0]);
    const end = lineMap.location(Math.max(comment.range[0], comment.range[1] - 1));
    return {
      id: `${relativePath}#comment:${index + 1}`,
      kind: comment.kind,
      section: comment.section,
      text: comment.text,
      raw: comment.raw,
      range: comment.range,
      lineStart: start.line,
      lineEnd: end.line,
      column: start.column,
    };
  });

  const masked = maskCommentText(text, comments);
  for (const comment of comments) {
    const sectionRanges =
      comment.section === 'script'
        ? sections.scriptRanges
        : comment.section === 'style'
          ? sections.styleRanges
          : sections.templateRanges;
    const sectionRange =
      sectionRanges.find(range => containsRange(range, comment.range)) ?? ([0, text.length] satisfies [number, number]);
    comment.precedingCode = adjacentCode(masked, comment.range, sectionRange, -1);
    comment.followingCode = adjacentCode(masked, comment.range, sectionRange, 1);
  }
  return comments;
}

function maskCommentText(text: string, comments: CommentFact[]): string {
  // Parser ranges are UTF-16 code-unit offsets. split('') deliberately follows
  // the same indexing model, whereas a code-point spread would shift every
  // range after an astral emoji.
  const characters = text.split('');
  for (const comment of comments) {
    for (let index = comment.range[0]; index < comment.range[1]; index += 1) {
      if (characters[index] !== '\n' && characters[index] !== '\r') {
        characters[index] = ' ';
      }
    }
  }
  return characters.join('');
}

function adjacentCode(
  maskedText: string,
  commentRange: [number, number],
  sectionRange: [number, number],
  direction: -1 | 1,
): string | undefined {
  const immediateStart = direction === -1 ? maskedText.lastIndexOf('\n', commentRange[0] - 1) + 1 : commentRange[1];
  const immediateEnd =
    direction === -1
      ? commentRange[0]
      : (() => {
          const end = maskedText.indexOf('\n', commentRange[1]);
          return end === -1 ? sectionRange[1] : Math.min(end, sectionRange[1]);
        })();
  const immediate = maskedText.slice(immediateStart, immediateEnd).trim();
  if (immediate.length > 0) {
    return immediate;
  }

  let cursor = direction === -1 ? immediateStart - 1 : immediateEnd + 1;
  while (cursor >= sectionRange[0] && cursor < sectionRange[1]) {
    if (direction === -1) {
      const previousNewline = maskedText.lastIndexOf('\n', cursor - 1);
      const lineStart = Math.max(sectionRange[0], previousNewline + 1);
      const value = maskedText.slice(lineStart, cursor + 1).trim();
      if (value.length > 0) {
        return value;
      }
      const nextCursor = lineStart - 1;
      if (nextCursor >= cursor) {
        return undefined;
      }
      cursor = nextCursor;
    } else {
      const lineEndIndex = maskedText.indexOf('\n', cursor);
      const lineEnd = lineEndIndex === -1 ? sectionRange[1] : Math.min(lineEndIndex, sectionRange[1]);
      const value = maskedText.slice(cursor, lineEnd).trim();
      if (value.length > 0) {
        return value;
      }
      cursor = lineEnd + 1;
    }
  }
  return undefined;
}

function collectExportedNames(program: any): Set<string> {
  const names = new Set<string>();
  for (const statement of program.body ?? []) {
    if (statement.type === 'ExportDefaultDeclaration') {
      names.add('default');
      const declaredName = declarationName(statement.declaration);
      if (declaredName !== undefined) {
        names.add(declaredName);
      }
    } else if (statement.type === 'ExportNamedDeclaration') {
      collectDeclarationNames(statement.declaration).forEach(name => names.add(name));
      for (const specifier of statement.specifiers ?? []) {
        const exported = identifierName(specifier.exported);
        if (exported !== undefined) {
          names.add(exported);
        }
        const local = identifierName(specifier.local);
        if (local !== undefined) {
          names.add(local);
        }
      }
    } else if (statement.type === 'ExportAllDeclaration') {
      names.add(`*:${literalString(statement.source) ?? 'unknown'}`);
    }
  }
  return names;
}

function collectDeclarationNames(declaration: any): string[] {
  if (declaration === null || declaration === undefined) {
    return [];
  }
  if (declaration.type === 'VariableDeclaration') {
    return declaration.declarations.flatMap((item: any) => patternNames(item.id));
  }
  const name = declarationName(declaration);
  return name === undefined ? [] : [name];
}

function declarationName(declaration: any): string | undefined {
  return identifierName(declaration?.id);
}

function extractFunctions(
  relativePath: string,
  astNodes: any[],
  parentMap: WeakMap<object, any>,
  visitorKeys: Record<string, string[]> | undefined,
  exportedNames: Set<string>,
  lineMap: LineMap,
  text: string,
  comments: CommentFact[],
): FunctionWithAttachment[] {
  const functions: FunctionWithAttachment[] = [];
  const factByNode = new WeakMap<object, FunctionFact>();
  const nameCounts = new Map<string, number>();

  for (const node of astNodes) {
    if (!isFunctionNode(node) || node.body === undefined || node.range === undefined) {
      continue;
    }
    const parent = parentMap.get(node);
    const name = functionName(node, parentMap);
    const kind = functionKind(node, parentMap);
    const astFingerprint = fingerprintAst(node.body, visitorKeys);
    const containing = nearestContainingFunction(node, parentMap, factByNode);
    const className = nearestClassName(node, parentMap);
    const baseQualifiedName =
      containing !== undefined
        ? `${containing.qualifiedName}.${name}`
        : className === undefined
          ? name
          : `${className}.${name}`;
    const occurrence = (nameCounts.get(baseQualifiedName) ?? 0) + 1;
    nameCounts.set(baseQualifiedName, occurrence);
    const qualifiedName = occurrence === 1 ? baseQualifiedName : `${baseQualifiedName}#${occurrence}`;
    const range = asRange(node.range, relativePath);
    const bodyRange = asRange(node.body.range ?? node.range, relativePath);
    const start = lineMap.location(range[0]);
    const end = lineMap.location(Math.max(range[0], range[1] - 1));
    const metrics = functionComplexity(node, visitorKeys);
    const parameterNames = (node.params ?? []).flatMap((parameter: any) => patternNames(parameter));
    const requiredParams = (node.params ?? []).filter((parameter: any) => isRequiredParameter(parameter)).length;
    const exported =
      exportedNames.has(name) ||
      exportedNames.has(qualifiedName) ||
      hasExportAncestor(node, parentMap) ||
      (parent?.type === 'VariableDeclarator' && exportedNames.has(identifierName(parent.id) ?? ''));
    const fact: FunctionFact = {
      objectId: `${moduleNameFromPath(relativePath)}#function:${qualifiedName}`,
      name,
      qualifiedName,
      kind,
      exported,
      async: node.async === true,
      range,
      bodyRange,
      lineStart: start.line,
      lineEnd: end.line,
      codeLines: countCodeLines(text, [range], comments, lineMap),
      lines: end.line - start.line + 1,
      branches: metrics.branches,
      maxNestingDepth: metrics.maxNestingDepth,
      requiredParams,
      parameterNames,
      astFingerprint,
    };
    factByNode.set(node, fact);
    functions.push({ fact, attachmentStart: attachmentStart(node, parentMap) });
  }
  return functions;
}

function extractTypes(
  relativePath: string,
  astNodes: any[],
  parentMap: WeakMap<object, any>,
  exportedNames: Set<string>,
  lineMap: LineMap,
): TypeWithAttachment[] {
  const result: TypeWithAttachment[] = [];
  for (const node of astNodes) {
    if (node.type !== 'TSInterfaceDeclaration' && node.type !== 'TSTypeAliasDeclaration') {
      continue;
    }
    const name = identifierName(node.id) ?? '<anonymous-type>';
    const range = asRange(node.range, relativePath);
    const memberCount =
      node.type === 'TSInterfaceDeclaration'
        ? (node.body?.body?.length ?? 0)
        : node.typeAnnotation?.type === 'TSTypeLiteral'
          ? (node.typeAnnotation.members?.length ?? 0)
          : 0;
    result.push({
      fact: {
        objectId: `${moduleNameFromPath(relativePath)}#type:${name}`,
        name,
        kind: node.type === 'TSInterfaceDeclaration' ? 'interface' : 'type',
        exported: exportedNames.has(name) || hasExportAncestor(node, parentMap),
        memberCount,
        range,
        lineStart: lineMap.location(range[0]).line,
      },
      attachmentStart: attachmentStart(node, parentMap),
    });
  }
  return result;
}

function attachLeadingComments(
  text: string,
  comments: CommentFact[],
  functions: FunctionWithAttachment[],
  types: TypeWithAttachment[],
): void {
  const candidates = comments.filter(comment => comment.kind === 'jsdoc' && comment.section === 'script');
  for (const item of [...functions, ...types]) {
    const preceding = candidates
      .filter(comment => comment.range[1] <= item.attachmentStart)
      .sort((left, right) => right.range[1] - left.range[1])[0];
    if (
      preceding === undefined ||
      text.slice(preceding.range[1], item.attachmentStart).trim().length > 0 ||
      preceding.attachedObjectId !== undefined
    ) {
      continue;
    }
    item.fact.leadingCommentId = preceding.id;
    preceding.attachedObjectId = item.fact.objectId;
  }
}

function attachmentStart(node: any, parentMap: WeakMap<object, any>): number {
  let current = node;
  while (true) {
    const parent = parentMap.get(current);
    if (parent === undefined || !isAttachmentWrapper(parent, current)) {
      break;
    }
    current = parent;
  }
  return current.range?.[0] ?? node.range?.[0] ?? 0;
}

function isAttachmentWrapper(parent: any, child: any): boolean {
  if (
    parent.type === 'ExportNamedDeclaration' ||
    parent.type === 'ExportDefaultDeclaration' ||
    parent.type === 'VariableDeclaration' ||
    parent.type === 'VariableDeclarator' ||
    parent.type === 'MethodDefinition' ||
    parent.type === 'PropertyDefinition' ||
    parent.type === 'TSAbstractMethodDefinition'
  ) {
    return true;
  }
  if (
    parent.type === 'TSAsExpression' ||
    parent.type === 'TSSatisfiesExpression' ||
    parent.type === 'TSNonNullExpression' ||
    parent.type === 'ChainExpression'
  ) {
    return true;
  }
  return parent.type === 'Property' && parent.value === child;
}

function extractImports(astNodes: any[], scopeManager: any): ImportFact[] {
  const imports: ImportFact[] = [];
  const ambientIdentifiers = new WeakSet<object>();
  for (const scope of scopeManager?.scopes ?? []) {
    for (const reference of scope.references ?? []) {
      if ((reference.resolved === null || reference.resolved === undefined) && reference.identifier !== undefined) {
        ambientIdentifiers.add(reference.identifier);
      }
    }
  }
  for (const node of astNodes) {
    if (node.type === 'ImportDeclaration') {
      const specifier = literalString(node.source);
      if (specifier !== undefined) {
        const specifiers: any[] = node.specifiers ?? [];
        const typeOnly =
          node.importKind === 'type' || (specifiers.length > 0 && specifiers.every(item => item.importKind === 'type'));
        const localNames = specifiers
          .map(item => identifierName(item.local))
          .filter((name): name is string => name !== undefined);
        imports.push(importFact(specifier, node.source, typeOnly, false, specifiers.length === 0, localNames));
      }
    } else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const specifier = literalString(node.source);
      if (specifier !== undefined) {
        const specifiers: any[] = node.specifiers ?? [];
        const typeOnly =
          node.exportKind === 'type' || (specifiers.length > 0 && specifiers.every(item => item.exportKind === 'type'));
        // A runtime re-export evaluates the target module but creates no local
        // binding for identifier-use analysis, so the import fact itself must
        // remain visible to the side-effect checker.
        imports.push(importFact(specifier, node.source, typeOnly, false, !typeOnly));
      }
    } else if (node.type === 'ImportExpression') {
      const specifier = literalString(node.source);
      if (specifier === undefined) {
        throw new Error('动态 import 必须使用无插值的字符串字面量，才能执行完整依赖与副作用分析。');
      }
      imports.push(importFact(specifier, node.source, false, true, true));
    } else if (node.type === 'CallExpression' && node.callee?.type === 'Import') {
      const specifier = literalString(node.arguments?.[0]);
      if (specifier === undefined) {
        throw new Error('动态 import 必须使用无插值的字符串字面量，才能执行完整依赖与副作用分析。');
      }
      imports.push(importFact(specifier, node.arguments[0], false, true, true));
    } else if (node.type === 'TSImportType') {
      // @typescript-eslint/parser 8 exposes the module literal as `source`.
      // Keep the older wrapper shapes as fallbacks so parser upgrades cannot
      // silently erase type-only architecture edges.
      const sourceNode = node.source ?? node.argument?.literal ?? node.argument;
      const specifier = literalString(sourceNode);
      if (specifier !== undefined) {
        imports.push(importFact(specifier, sourceNode, true, false, false));
      }
    } else if (node.type === 'TSImportEqualsDeclaration') {
      const sourceNode = node.moduleReference?.expression;
      const specifier = literalString(sourceNode);
      if (sourceNode !== undefined && specifier === undefined) {
        throw new Error('TypeScript import = require() 必须使用字符串字面量，才能执行完整依赖与副作用分析。');
      }
      if (specifier !== undefined) {
        const typeOnly = node.importKind === 'type' || node.isTypeOnly === true;
        const localName = identifierName(node.id);
        imports.push(
          importFact(specifier, sourceNode, typeOnly, false, !typeOnly, localName === undefined ? [] : [localName]),
        );
      }
    } else if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'require' &&
      ambientIdentifiers.has(node.callee)
    ) {
      const sourceNode = node.arguments?.[0];
      const specifier = literalString(sourceNode);
      if (specifier === undefined || (node.arguments?.length ?? 0) !== 1) {
        throw new Error('require() 必须且只能使用一个字符串字面量，才能执行完整依赖与副作用分析。');
      }
      imports.push(importFact(specifier, sourceNode, false, false, true));
    }
  }
  return imports.sort(
    (left, right) =>
      left.line - right.line || left.column - right.column || left.rawSpecifier.localeCompare(right.rawSpecifier),
  );
}

function importFact(
  rawSpecifier: string,
  sourceNode: any,
  typeOnly: boolean,
  dynamic: boolean,
  sideEffectOnly: boolean,
  localNames: string[] = [],
): ImportFact {
  const cleanSpecifier = stripResourceQuery(rawSpecifier);
  return {
    rawSpecifier,
    sourceModule: cleanSpecifier,
    localNames: [...new Set(localNames)].sort(),
    external: false,
    typeOnly,
    dynamic,
    sideEffectOnly,
    resource: rawSpecifier !== cleanSpecifier || !isCodeLikeSpecifier(cleanSpecifier),
    line: (sourceNode.loc?.start?.line ?? 1) as number,
    column: ((sourceNode.loc?.start?.column ?? 0) as number) + 1,
  };
}

function resolveImport(rawSpecifier: string, containingFile: string, context: ParseContext): ResolvedImport {
  const specifier = stripResourceQuery(rawSpecifier);
  const internalSpecifier = isInternalSpecifier(specifier, context.pathAliases);
  const manual = manualResolve(specifier, containingFile, context);
  if (manual !== undefined) {
    return resolvedLocalImport(manual, context.root);
  }

  const resolved = resolveModuleName(specifier, containingFile, context.compilerOptions, sys).resolvedModule;
  if (resolved !== undefined) {
    const resolvedPath = normalizeAbsolute(resolved.resolvedFileName);
    if (resolved.isExternalLibraryImport === true || resolvedPath.includes('/node_modules/')) {
      return { external: true };
    }
    return resolvedLocalImport(resolvedPath, context.root);
  }

  if (internalSpecifier) {
    throw new Error(`无法解析项目内部导入 ${JSON.stringify(rawSpecifier)}（${containingFile}）`);
  }
  return { external: true };
}

function resolvedLocalImport(resolvedPath: string, root: string): ResolvedImport {
  const normalized = normalizeAbsolute(resolvedPath);
  const relative = toPosix(path.relative(root, normalized));
  return {
    external: false,
    targetPath: relative,
    targetModule: isCodePath(normalized) ? moduleNameFromPath(relative) : undefined,
  };
}

function manualResolve(specifier: string, containingFile: string, context: ParseContext): string | undefined {
  const bases: string[] = [];
  if (specifier.startsWith('.')) {
    bases.push(path.resolve(path.dirname(containingFile), specifier));
  } else if (path.isAbsolute(specifier)) {
    bases.push(specifier);
  } else {
    for (const [pattern, replacements] of Object.entries(context.pathAliases)) {
      const wildcard = matchAlias(pattern, specifier);
      if (wildcard === undefined) {
        continue;
      }
      const baseUrl = context.compilerOptions.baseUrl ?? context.configDirectory;
      replacements.forEach(replacement => {
        bases.push(path.resolve(baseUrl, replacement.replace('*', wildcard)));
      });
    }
  }

  for (const base of bases) {
    const resolved = resolveCandidate(base);
    if (resolved !== undefined) {
      return resolved;
    }
  }
  return undefined;
}

function resolveCandidate(base: string): string | undefined {
  const candidates = [base];
  const extension = path.extname(base);
  if (extension.length === 0) {
    RESOLVABLE_EXTENSIONS.forEach(candidateExtension => candidates.push(`${base}${candidateExtension}`));
  } else if (['.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    const withoutExtension = base.slice(0, -extension.length);
    ['.ts', '.tsx', '.mts', '.cts'].forEach(candidateExtension =>
      candidates.push(`${withoutExtension}${candidateExtension}`),
    );
  }
  RESOLVABLE_EXTENSIONS.forEach(candidateExtension => candidates.push(path.join(base, `index${candidateExtension}`)));

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return normalizeAbsolute(fs.realpathSync(candidate));
      }
    } catch {
      // Candidate does not exist or cannot be read; continue to the next legal resolution.
    }
  }
  return undefined;
}

function isInternalSpecifier(specifier: string, aliases: Record<string, string[]>): boolean {
  return (
    specifier.startsWith('.') ||
    path.isAbsolute(specifier) ||
    Object.keys(aliases).some(pattern => matchAlias(pattern, specifier) !== undefined)
  );
}

function matchAlias(pattern: string, specifier: string): string | undefined {
  const star = pattern.indexOf('*');
  if (star === -1) {
    return pattern === specifier ? '' : undefined;
  }
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return specifier.startsWith(prefix) && specifier.endsWith(suffix)
    ? specifier.slice(prefix.length, specifier.length - suffix.length)
    : undefined;
}

function extractIdentifierUses(
  astNodes: any[],
  parentMap: WeakMap<object, any>,
  scopeManager: any,
  functions: FunctionWithAttachment[],
): { identifierUses: IdentifierUse[]; declaredNames: string[] } {
  const referenceResolution = new WeakMap<
    object,
    { bindingKind: IdentifierUse['bindingKind']; importSource?: string }
  >();
  const declaredNames = new Set<string>();
  for (const scope of scopeManager?.scopes ?? []) {
    for (const reference of scope.references ?? []) {
      if (reference.identifier !== undefined) {
        const resolved = reference.resolved;
        if (resolved === null || resolved === undefined) {
          referenceResolution.set(reference.identifier, { bindingKind: 'ambient' });
        } else {
          const importDefinition = (resolved.defs ?? []).find((definition: any) => {
            return definition.type === 'ImportBinding' || definition.parent?.type === 'ImportDeclaration';
          });
          const importSource = literalString(importDefinition?.parent?.source);
          referenceResolution.set(reference.identifier, {
            bindingKind: importDefinition === undefined ? 'local' : 'import',
            ...(importSource === undefined ? {} : { importSource }),
          });
        }
      }
    }
    for (const variable of scope.variables ?? []) {
      if ((variable.defs?.length ?? 0) > 0 && typeof variable.name === 'string') {
        declaredNames.add(variable.name);
      }
    }
  }

  const functionByRangeStart = new Map(functions.map(item => [item.fact.range[0], item.fact]));
  const identifierUses: IdentifierUse[] = [];
  for (const node of astNodes) {
    if (node.type !== 'Identifier' || !referenceResolution.has(node) || isTypeOnlyIdentifier(node, parentMap)) {
      continue;
    }
    const expression = outerReferenceExpression(node, parentMap);
    const expressionParent = parentMap.get(expression);
    const called =
      expressionParent?.type === 'CallExpression' && expressionParent.callee === expression
        ? true
        : expression.type === 'CallExpression';
    const enclosingFunction = nearestFunctionNode(node, parentMap);
    const resolution = referenceResolution.get(node) ?? { bindingKind: 'ambient' as const };
    identifierUses.push({
      name: node.name,
      qualifiedName: expressionName(expression),
      kind: called ? 'call' : expression.type === 'MemberExpression' ? 'member' : 'identifier',
      bindingKind: resolution.bindingKind,
      ...(resolution.importSource === undefined ? {} : { importSource: resolution.importSource }),
      line: (node.loc?.start?.line ?? 1) as number,
      column: ((node.loc?.start?.column ?? 0) as number) + 1,
      objectId:
        enclosingFunction === undefined ? undefined : functionByRangeStart.get(enclosingFunction.range?.[0])?.objectId,
      locallyBound: resolution.bindingKind !== 'ambient',
    });
  }

  identifierUses.sort(
    (left, right) =>
      left.line - right.line ||
      left.column - right.column ||
      left.qualifiedName.localeCompare(right.qualifiedName, 'en'),
  );
  return { identifierUses, declaredNames: [...declaredNames].sort((left, right) => left.localeCompare(right, 'en')) };
}

/**
 * TypeScript's scope manager exposes references from both emitted expressions
 * and erased type syntax. Side-effect analysis must only see the former.
 */
function isTypeOnlyIdentifier(node: any, parentMap: WeakMap<object, any>): boolean {
  let current = node;
  while (true) {
    const parent = parentMap.get(current);
    if (parent === undefined) {
      return false;
    }

    if (
      parent.typeAnnotation === current ||
      parent.returnType === current ||
      parent.typeParameters === current ||
      parent.typeArguments === current ||
      parent.superTypeArguments === current ||
      (Array.isArray(parent.implements) && parent.implements.includes(current))
    ) {
      return true;
    }

    if (
      parent.type === 'TSAsExpression' ||
      parent.type === 'TSTypeAssertion' ||
      parent.type === 'TSSatisfiesExpression'
    ) {
      if (parent.expression !== current) {
        return true;
      }
      current = parent;
      continue;
    }
    if (parent.type === 'TSNonNullExpression' || parent.type === 'TSInstantiationExpression') {
      if (parent.expression !== current) {
        return true;
      }
      current = parent;
      continue;
    }
    if (parent.type === 'TSEnumMember' && parent.initializer === current) {
      current = parent;
      continue;
    }
    if (parent.type === 'TSParameterProperty' && parent.parameter === current) {
      current = parent;
      continue;
    }

    if (parent.type === 'TSQualifiedName' || parent.type.startsWith('TS')) {
      return true;
    }
    current = parent;
  }
}

function outerReferenceExpression(node: any, parentMap: WeakMap<object, any>): any {
  let current = node;
  while (true) {
    const parent = parentMap.get(current);
    if (
      parent?.type === 'MemberExpression' &&
      (parent.object === current || (parent.computed === true && parent.property === current))
    ) {
      current = parent;
    } else if (parent?.type === 'ChainExpression' && parent.expression === current) {
      current = parent;
    } else {
      return current;
    }
  }
}

function expressionName(node: any): string {
  if (node?.type === 'Identifier') {
    return node.name;
  }
  if (node?.type === 'ThisExpression') {
    return 'this';
  }
  if (node?.type === 'ChainExpression') {
    return expressionName(node.expression);
  }
  if (node?.type === 'MemberExpression') {
    const object = expressionName(node.object);
    const property = node.computed
      ? (literalString(node.property) ?? expressionName(node.property))
      : identifierName(node.property);
    return property === undefined ? object : `${object}.${property}`;
  }
  if (node?.type === 'CallExpression') {
    return `${expressionName(node.callee)}()`;
  }
  return node?.type ?? '<unknown>';
}

function countScriptCodeLines(
  text: string,
  scriptRanges: Array<[number, number]>,
  comments: CommentFact[],
  lineMap: LineMap,
): number {
  if (scriptRanges.length === 0) {
    return 0;
  }
  const scriptComments = comments.filter(comment => comment.section === 'script');
  return countCodeLines(text, scriptRanges, scriptComments, lineMap);
}

function countCodeLines(
  text: string,
  ranges: Array<[number, number]>,
  comments: CommentFact[],
  lineMap: LineMap,
): number {
  if (ranges.length === 0) {
    return 0;
  }
  const masked = maskCommentText(text, comments);
  const codeLines = new Set<number>();
  for (const range of ranges) {
    const firstLine = lineMap.location(range[0]).line;
    const lastLine = lineMap.location(Math.max(range[0], range[1] - 1)).line;
    for (let line = firstLine; line <= lastLine; line += 1) {
      const bounds = lineMap.range(line);
      const start = Math.max(bounds[0], range[0]);
      const end = Math.min(bounds[1], range[1]);
      if (masked.slice(start, end).trim().length > 0) {
        codeLines.add(line);
      }
    }
  }
  return codeLines.size;
}

function functionComplexity(
  functionNode: any,
  visitorKeys: Record<string, string[]> | undefined,
): { branches: number; maxNestingDepth: number } {
  let branches = 0;
  let maxNestingDepth = 0;

  const visit = (node: any, depth: number, root: boolean): void => {
    if (!root && isFunctionNode(node)) {
      return;
    }
    branches += branchWeight(node);
    const nestedDepth = NESTING_NODE_TYPES.has(node.type) ? depth + 1 : depth;
    maxNestingDepth = Math.max(maxNestingDepth, nestedDepth);
    for (const child of astChildren(node, visitorKeys)) {
      visit(child, nestedDepth, false);
    }
  };
  visit(functionNode.body, 0, true);
  return { branches, maxNestingDepth };
}

function branchWeight(node: any): number {
  if (BRANCH_NODE_TYPES.has(node.type)) {
    return 1;
  }
  if (node.type === 'SwitchCase') {
    return node.test === null ? 0 : 1;
  }
  if (node.type === 'LogicalExpression' && ['&&', '||', '??'].includes(node.operator)) {
    return 1;
  }
  return 0;
}

function fingerprintAst(
  node: any,
  visitorKeys: Record<string, string[]> | undefined,
  eraseIdentifiersAndLiterals = true,
): string {
  if (node === undefined || node === null) {
    return '';
  }
  const normalize = (current: any): unknown => {
    if (current === null || current === undefined || typeof current !== 'object') {
      return current;
    }
    if (current.type === 'Identifier' || current.type === 'PrivateIdentifier') {
      return eraseIdentifiersAndLiterals ? { type: current.type } : { type: current.type, name: current.name };
    }
    if (current.type === 'Literal') {
      return eraseIdentifiersAndLiterals
        ? { type: 'Literal', valueType: current.regex === undefined ? typeof current.value : 'regex' }
        : {
            type: 'Literal',
            value: typeof current.value === 'bigint' ? current.value.toString() : current.value,
            regex: current.regex,
          };
    }
    if (current.type === 'TemplateElement') {
      return eraseIdentifiersAndLiterals
        ? { type: 'TemplateElement' }
        : { type: 'TemplateElement', value: current.value };
    }
    const normalized: Record<string, unknown> = { type: current.type };
    for (const property of ['operator', 'kind', 'computed', 'optional', 'method', 'async', 'generator', 'prefix']) {
      if (current[property] !== undefined) {
        normalized[property] = current[property];
      }
    }
    for (const key of visitorKeys?.[current.type] ?? fallbackVisitorKeys(current)) {
      const value = current[key];
      normalized[key] = Array.isArray(value) ? value.map(normalize) : normalize(value);
    }
    return normalized;
  };
  return createHash('sha256')
    .update(JSON.stringify(normalize(node)))
    .digest('hex');
}

function walkAst(
  root: any,
  visitorKeys: Record<string, string[]> | undefined,
  visitor: (node: any, parent: any | null) => void,
): void {
  const visit = (node: any, parent: any | null): void => {
    if (node === null || typeof node !== 'object' || typeof node.type !== 'string') {
      return;
    }
    visitor(node, parent);
    for (const child of astChildren(node, visitorKeys)) {
      visit(child, node);
    }
  };
  visit(root, null);
}

function astChildren(node: any, visitorKeys: Record<string, string[]> | undefined): any[] {
  const children: any[] = [];
  for (const key of visitorKeys?.[node.type] ?? fallbackVisitorKeys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(child => {
        if (child !== null && typeof child === 'object' && typeof child.type === 'string') {
          children.push(child);
        }
      });
    } else if (value !== null && typeof value === 'object' && typeof value.type === 'string') {
      children.push(value);
    }
  }
  return children;
}

function fallbackVisitorKeys(node: any): string[] {
  return Object.keys(node).filter(key => {
    if (['parent', 'loc', 'range', 'tokens', 'comments'].includes(key)) {
      return false;
    }
    const value = node[key];
    return (
      (value !== null && typeof value === 'object' && typeof value.type === 'string') ||
      (Array.isArray(value) && value.some(child => child !== null && typeof child === 'object' && 'type' in child))
    );
  });
}

function functionName(node: any, parentMap: WeakMap<object, any>): string {
  const ownName = identifierName(node.id);
  if (ownName !== undefined) {
    return ownName;
  }
  let current = node;
  let suffix = '';
  while (true) {
    const parent = parentMap.get(current);
    if (parent === undefined) {
      break;
    }
    if (parent.type === 'VariableDeclarator') {
      return `${patternNames(parent.id)[0] ?? '<anonymous>'}${suffix}`;
    }
    if (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition' || parent.type === 'Property') {
      return `${propertyName(parent.key) ?? '<computed-method>'}${suffix}`;
    }
    if (parent.type === 'AssignmentExpression') {
      return `${expressionName(parent.left)}${suffix}`;
    }
    if (parent.type === 'ExportDefaultDeclaration') {
      return `default${suffix}`;
    }
    if (parent.type === 'CallExpression' && (parent.arguments ?? []).includes(current)) {
      return `${expressionName(parent.callee)}Callback[arg${parent.arguments.indexOf(current)}]${suffix}`;
    }
    if (parent.type === 'ArrayExpression') {
      suffix = `[${(parent.elements ?? []).indexOf(current)}]${suffix}`;
      current = parent;
      continue;
    }
    if (parent.type === 'ReturnStatement' && parent.argument === current) {
      return `<returned-callback>${suffix}`;
    }
    if (!isTransparentExpression(parent, current)) {
      break;
    }
    current = parent;
  }
  return '<anonymous-callback>';
}

function functionKind(node: any, parentMap: WeakMap<object, any>): FunctionFact['kind'] {
  if (node.type === 'FunctionDeclaration') {
    return 'function';
  }
  let current = node;
  while (true) {
    const parent = parentMap.get(current);
    if (parent === undefined) {
      break;
    }
    if (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition' || parent.type === 'Property') {
      return 'method';
    }
    if (parent.type === 'CallExpression' && (parent.arguments ?? []).includes(current)) {
      return 'callback';
    }
    if (!isTransparentExpression(parent, current) && parent.type !== 'VariableDeclarator') {
      break;
    }
    current = parent;
  }
  return node.type === 'ArrowFunctionExpression' ? 'arrow' : 'function';
}

function isTransparentExpression(parent: any, child: any): boolean {
  return (
    ((parent.type === 'TSAsExpression' ||
      parent.type === 'TSSatisfiesExpression' ||
      parent.type === 'TSNonNullExpression' ||
      parent.type === 'ChainExpression') &&
      (parent.expression === child || parent.argument === child)) ||
    (parent.type === 'Property' && parent.value === child)
  );
}

function nearestContainingFunction(
  node: any,
  parentMap: WeakMap<object, any>,
  facts: WeakMap<object, FunctionFact>,
): FunctionFact | undefined {
  let current = parentMap.get(node);
  while (current !== undefined) {
    const fact = facts.get(current);
    if (fact !== undefined) {
      return fact;
    }
    current = parentMap.get(current);
  }
  return undefined;
}

function nearestFunctionNode(node: any, parentMap: WeakMap<object, any>): any | undefined {
  let current = parentMap.get(node);
  while (current !== undefined) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = parentMap.get(current);
  }
  return undefined;
}

function nearestClassName(node: any, parentMap: WeakMap<object, any>): string | undefined {
  let current = parentMap.get(node);
  while (current !== undefined) {
    if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
      return identifierName(current.id) ?? '<anonymous-class>';
    }
    current = parentMap.get(current);
  }
  return undefined;
}

function hasExportAncestor(node: any, parentMap: WeakMap<object, any>): boolean {
  let current = parentMap.get(node);
  while (current !== undefined) {
    if (current.type === 'ExportNamedDeclaration' || current.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (
      current.type === 'Program' ||
      current.type === 'BlockStatement' ||
      (isFunctionNode(current) && current !== node)
    ) {
      return false;
    }
    current = parentMap.get(current);
  }
  return false;
}

function isRequiredParameter(parameter: any): boolean {
  if (parameter.type === 'AssignmentPattern') {
    return false;
  }
  if (parameter.optional === true) {
    return false;
  }
  if (parameter.type === 'TSParameterProperty') {
    return isRequiredParameter(parameter.parameter);
  }
  return true;
}

function patternNames(pattern: any): string[] {
  if (pattern === null || pattern === undefined) {
    return [];
  }
  if (pattern.type === 'Identifier') {
    return [pattern.name];
  }
  if (pattern.type === 'RestElement') {
    return patternNames(pattern.argument);
  }
  if (pattern.type === 'AssignmentPattern') {
    return patternNames(pattern.left);
  }
  if (pattern.type === 'TSParameterProperty') {
    return patternNames(pattern.parameter);
  }
  if (pattern.type === 'ObjectPattern') {
    return (pattern.properties ?? []).flatMap((property: any) =>
      property.type === 'RestElement' ? patternNames(property.argument) : patternNames(property.value),
    );
  }
  if (pattern.type === 'ArrayPattern') {
    return (pattern.elements ?? []).flatMap((element: any) => patternNames(element));
  }
  return [];
}

function propertyName(node: any): string | undefined {
  return identifierName(node) ?? literalString(node);
}

function identifierName(node: any): string | undefined {
  return node?.type === 'Identifier' || node?.type === 'PrivateIdentifier' ? node.name : undefined;
}

function literalString(node: any): string | undefined {
  if (typeof node?.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && (node.expressions?.length ?? 0) === 0) {
    return node.quasis?.[0]?.value?.cooked ?? node.quasis?.[0]?.value?.raw;
  }
  return undefined;
}

function isFunctionNode(node: any): boolean {
  return FUNCTION_NODE_TYPES.has(node?.type);
}

function isCodeLikeSpecifier(specifier: string): boolean {
  const extension = path.extname(specifier);
  return extension.length === 0 || CODE_EXTENSIONS.includes(extension) || extension === '.d.ts';
}

function isCodePath(filePath: string): boolean {
  return CODE_EXTENSIONS.some(extension => filePath.endsWith(extension)) || filePath.endsWith('.d.ts');
}

function stripResourceQuery(specifier: string): string {
  return specifier.replace(/[?#].*$/u, '');
}

function moduleNameFromPath(relativePath: string): string {
  return normalizeRelativePath(relativePath)
    .replace(/(?:\.d)?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|vue)$/u, '')
    .replace(/\/index$/u, '');
}

function stripCommentDelimiters(raw: string, kind: CommentFact['kind']): string {
  if (kind === 'line') {
    return raw.slice(2);
  }
  if (kind === 'html') {
    return raw.slice(4, -3);
  }
  return raw.slice(2, -2);
}

function sortRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  return ranges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

function containsRange(outer: [number, number], inner: [number, number]): boolean {
  return outer[0] <= inner[0] && outer[1] >= inner[1];
}

function asRange(value: unknown, source: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number' || typeof value[1] !== 'number') {
    throw new Error(`解析器没有为节点提供合法 range: ${source}`);
  }
  return [value[0], value[1]];
}

function normalizeAbsolute(value: string): string {
  return toPosix(path.resolve(value));
}

function normalizeRelativePath(value: string): string {
  return toPosix(value).replace(/^\.\//u, '').replace(/\/+/gu, '/');
}

function toPosix(value: string): string {
  return value.replaceAll(path.sep, '/');
}

function assertInsideRoot(root: string, candidate: string, message: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(message);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class LineMap {
  readonly starts: number[];
  readonly textLength: number;

  constructor(text: string) {
    this.textLength = text.length;
    this.starts = [0];
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === '\n') {
        this.starts.push(index + 1);
      }
    }
  }

  get lineCount(): number {
    return this.starts.length;
  }

  location(offset: number): { line: number; column: number } {
    const bounded = Math.max(0, Math.min(offset, this.textLength));
    let low = 0;
    let high = this.starts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.starts[middle]! <= bounded) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return { line: low + 1, column: bounded - this.starts[low]! + 1 };
  }

  range(line: number): [number, number] {
    const index = Math.max(0, Math.min(line - 1, this.starts.length - 1));
    return [this.starts[index]!, this.starts[index + 1] ?? this.textLength];
  }
}
