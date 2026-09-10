import { FSWatcher, watch } from 'chokidar';
import HtmlInlineScriptWebpackPlugin from 'html-inline-script-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import _ from 'lodash';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { ChildProcess, exec, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import RemarkHTML from 'remark-html';
import { Server } from 'socket.io';
import TerserPlugin from 'terser-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import unpluginAutoImport from 'unplugin-auto-import/webpack';
import { VueUseComponentsResolver, VueUseDirectiveResolver } from 'unplugin-vue-components/resolvers';
import unpluginVueComponents from 'unplugin-vue-components/webpack';
import { VueLoaderPlugin } from 'vue-loader';
import ts from 'typescript';
import webpack from 'webpack';
import WebpackObfuscator from 'webpack-obfuscator';
const require = createRequire(import.meta.url);
const HTMLInlineCSSWebpackPlugin = require('html-inline-css-webpack-plugin').default;

interface Config {
  port: number;
  entries: Entry[];
}
interface Entry {
  script: string;
  html?: string;
}

const ERA_PRODUCTION_ENTRY = path.resolve(import.meta.dirname, 'src/ERA变量框架/index.ts');
const ERA_FORBIDDEN_PRODUCTION_DEPENDENCIES = [
  path.resolve(import.meta.dirname, 'src/ERA变量框架/events/scheduler.ts'),
  path.resolve(import.meta.dirname, 'src/ERA变量框架/events/queue.ts'),
  path.resolve(import.meta.dirname, 'src/ERA变量框架/events/dispatcher.ts'),
  path.resolve(import.meta.dirname, 'src/ERA变量框架/core/crud'),
  path.resolve(import.meta.dirname, 'src/ERA变量框架/core/sync.ts'),
  path.resolve(import.meta.dirname, 'src/ERA变量框架/initer/manual'),
] as const;

/** 生产入口的 fail-closed 依赖图门禁，防止旧双后端被意外打包。 */
class EraProductionDependencyGuardPlugin {
  apply(compiler: webpack.Compiler): void {
    compiler.hooks.thisCompilation.tap('EraProductionDependencyGuardPlugin', compilation => {
      compilation.hooks.finishModules.tap('EraProductionDependencyGuardPlugin', modules => {
        for (const module of modules) {
          const resource = (module as webpack.NormalModule).resource?.split('?')[0];
          if (!resource) continue;
          const forbidden = ERA_FORBIDDEN_PRODUCTION_DEPENDENCIES.find(candidate =>
            candidate.endsWith('.ts')
              ? resource === candidate
              : resource === candidate || resource.startsWith(`${candidate}${path.sep}`),
          );
          if (forbidden) {
            compilation.errors.push(
              new webpack.WebpackError(
                `ERA 生产依赖图包含禁止的旧实现：${path.relative(import.meta.dirname, resource)}`,
              ),
            );
          }
        }
      });
    });
  }
}

function parse_entry(script_file: string) {
  const html = path.join(path.dirname(script_file), 'index.html');
  if (fs.existsSync(html)) {
    return { script: script_file, html };
  }
  return { script: script_file };
}

function common_path(lhs: string, rhs: string) {
  const lhs_parts = lhs.split(path.sep);
  const rhs_parts = rhs.split(path.sep);
  for (let i = 0; i < Math.min(lhs_parts.length, rhs_parts.length); i++) {
    if (lhs_parts[i] !== rhs_parts[i]) {
      return lhs_parts.slice(0, i).join(path.sep);
    }
  }
  return lhs_parts.join(path.sep);
}

function glob_script_files() {
  const results: string[] = [];

  fs.globSync(`{示例,src}/**/index.{ts,tsx,js,jsx}`)
    .filter(
      file => process.env.CI !== 'true' || !fs.readFileSync(path.join(import.meta.dirname, file)).includes('@no-ci'),
    )
    .forEach(file => {
      const file_dirname = path.dirname(file);
      for (const [index, result] of results.entries()) {
        const result_dirname = path.dirname(result);
        const common = common_path(result_dirname, file_dirname);
        if (common === result_dirname) {
          return;
        }
        if (common === file_dirname) {
          results.splice(index, 1, file);
          return;
        }
      }
      results.push(file);
    });

  return results;
}

const config: Config = {
  port: 6621,
  entries: glob_script_files().map(parse_entry),
};

// Linux 桌面会话经常与 IDE、浏览器共享较低的 inotify 实例上限。
// 默认改用轮询，避免多入口 watch 因 ENOSPC 中断；需要原生监听时可显式关闭。
const use_polling = process.platform === 'linux' && process.env.TAVERN_WATCH_USE_POLLING !== 'false';

