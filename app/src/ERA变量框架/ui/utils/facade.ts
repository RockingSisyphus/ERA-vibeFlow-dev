import { getInstalledEraPublicApi, type EraFacade } from '../../service/public-api';

/**
 * Tavern Helper 的等待函数只负责在当前 iframe realm 安装全局 getter，
 * Promise 本身不返回 Facade。所有 UI 调用统一经此处等待后读取 ERA，避免
 * 把 void 误当成公共对象。
 */
export async function waitForEraFacade(): Promise<EraFacade> {
  return getInstalledEraPublicApi();
}
