import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

/** 普通运行、定向运行和watch复跑共用同一个正式子图构建入口。 */
export default function setup(project: TestProject) {
  const build = () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('../../scripts/build-service-test-workflows.mjs', import.meta.url))],
      { stdio: 'inherit', env: process.env },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error('Service行为子图构建失败，请查看reports/service-test-workflows中的原始日志。');
  };
  build();
  project.onTestsRerun(build);
}