let io: Server;
function watch_tavern_helper(compiler: webpack.Compiler) {
  if (compiler.options.watch) {
    if (!io) {
      const port = config.port ?? 6621;
      io = new Server(port, { cors: { origin: '*' } });
      console.info(`\x1b[36m[tavern_helper]\x1b[0m 已启动酒馆监听服务`);
      io.on('connect', socket => {
        console.info(`\x1b[36m[tavern_helper]\x1b[0m 成功连接到酒馆网页 '${socket.id}', 初始化推送...`);
        io.emit('iframe_updated');
        socket.on('disconnect', reason => {
          console.info(`\x1b[36m[tavern_helper]\x1b[0m 与酒馆网页 '${socket.id}' 断开连接: ${reason}`);
        });
      });
    }

    compiler.hooks.done.tap('watch_tavern_helper', () => {
      console.info('\n\x1b[36m[tavern_helper]\x1b[0m 检测到完成编译, 推送更新事件...');
      if (compiler.options.plugins.some(plugin => plugin instanceof HtmlWebpackPlugin)) {
        io.emit('message_iframe_updated');
      } else {
        io.emit('script_iframe_updated');
      }
    });
  }
}

/**
 * Preserve ERA's module-aware logger names while using the current template
 * toolchain. `new Logger()` becomes `new Logger('path/to/module')`.
 */
function get_logger_transformer(_program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
  return context => {
    return sourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'Logger' &&
          (!node.arguments || node.arguments.length === 0)
        ) {
          const project_dir = path.join(import.meta.dirname, 'src');
          const module_name = path
            .relative(project_dir, sourceFile.fileName)
            .replace(/\\/g, '/')
            .replace(/\.(vue|ts|js)$/, '')
            .replace(/\/index$/, '');

          return context.factory.updateNewExpression(node, node.expression, node.typeArguments, [
            context.factory.createStringLiteral(module_name),
          ]);
        }
        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
    };
  };
}

let watcher: FSWatcher;
const dump = () => {
  exec('pnpm dump', { cwd: import.meta.dirname });
  console.info('\x1b[36m[schema_dump]\x1b[0m 已将所有 schema.ts 转换为 schema.json');
};
const dump_debounced = _.debounce(dump, 500, { leading: true, trailing: false });
function schema_dump(compiler: webpack.Compiler) {
  if (!compiler.options.watch) {
    dump_debounced();
    return;
  }
  if (!watcher) {
    watcher = watch('src', {
      awaitWriteFinish: true,
      interval: 1000,
      usePolling: use_polling,
    }).on('all', (_event, path) => {
      if (path.endsWith('schema.ts')) {
        dump_debounced();
      }
    });
  }
}

let child_process: ChildProcess | undefined;
let tavern_sync_signal_handlers_registered = false;
const stop_tavern_sync = () => {
  child_process?.kill();
  child_process = undefined;
};
const bundle = () => {
  exec('pnpm sync bundle all', { cwd: import.meta.dirname });
  console.info('\x1b[36m[tavern_sync]\x1b[0m 已打包所有配置了的角色卡/世界书/预设');
};
const bundle_debounced = _.debounce(bundle, 500, { leading: true, trailing: false });
function tavern_sync(compiler: webpack.Compiler) {
  if (!compiler.options.watch) {
    bundle_debounced();
    return;
  }
  compiler.hooks.watchRun.tap('watch_tavern_sync', () => {
    if (!child_process) {
      child_process = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['sync', 'watch', 'all', '-f'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: import.meta.dirname,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
          ...(use_polling ? { CHOKIDAR_USEPOLLING: 'true' } : {}),
        },
      });
      child_process.stdout?.on('data', (data: Buffer) => {
        console.info(
          data
            .toString()
            .trimEnd()
            .split('\n')
            .map(string => (/^\s*$/s.test(string) ? string : `\x1b[36m[tavern_sync]\x1b[0m ${string}`))
            .join('\n'),
        );
      });
      child_process.stderr?.on('data', (data: Buffer) => {
        console.error(
          data
            .toString()
            .trimEnd()
            .split('\n')
            .map(string => (/^\s*$/s.test(string) ? string : `\x1b[36m[tavern_sync]\x1b[0m ${string}`))
            .join('\n'),
        );
      });
      child_process.on('error', error => {
        console.error(`\x1b[31m[tavern_sync]\x1b[0m Error: ${error.message}`);
      });
      child_process.on('exit', () => {
        child_process = undefined;
      });
    }
  });
  compiler.hooks.watchClose.tap('watch_tavern_sync', () => {
    stop_tavern_sync();
  });
  if (!tavern_sync_signal_handlers_registered) {
    ['SIGINT', 'SIGTERM'].forEach(signal => {
      process.on(signal, stop_tavern_sync);
    });
    tavern_sync_signal_handlers_registered = true;
  }
}

