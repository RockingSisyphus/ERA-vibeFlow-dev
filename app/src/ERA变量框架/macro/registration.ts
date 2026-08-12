import { getEraData, removeMetaFields } from '../utils/era_data';
import { unescapeEraData } from '../utils/data';
import { Logger } from '../utils/log';
import { createEraMacroRegex, type EraMacroSnapshot } from './syntax';
import { runEraMacroWorkflow } from './vibeflow-adapter';

const logger = new Logger('MacroRegistration');

/**
 * 把 ERA 内部存储格式转换为宏作者应看到的快照。
 *
 * ERA 为了安全写入消息会转义键和值中的点号与引号；宏属于公开读取界面，
 * 必须与既有查询 API 一样先反转义，否则作者会在提示词中看到内部占位符。
 */
export function createEraMacroSnapshot(storedStat: unknown): EraMacroSnapshot {
  const statWithMeta = unescapeEraData(storedStat);
  return {
    statWithMeta,
    statWithoutMeta: removeMetaFields(statWithMeta),
  };
}

/**
 * 同步读取一份完整的宏快照。
 *
 * 生成栅栏会在酒馆开始构建提示词前结算已有状态任务；宏回调随后
 * 同步调用本函数，读到的就是栅栏释放后的状态，不再依赖异步查询事件。
 */
export function readCurrentEraMacroSnapshot(): EraMacroSnapshot {
  return createEraMacroSnapshot(getEraData().stat);
}

/**
 * 向酒馆助手注册 ERA 宏，并返回幂等的卸载函数。
 *
 * 酒馆助手负责遍历全部 role 及多模态消息中的文本片段，因此这里
 * 不再监听 `GENERATE_AFTER_DATA`，也不会自行筛选 system/user 等角色。
 */
export function registerEraMacro(): () => void {
  const macroRegex = createEraMacroRegex();
  const { unregister } = registerMacroLike(macroRegex, (_context, substring) => {
    const storedStat = getEraData().stat;
    return runEraMacroWorkflow(substring, {
      kind: 'present',
      value: storedStat,
    });
  });

  let registered = true;
  logger.log('registerEraMacro', '已通过酒馆助手注册 ERA 宏。');

  return () => {
    if (!registered) {
      return;
    }

    registered = false;
    unregister();
    logger.log('registerEraMacro', '已取消注册 ERA 宏。');
  };
}
