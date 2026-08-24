import { unescapeEraData } from '../ERA变量框架/utils/data';
import { getEraData, removeMetaFields } from '../ERA变量框架/utils/era_data';
import { Logger } from '../ERA变量框架/utils/log';

const logger = new Logger('LogTest-MacroParser');

/**
 * 解析字符串中的 ERA 宏, 并将其替换为对应的变量值。
 * 这是提供给其他模块调用的公共接口。
 * @param text - 包含宏的输入字符串。
 * @param stat_data - 可选的，用于宏替换的特定变量快照。如果未提供，则使用最新的全局状态。
 * @returns - 替换宏后的字符串。
 */
export function parseEraMacros(text: string, statWithMeta?: object | null, statWithoutMeta?: object | null): string {
  const macroRegex = /{{\s*ERA(-withmeta)?\s*:\s*([^}]+?)\s*}}/gi;

  if (!text.includes('{{ERA')) {
    return text;
  }

  // 如果没有提供特定的 stat，则从全局获取
  const finalStatWithMeta = statWithMeta ?? getEraData().stat;
  const finalStatWithoutMeta = statWithoutMeta ?? removeMetaFields(getEraData().stat);

  return text.replace(macroRegex, (substring, withMeta, path) => {
    const funcName = 'parseEraMacros';
    const trimmedPath = path.trim();
    const includeMeta = !!withMeta;

    // 根据用户要求，选择正确的数据源
    const statToUse = includeMeta ? finalStatWithMeta : finalStatWithoutMeta;

    if (!statToUse) {
      logger.warn(funcName, `无法获取到宏替换所需的数据 (includeMeta: ${includeMeta})`);
      return substring; // 返回原始宏以避免破坏内容
    }

    let data;
    if (trimmedPath === '$ALLDATA') {
      data = statToUse;
    } else {
      data = _.get(statToUse, trimmedPath);
    }

    if (data === undefined) {
      logger.warn(funcName, `在数据源中未找到路径 "${trimmedPath}", 宏将替换为空字符串.`);
      return ''; // 路径未找到, 返回空字符串
    }

    // 因为我们已经从正确的数据源获取了数据，所以不再需要在这里手动移除 meta 字段
    // 直接反转义即可
    const finalData = unescapeEraData(data);

    logger.debug(funcName, `宏替换数据反转义: ${trimmedPath}`, {
      before: data,
      after: finalData,
    });

    if (typeof finalData === 'object' && finalData !== null) {
      return JSON.stringify(finalData);
    }

    return String(finalData);
  });
}

/**
 * 在发送到 AI 的数据准备好后，处理其中的 ERA 宏。
 * @param generate_data - 包含提示词的对象。
 * @param dry_run - 是否为演习运行。
 */
const handleGenerateAfterData = async (generate_data: { prompt: SillyTavern.SendingMessage[] }, dry_run: boolean) => {
  if (dry_run) {
    return;
  }

  // 检查提示中是否真的有宏，没有就直接返回，避免不必要的事件开销
  const hasMacro = generate_data.prompt.some(p => typeof p.content === 'string' && p.content.includes('{{ERA'));

  if (!hasMacro) {
    return;
  }

  await waitGlobalInitialized('ERA');
  const snapshot = ERA.get();
  for (const message of generate_data.prompt) {
    if (typeof message.content !== 'string' || !message.content.includes('{{ERA')) continue;
    const originalContent = message.content;
    message.content = parseEraMacros(
      originalContent,
      snapshot.stat as object | null,
      snapshot.statWithoutMeta as object | null,
    );
    if (originalContent !== message.content) {
      logger.log('handleGenerateAfterData', `成功替换了 role: ${message.role} 消息中的 ERA 宏。`);
    }
  }
};

$(() => {
  console.log('日志测试脚本已加载。');

  // 监听 `GENERATE_AFTER_DATA` 事件，在提示词发送前处理 ERA 宏
  eventOn(tavern_events.GENERATE_AFTER_DATA, handleGenerateAfterData);

  // 在卸载时清理监听器。
  $(window).on('pagehide', () => {
    eventRemoveListener(tavern_events.GENERATE_AFTER_DATA, handleGenerateAfterData);
  });
});
