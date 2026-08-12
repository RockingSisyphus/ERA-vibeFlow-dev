import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadPolicy } from '../config.ts';
import { parseProject } from '../source.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('source parser', () => {
  it('保留模板字符串后注释，并解析 type-only、alias、dynamic 与 ?raw 导入', async () => {
    const root = await fixtureRoot();
    await writeFile(path.join(root, 'src/contract.ts'), 'export interface Contract { value: string };\n');
    await writeFile(path.join(root, 'src/lazy.ts'), 'export const lazy = true;\n');
    await writeFile(path.join(root, 'src/template.html'), '<div>template</div>\n');
    await writeFile(
      path.join(root, 'src/main.ts'),
      [
        "import type { Contract } from '@/contract';",
        "import templateHtml from './template.html?raw';",
        '',
        'const template = `',
        '  ${templateHtml}',
        '`;',
        '// 模板字符串之后的中文注释',
        'export async function load(value: Contract) {',
        "  return value.value ? import('@/lazy') : template;",
        '}',
      ].join('\n'),
    );

    const files = await parseFixture(root);
    const main = files.find(file => file.path === 'src/main.ts');

    expect(main?.comments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'line',
          section: 'script',
          lineStart: 7,
          text: ' 模板字符串之后的中文注释',
        }),
      ]),
    );
    expect(main?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rawSpecifier: '@/contract',
          targetPath: 'src/contract.ts',
          targetModule: 'src/contract',
          typeOnly: true,
          dynamic: false,
          resource: false,
          external: false,
        }),
        expect.objectContaining({
          rawSpecifier: './template.html?raw',
          targetPath: 'src/template.html',
          typeOnly: false,
          dynamic: false,
          resource: true,
          external: false,
        }),
        expect.objectContaining({
          rawSpecifier: '@/lazy',
          targetPath: 'src/lazy.ts',
          targetModule: 'src/lazy',
          dynamic: true,
          resource: false,
          external: false,
        }),
      ]),
    );
  });

  it('以 SFC 原始位置提取 template、script 和字符串感知的 style 注释', async () => {
    const root = await fixtureRoot();
    await writeFile(
      path.join(root, 'src/Panel.vue'),
      [
        '<template>',
        '  <!-- 模板中文注释 -->',
        '  <div />',
        '</template>',
        '<script setup lang="ts">',
        '// 脚本中文注释',
        'const count = 1;',
        '</script>',
        '<style scoped>',
        '.x::after { content: "/* 不是注释 */"; }',
        '/* 样式中文注释 */',
        '.x { color: red; }',
        '</style>',
        '<style lang="scss">',
        '// SCSS 中文注释',
        '.y { background: url(http://example.com/a.png); }',
        '</style>',
      ].join('\n'),
    );

    const panel = (await parseFixture(root)).find(file => file.path === 'src/Panel.vue');

    expect(panel?.comments.map(comment => [comment.kind, comment.lineStart, comment.lineEnd, comment.column])).toEqual([
      ['html', 2, 2, 3],
      ['line', 6, 6, 1],
      ['css', 11, 11, 1],
      ['css', 15, 15, 1],
    ]);
    expect(panel?.comments.filter(comment => comment.kind === 'css').map(comment => comment.text)).toEqual([
      ' 样式中文注释 ',
      ' SCSS 中文注释',
    ]);
    expect(panel?.internal.scriptRanges).toHaveLength(1);
    expect(panel?.scriptCodeLines).toBe(1);
    expect(panel?.codeLines).toBe(13);
  });

  it('文件和函数代码行数排除空行与纯注释行，但保留行尾注释所在代码行', async () => {
    const root = await fixtureRoot();
    await writeFile(
      path.join(root, 'src/line-count.ts'),
      [
        'export function calculate() {',
        '  // 这里只解释下一行的设计意图',
        '  const value = 1; // 行尾注释不能抹掉代码行',
        '',
        '  /*',
        '   * 多行中文说明不属于代码',
        '   */',
        '  return value;',
        '}',
      ].join('\n'),
    );

    const file = (await parseFixture(root)).find(item => item.path === 'src/line-count.ts');

    expect(file).toMatchObject({
      lines: 9,
      codeLines: 4,
      scriptCodeLines: 4,
      functions: [expect.objectContaining({ lines: 9, codeLines: 4 })],
    });
  });

  it('不会把 TypeScript 纯类型引用当成运行时全局副作用', async () => {
    const root = await fixtureRoot();
    await writeFile(
      path.join(root, 'src/type-use.ts'),
      [
        'type TavernContext = SillyTavern.Context;',
        'const context = SillyTavern.getContext();',
        'const castContext = SillyTavern.getContext() as TavernContext;',
      ].join('\n'),
    );

    const source = (await parseFixture(root)).find(file => file.path === 'src/type-use.ts');
    const tavernUses = source?.identifierUses.filter(use => use.name === 'SillyTavern');

    expect(tavernUses).toEqual([
      expect.objectContaining({ line: 2, qualifiedName: 'SillyTavern.getContext', kind: 'call' }),
      expect.objectContaining({ line: 3, qualifiedName: 'SillyTavern.getContext', kind: 'call' }),
    ]);
  });

  it('识别箭头函数、类方法、目录 index、Vue 与 re-export', async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, 'src/util'));
    await writeFile(
      path.join(root, 'src/util/index.ts'),
      ['export interface Contract { value: string }', 'export const value = 1;'].join('\n'),
    );
    await writeFile(
      path.join(root, 'src/Panel.vue'),
      ['<template><section /></template>', '<script setup lang="ts">', 'const visible = true;', '</script>'].join('\n'),
    );
    await writeFile(
      path.join(root, 'src/api.ts'),
      [
        "export { value } from './util';",
        "export { type Contract } from './util';",
        "export { default as Panel } from './Panel.vue';",
        'export const arrow = (required: string, optional = 1) => {',
        '  return required.length + optional;',
        '};',
        'export class Service {',
        '  run(value: string) {',
        '    if (value) return value;',
        "    return '';",
        '  }',
        '}',
      ].join('\n'),
    );

    const api = (await parseFixture(root)).find(file => file.path === 'src/api.ts');

    expect(api?.functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ qualifiedName: 'arrow', kind: 'arrow', exported: true, requiredParams: 1 }),
        expect.objectContaining({ qualifiedName: 'Service.run', kind: 'method', requiredParams: 1, branches: 1 }),
      ]),
    );
    expect(api?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rawSpecifier: './util',
          targetPath: 'src/util/index.ts',
          typeOnly: false,
        }),
        expect.objectContaining({
          rawSpecifier: './util',
          targetPath: 'src/util/index.ts',
          typeOnly: true,
        }),
        expect.objectContaining({
          rawSpecifier: './Panel.vue',
          targetPath: 'src/Panel.vue',
          typeOnly: false,
        }),
      ]),
    );
  });

  it('解析 import type 表达式并让未扫描的项目 d.ts 仍参与架构边界检查', async () => {
    const root = await fixtureRoot();
    await mkdir(path.join(root, 'src/core'));
    await mkdir(path.join(root, 'src/events'));
    await writeFile(path.join(root, 'src/events/secret.d.ts'), 'export interface Secret { value: string }\n');
    await writeFile(
      path.join(root, 'src/core/consumer.ts'),
      "export type Consumer = import('../events/secret').Secret;\n",
    );

    const files = await parseFixture(root);
    const consumer = files.find(file => file.path === 'src/core/consumer.ts');

    expect(consumer?.imports).toEqual([
      expect.objectContaining({
        rawSpecifier: '../events/secret',
        targetPath: 'src/events/secret.d.ts',
        typeOnly: true,
        sideEffectOnly: false,
      }),
    ]);
  });

  it('解析 require 与 import equals，同时忽略局部同名 require', async () => {
    const root = await fixtureRoot();
    await writeFile(path.join(root, 'src/dep.ts'), 'export const value = 1;\n');
    await writeFile(
      path.join(root, 'src/commonjs.ts'),
      [
        "const dep = require('./dep');",
        "import imported = require('./dep');",
        'function local(require: (value: string) => string) {',
        "  return require('./not-a-module');",
        '}',
        'export { dep, imported, local };',
      ].join('\n'),
    );

    const commonjs = (await parseFixture(root)).find(file => file.path === 'src/commonjs.ts');
    expect(commonjs?.imports).toEqual([
      expect.objectContaining({
        rawSpecifier: './dep',
        targetPath: 'src/dep.ts',
        typeOnly: false,
        sideEffectOnly: true,
      }),
      expect.objectContaining({
        rawSpecifier: './dep',
        targetPath: 'src/dep.ts',
        localNames: ['imported'],
        typeOnly: false,
        sideEffectOnly: true,
      }),
    ]);
  });

  it('对空扫描和语法错误 fail closed', async () => {
    const emptyRoot = await fixtureRoot();
    await mkdir(path.join(emptyRoot, 'empty'));
    const policy = await loadPolicy(process.cwd());

    await expect(parseProject(emptyRoot, { ...policy, include: ['empty/**/*.ts'] })).rejects.toThrow(
      /没有发现任何 .ts 或 .vue 文件/u,
    );

    const invalidRoot = await fixtureRoot();
    await writeFile(path.join(invalidRoot, 'src/invalid.ts'), 'export const = ;\n');
    await expect(parseFixture(invalidRoot)).rejects.toThrow(/解析源码失败/u);

    const unresolvedRoot = await fixtureRoot();
    await writeFile(path.join(unresolvedRoot, 'src/unresolved.ts'), "import './missing';\nexport {};\n");
    await expect(parseFixture(unresolvedRoot)).rejects.toThrow(/无法解析项目内部导入/u);

    const escapedRoot = await fixtureRoot();
    await mkdir(path.join(escapedRoot, 'src/era'));
    await writeFile(path.join(escapedRoot, 'src/outside.ts'), 'export const outside = true;\n');
    await writeFile(
      path.join(escapedRoot, 'src/era/inside.ts'),
      "import { outside } from '../outside';\nexport { outside };\n",
    );
    await expect(parseProject(escapedRoot, { ...policy, include: ['src/era/**/*.ts'] })).rejects.toThrow(
      /质检扫描范围外/u,
    );

    const dynamicRoot = await fixtureRoot();
    await writeFile(
      path.join(dynamicRoot, 'src/dynamic.ts'),
      "const modulePath = './env';\nexport const lazy = import(modulePath);\n",
    );
    await expect(parseFixture(dynamicRoot)).rejects.toThrow(/动态 import 必须使用无插值的字符串字面量/u);

    const requireRoot = await fixtureRoot();
    await writeFile(
      path.join(requireRoot, 'src/require.ts'),
      "const modulePath = './env';\nexport const loaded = require(modulePath);\n",
    );
    await expect(parseFixture(requireRoot)).rejects.toThrow(/require\(\) 必须且只能使用一个字符串字面量/u);
  });

  it('按具体词法绑定区分 import、局部遮蔽和同文件 ambient 引用', async () => {
    const root = await fixtureRoot();
    await writeFile(
      path.join(root, 'src/bindings.ts'),
      [
        "import axios from 'axios';",
        'axios.get("/top");',
        'function local(axios: { get(path: string): void }, fetch: (path: string) => void) {',
        '  axios.get("/local");',
        '  fetch("/local");',
        '}',
        'fetch("/ambient");',
      ].join('\n'),
    );

    const file = (await parseFixture(root)).find(item => item.path === 'src/bindings.ts');
    expect(file?.identifierUses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 2,
          name: 'axios',
          bindingKind: 'import',
          importSource: 'axios',
        }),
        expect.objectContaining({ line: 4, name: 'axios', bindingKind: 'local' }),
        expect.objectContaining({ line: 5, name: 'fetch', bindingKind: 'local' }),
        expect.objectContaining({ line: 7, name: 'fetch', bindingKind: 'ambient' }),
      ]),
    );
  });

  it('匿名函数对象标识不包含行列，普通代码移动不会改变指纹身份', async () => {
    const root = await fixtureRoot();
    const sourcePath = path.join(root, 'src/anonymous.ts');
    const source = ['export const callbacks = [', '  () => {', '    return 1;', '  },', '];'].join('\n');
    await writeFile(sourcePath, source);
    const first = (await parseFixture(root))
      .find(file => file.path === 'src/anonymous.ts')
      ?.functions.find(fn => fn.name === 'callbacks[0]');

    const changedBody = [
      '',
      'export const callbacks = [',
      '  () => {',
      '    if (flag) return 2;',
      '    return 1;',
      '  },',
      '];',
    ].join('\n');
    await writeFile(sourcePath, changedBody);
    const moved = (await parseFixture(root))
      .find(file => file.path === 'src/anonymous.ts')
      ?.functions.find(fn => fn.name === 'callbacks[0]');

    expect(first?.objectId).toBe(moved?.objectId);
    expect(first?.objectId).not.toMatch(/@\d+:\d+/u);
  });
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'era-quality-source-'));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src/env.ts'), 'export {};\n');
  await writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
      include: ['src'],
    }),
  );
  return root;
}

async function parseFixture(root: string) {
  const policy = await loadPolicy(process.cwd());
  return parseProject(root, { ...policy, include: ['src/**/*.{ts,vue}'] });
}
