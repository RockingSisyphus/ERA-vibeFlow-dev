import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@era/vibeflow-macro': new URL('../generated/era-macro/era-macro.js', import.meta.url).pathname,
      '@era/vibeflow-tavern': new URL('../javascript_project/tavern/generated/bindings.mjs', import.meta.url).pathname,
      '@era/vibeflow-tavern-sync': new URL('../generated/era-tavern/sync/workflow.js', import.meta.url).pathname,
      '@era/vibeflow-tavern-async': new URL('../generated/era-tavern/async/workflow.js', import.meta.url).pathname,
      '@era/vibeflow-tavern-runtime': new URL('../generated/era-tavern/runtime/workflow.js', import.meta.url).pathname,
      '@era/vibeflow-service': new URL('../generated/era-service/workflow.js', import.meta.url).pathname,
    },
  },
});
