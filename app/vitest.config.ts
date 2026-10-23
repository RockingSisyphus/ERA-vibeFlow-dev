import { defineConfig, configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const reports = fileURLToPath(new URL('../reports/', import.meta.url));
mkdirSync(reports, { recursive: true });
const temporary = mkdtempSync(reports + '.vitest-');
process.once('exit', () => rmSync(temporary, { recursive: true, force: true }));

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'era-service-behavior-sources',
      configureServer(server) {
        server.watcher.add(
          [
            'javascript_project/service',
            'base_lib',
            'packages',
            'project_rules.jsonc',
            'vibeflow_config.jsonc',
            'DISTRIBUTION.json',
            'app/scripts/build-service-test-workflows.mjs',
          ].map(path => fileURLToPath(new URL('../' + path, import.meta.url))),
        );
      },
    },
  ],
  server: { watch: { ignored: ['**/reports/**', '**/configs/.test-*.jsonc', '**/ARCHITECTURE.jsonc'] } },
  test: {
    // AOT与Vue模块较大；限制并行加载，避免共享机器上冷导入挤占单项断言时间。
    maxWorkers: 4,
    globalSetup: ['./tests/service/workflow-global-setup.ts'],
    forceRerunTriggers: [
      ...configDefaults.forceRerunTriggers,
      '**/javascript_project/service/**',
      '**/base_lib/**',
      '**/packages/**',
      '**/project_rules.jsonc',
      '**/vibeflow_config.jsonc',
      '**/DISTRIBUTION.json',
      '**/app/scripts/build-service-test-workflows.mjs',
    ],
    env: { TMPDIR: temporary, TMP: temporary, TEMP: temporary },
  },
  resolve: {
    alias: {
      '@era/vibeflow-macro': new URL('../generated/era-macro/era-macro.js', import.meta.url).pathname,
      '@era/vibeflow-tavern': new URL('../javascript_project/tavern/generated/bindings.mjs', import.meta.url).pathname,
      '@era/vibeflow-tavern-sync': new URL('../generated/era-tavern/sync/workflow.js', import.meta.url).pathname,
      '@era/vibeflow-tavern-async': new URL('../generated/era-tavern/async/workflow.js', import.meta.url).pathname,
      '@era/vibeflow-service': new URL('../generated/era-service/workflow.js', import.meta.url).pathname,
    },
  },
});
