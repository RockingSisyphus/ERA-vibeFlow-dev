/** 探针共用的生成物加载：字节不变，依赖来自App，临时副本只留本仓。 */
import { mkdir, mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL, URL as ResourceURL } from 'node:url';
import { resolve } from 'node:path';

export async function importGeneratedService(source) {
  const reports = fileURLToPath(new ResourceURL('../../reports/', import.meta.url));
  await mkdir(reports, { recursive: true });
  const directory = await mkdtemp(resolve(reports, '.service-probe-'));
  const onExit = () => rmSync(directory, { recursive: true, force: true });
  process.once('exit', onExit);
  const cleanup = async () => {
    process.removeListener('exit', onExit);
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await symlink(
      fileURLToPath(new ResourceURL('../node_modules', import.meta.url)),
      resolve(directory, 'node_modules'),
      'dir',
    );
    const entry = resolve(directory, 'workflow.mjs');
    await writeFile(entry, await readFile(source));
    return { workflow: await import(pathToFileURL(entry).href), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** 使用Node加载已编译AOT，避免测试转换器再次处理整份分发代码。 */
export async function importBuiltWorkflow(url) {
  const staged = await importGeneratedService(new ResourceURL(url));
  try {
    return staged.workflow;
  } finally {
    await staged.cleanup();
  }
}
