import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@era/vibeflow-macro': new URL('../generated/era-macro/era-macro.js', import.meta.url).pathname,
      '@era/vibeflow-service': new URL('../generated/era-service/workflow.js', import.meta.url).pathname,
    },
  },
});
