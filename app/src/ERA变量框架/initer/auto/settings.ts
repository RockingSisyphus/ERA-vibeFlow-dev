import { updateScriptSettings, initEraSettings } from '../../utils/era_data';
import { Logger } from '../../utils/log';

const logger = new Logger();
let initializationPromise: Promise<void> | null = null;

/**
 * 初始化脚本的外部设置变量。
 * 该函数会确保所有设置都存在，如果不存在则使用默认值。同一脚本实例中的并发调用
 * 共用一条 Promise，避免 document-ready 与 APP_READY 同时触发两次变量写入。
 */
export function initializeExternalSettings(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    initEraSettings();
    logger.log('initializeExternalSettings', '开始初始化脚本设置...');
    await updateScriptSettings(async settings => {
      logger.debug('initializeExternalSettings', '当前设置:', settings);
      return settings;
    });
    logger.log('initializeExternalSettings', '脚本设置初始化完成。');
  })().catch(error => {
    // 初始化失败后允许后续 APP_READY 重试；同时把同一个异常交给所有等待者。
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}