function parse_configuration(entry: Entry, is_release = false): (_env: any, argv: any) => webpack.Configuration {
  const should_obfuscate = fs
    .readFileSync(path.join(import.meta.dirname, entry.script), 'utf-8')
    .includes('@obfuscate');
  const script_filepath = path.parse(entry.script);

  return (_env, argv) => ({
    experiments: {
      outputModule: true,
    },
    devtool: is_release ? false : argv.mode === 'production' ? 'source-map' : 'eval-source-map',
    watchOptions: {
      ignored: ['**/dist', '**/node_modules'],
      poll: use_polling ? 1000 : undefined,
    },
    entry: path.join(import.meta.dirname, entry.script),
    target: 'browserslist',
    output: is_release
      ? {
          filename: 'bundle.js',
          path: path.join(import.meta.dirname, 'artifact'),
          clean: true,
          library: {
            type: 'module',
          },
        }
      : {
          devtoolNamespace: 'tavern_helper_template',
          devtoolModuleFilenameTemplate: info => {
            const resource_path = decodeURIComponent(info.resourcePath.replace(/^\.\//, ''));
            const is_direct = info.allLoaders === '';
            const is_vue_script =
              resource_path.match(/\.vue$/) &&
              info.query.match(/\btype=script\b/) &&
              !info.allLoaders.match(/\bts-loader\b/);

            return `${is_direct === true ? 'src' : 'webpack'}://${info.namespace}/${resource_path}${is_direct || is_vue_script ? '' : '?' + info.hash}`;
          },
          filename: `${script_filepath.name}.js`,
          path: path.join(
            import.meta.dirname,
            'dist',
            path.relative(import.meta.dirname, script_filepath.dir).replace(/^[^\\/]+[\\/]/, ''),
          ),
          chunkFilename: `${script_filepath.name}.[contenthash].chunk.js`,
          asyncChunks: true,
          clean: true,
          publicPath: '',
          library: {
            type: 'module',
          },
        },
    module: {
      rules: [
        {
          test: /\.vue$/,
          use: 'vue-loader',
          exclude: /node_modules/,
        },
        {
          // `@era/vibeflow-expression` is a versioned local source package. It
          // deliberately publishes its TypeScript engine so the expression
          // root remains the single implementation; transpile that one package
          // while keeping the rest of node_modules outside the application
          // TypeScript loader.
          test: /\.tsx?$/,
          include: fs.realpathSync(path.join(import.meta.dirname, 'node_modules/@era/vibeflow-expression')),
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            onlyCompileBundledFiles: true,
            compilerOptions: {
              noUnusedLocals: false,
              noUnusedParameters: false,
            },
          },
        },
        {
          oneOf: [
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                },
                getCustomTransformers: (program: ts.Program) => ({
                  before: [get_logger_transformer(program)],
                }),
              },
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              test: /\.(sa|sc)ss$/,
              use: ['postcss-loader', 'sass-loader'],
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              test: /\.css$/,
              use: ['postcss-loader'],
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              resourceQuery: /raw/,
              type: 'asset/source',
              exclude: /node_modules/,
            },
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                },
                getCustomTransformers: (program: ts.Program) => ({
                  before: [get_logger_transformer(program)],
                }),
              },
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              test: /\.(sa|sc)ss$/,
              use: ['postcss-loader', 'sass-loader'],
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              test: /\.css$/,
              use: ['postcss-loader'],
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              resourceQuery: /url/,
              type: 'asset/inline',
              exclude: /node_modules/,
            },
            {
              test: /\.tsx?$/,
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                },
                getCustomTransformers: (program: ts.Program) => ({
                  before: [get_logger_transformer(program)],
                }),
              },
              exclude: /node_modules/,
            },
            {
              test: /\.html$/,
              use: 'html-loader',
              exclude: /node_modules/,
            },
            {
              test: /\.md$/,
              use: [
                {
                  loader: 'html-loader',
                },
                {
                  loader: 'remark-loader',
                  options: {
                    remarkOptions: {
                      plugins: [RemarkHTML],
                    },
                  },
                },
              ],
            },
            {
              test: /\.ya?ml$/,
              loader: 'yaml-loader',
              options: { asStream: true },
              resourceQuery: /stream/,
            },
            {
              test: /\.ya?ml$/,
              loader: 'yaml-loader',
            },
          ].concat(
            entry.html === undefined
              ? ([
                  {
                    test: /\.vue\.s(a|c)ss$/,
                    use: [
                      { loader: 'vue-style-loader', options: { ssrId: true } },
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                      'sass-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    test: /\.vue\.css$/,
                    use: [
                      { loader: 'vue-style-loader', options: { ssrId: true } },
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    // 外置 Vue <style src> 仍属于组件样式，必须带搬运标记才能进入酒馆宿主。
                    test: /\.css$/,
                    resourceQuery: /[?&]type=style(?:&|$)/,
                    use: [
                      { loader: 'vue-style-loader', options: { ssrId: true } },
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    test: /\.s(a|c)ss$/,
                    use: [
                      'style-loader',
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                      'sass-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    test: /\.css$/,
                    use: ['style-loader', { loader: 'css-loader', options: { url: false } }, 'postcss-loader'],
                    exclude: /node_modules/,
                  },
                ] as any[])
              : ([
                  {
                    test: /\.s(a|c)ss$/,
                    use: [
                      MiniCssExtractPlugin.loader,
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                      'sass-loader',
                    ],
                    exclude: /node_modules/,
                  },
                  {
                    test: /\.css$/,
                    use: [
                      MiniCssExtractPlugin.loader,
                      { loader: 'css-loader', options: { url: false } },
                      'postcss-loader',
                    ],
                    exclude: /node_modules/,
                  },
                ] as any[]),
          ),
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.tsx', '.jsx', '.css'],
      // Generated Service AOT lives above `app/`, but its browser-only runtime
      // dependencies are owned by this application package. Resolve those
      // dependencies from here so the explicitly bundled expression backends
      // do not fall back to a network ESM import.
      modules: [path.resolve(import.meta.dirname, 'node_modules'), 'node_modules'],
      plugins: [
        new TsconfigPathsPlugin({
          extensions: ['.ts', '.js', '.tsx', '.jsx'],
          configFile: path.join(import.meta.dirname, 'tsconfig.webpack.json'),
        }),
      ],
      alias: {
        ERA变量框架: path.resolve(import.meta.dirname, 'src/ERA变量框架'),
        '@era/vibeflow-macro$': path.resolve(import.meta.dirname, '../generated/era-macro/era-macro.js'),
        // VibeFlow JavaScript AOT 的稳定浏览器入口是 workflow.js；测试与运行探针
        // 已使用同一入口，生产 webpack 不能继续指向已废弃的 era-service.js。
        '@era/vibeflow-service$': path.resolve(import.meta.dirname, '../generated/era-service/workflow.js'),
      },
    },
    plugins: (is_release
      ? []
      : entry.html === undefined
        ? [new MiniCssExtractPlugin()]
        : [
            new HtmlWebpackPlugin({
              template: path.join(import.meta.dirname, entry.html),
              filename: path.parse(entry.html).base,
              scriptLoading: 'module',
              cache: false,
            }),
            new HtmlInlineScriptWebpackPlugin(),
            new MiniCssExtractPlugin(),
            new HTMLInlineCSSWebpackPlugin({
              styleTagFactory({ style }: { style: string }) {
                return `<style>${style}</style>`;
              },
            }),
          ]
    )
      .concat(
        ...(is_release ? [] : [{ apply: watch_tavern_helper }, { apply: schema_dump }, { apply: tavern_sync }]),
        ...(path.resolve(import.meta.dirname, entry.script) === ERA_PRODUCTION_ENTRY
          ? [new EraProductionDependencyGuardPlugin()]
          : []),
        new VueLoaderPlugin(),
        unpluginAutoImport({
          dts: true,
          dtsMode: 'overwrite',
          imports: [
            'vue',
            'pinia',
            '@vueuse/core',
            { from: 'dedent', imports: [['default', 'dedent']] },
            { from: 'klona', imports: ['klona'] },
            { from: 'vue-final-modal', imports: ['useModal'] },
            { from: 'zod', imports: ['z'] },
            { from: 'type-fest', imports: [['*', 'TypeFest']], type: true },
          ],
        }),
        unpluginVueComponents({
          dts: true,
          syncMode: 'overwrite',
          // globs: ['src/panel/component/*.vue'],
          resolvers: [VueUseComponentsResolver(), VueUseDirectiveResolver()],
        }),
        new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
        new webpack.DefinePlugin({
          __VUE_OPTIONS_API__: false,
          __VUE_PROD_DEVTOOLS__: process.env.CI !== 'true',
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),
      )
      .concat(
        should_obfuscate
          ? [
              new WebpackObfuscator({
                controlFlowFlattening: true,
                numbersToExpressions: true,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                seed: 1,
              }),
            ]
          : [],
      ),
    optimization: {
      minimize: true,
      minimizer: [
        argv.mode === 'production'
          ? new TerserPlugin({
              terserOptions: { format: { quote_style: 1 }, mangle: { reserved: ['_', 'toastr', 'YAML', '$', 'z'] } },
            })
          : new TerserPlugin({
              extractComments: false,
              terserOptions: {
                format: { beautify: true, indent_level: 2 },
                compress: false,
                mangle: false,
              },
            }),
      ],
      splitChunks: {
        chunks: 'async',
        minSize: 20000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
          },
          default: {
            name: 'default',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    },
    externals: ({ context, request }, callback) => {
      if (!context || !request) {
        return callback();
      }

      if (
        request.startsWith('ERA变量框架') ||
        request === '@era/vibeflow-macro' ||
        request === '@era/vibeflow-service' ||
        request === '@era/example-resources' ||
        request.startsWith('-') ||
        request.startsWith('.') ||
        request.startsWith('/') ||
        request.startsWith('!') ||
        request.startsWith('http') ||
        request.startsWith('@/') ||
        request.startsWith('@util/') ||
        path.isAbsolute(request) ||
        fs.existsSync(path.join(context, request)) ||
        fs.existsSync(request)
      ) {
        return callback();
      }

      if (
        ['vue', 'vue-router'].every(key => request !== key) &&
        ['pixi', 'react', 'vue'].some(key => request.includes(key))
      ) {
        return callback();
      }
      // ERA 表达式引擎必须在离线酒馆与隔离 Harness 中可启动。数学后端及
      // 其传递依赖若被外置为 CDN ESM，会在模块执行入口前失败，因此作为
      // 一个完整的本地运行时链随生产 bundle 发布，而不是依赖浏览器网络。
      const expressionRuntimeContext = [
        '/node_modules/mathjs/',
        '/node_modules/@stdlib/',
        '/node_modules/typed-function/',
        '/node_modules/complex.js/',
        '/node_modules/decimal.js/',
        '/node_modules/fraction.js/',
        '/node_modules/seedrandom/',
      ];
      if (
        request === '@era/vibeflow-expression' ||
        request.startsWith('@era/vibeflow-expression/') ||
        request === '@era/vibeflow-floor-snapshot' ||
        request.startsWith('@era/vibeflow-floor-snapshot/') ||
        request === 'mathjs' ||
        request.startsWith('mathjs/') ||
        request === '@stdlib/math-base-special-gamma' ||
        expressionRuntimeContext.some(segment => context.includes(segment))
      ) {
        return callback();
      }
      const global = {
        jquery: '$',
        lodash: '_',
        showdown: 'showdown',
        toastr: 'toastr',
        vue: 'Vue',
        'vue-router': 'VueRouter',
        yaml: 'YAML',
        zod: 'z',
        // Math.js 的随机数兼容分支会可选引用 Node `crypto`。浏览器只需
        // 原生 Web Crypto 全局，不应留下会被隔离酒馆 loader 拒绝的 CDN import。
        crypto: 'crypto',
      };
      if (request in global) {
        return callback(null, 'var ' + global[request as keyof typeof global]);
      }
      const cdn = {
        sass: 'https://jspm.dev/sass',
      };
      const package_json = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf-8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const package_versions = { ...package_json.devDependencies, ...package_json.dependencies };
      const version = package_versions[request]?.replace(/^[~^]/, '');
      const versioned_request = /^[.\d]+$/.test(version) ? `${request}@${version}` : request;
      return callback(
        null,
        'module-import ' +
          (cdn[request as keyof typeof cdn] ?? `https://testingcf.jsdelivr.net/npm/${versioned_request}/+esm`),
      );
    },
  });
}

const is_release = process.env.npm_lifecycle_event === 'release';

export default is_release
  ? [
      parse_configuration(
        {
          script: 'src/ERA变量框架/index.ts',
        },
        true,
      ),
    ]
  : config.entries.map(entry => parse_configuration(entry, false));
