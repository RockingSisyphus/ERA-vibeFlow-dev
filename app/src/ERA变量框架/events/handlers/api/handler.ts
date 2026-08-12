/**
 * @file ERA 变量框架 - 外部事件 API 实现模块
 * @description
 * 该模块是 ERA 框架与外部脚本交互的接口层。它实现了一系列自定义事件的处理器。
 *
 * **设计理念**:
 * ERA 框架不直接向外暴露函数调用接口。外部脚本与 ERA 交互的**唯一**方式是通过酒馆的
 * `eventEmit(eventName, eventData)` 函数，发送特定格式的事件。
 *
 * `index.ts` 模块会监听这些 `era:*` 前缀的事件，并将其推入 `event_queue.ts` 中进行处理。
 * 事件队列最终会调用本文件中对应的处理器函数（如 `insertByObject`）。
 *
 * 写入类函数会在最新的 AI 消息末尾动态注入 `<VariableInsert>`、`<VariableEdit>`
 * 或 `<VariableDelete>` 指令块。API dispatcher 随后在同一个领域任务中直接完成 ERA 同步，
 * 使原 API Ticket 与真实状态提交保持同一条因果链。
 */

import { getStatAtMK, getStatsBetweenMKs } from '../../../core/snapshot';
import { SEL_PATH } from '../../../utils/constants';
import { J, unescapeEraData } from '../../../utils/data';
import { getEraData, removeMetaFields } from '../../../utils/era_data';
import { Logger } from '../../../utils/log';
import { findLastAiMessage, getMessageContent, isUserMessage, updateMessageContent } from '../../../utils/message';
import { emitQueryResultEvent, replayLastWriteDoneEvent } from '../../emitters/events';
import type { ActionsTaken, DispatcherPayload, PostCommitNotification } from '../../types';
import { handleSyncEvent, type SyncExecutionRequest } from '../sync';

const logger = new Logger();

// API 写入任务的接口定义
interface ApiWriteJob {
  blockTag: 'VariableInsert' | 'VariableEdit' | 'VariableDelete';
  blockContent: object;
}

// ==================================================================
// API 事件参考
// (事件名称的常量定义见于 `constants.ts` 中的 `ERA_API_EVENTS` 对象)
// ==================================================================

/**
 * @section API Event: 'era:insertByObject'
 * @description 通过一个对象，非破坏性地插入新变量。只会写入不存在的路径。
 * @param {object} detail - 要插入的变量对象。
 * @example
 * eventEmit('era:insertByObject', {
 *   player: { name: "勇者", hp: 100, inventory: [] }
 * });
 */

/**
 * @section API Event: 'era:updateByObject'
 * @description 通过一个对象，修改已存在的变量。如果路径不存在，则忽略。
 * @param {object} detail - 要更新的变量对象。
 * @example
 * eventEmit('era:updateByObject', {
 *   player: { hp: 120, status: 'blessed' }
 * });
 */

/**
 * @section API Event: 'era:insertByPath'
 * @description 通过指定路径和值，非破坏性地插入一个新变量。
 * @param {object} detail - 包含路径和值的对象。
 * @param {string} detail.path - 变量的路径，使用点或方括号表示法。
 * @param {*} detail.value - 要插入的值。
 * @example
 * eventEmit('era:insertByPath', {
 *   path: 'player.inventory[0]',
 *   value: { name: '生命药水', count: 3 }
 * });
 */

/**
 * @section API Event: 'era:updateByPath'
 * @description 通过指定路径和值，修改一个已存在的变量。
 * @param {object} detail - 包含路径和值的对象。
 * @param {string} detail.path - 变量的路径。
 * @param {*} detail.value - 要设置的新值。可以是直接的值，也可以是运算表达式。
 * @example
 * eventEmit('era:updateByPath', {
 *   path: 'player.hp',
 *   value: '+=10'
 * });
 */

/**
 * @section API Event: 'era:deleteByObject'
 * @description 通过一个对象，删除已存在的变量。
 * @param {object} detail - 描述要删除路径的结构。值的结构决定了删除行为。
 * @example
 * // 准备删除 player.gold。指令中 gold 的值必须是空对象 {}
 * eventEmit('era:deleteByObject', { player: { gold: {} } });
 *
 * // 准备删除整个 player 对象。
 * eventEmit('era:deleteByObject', { player: {} });
 *
 * // **重要**: 如果 player 对象包含 gold 和 mana 两个属性，
 * // 以下指令只会删除 gold 和 mana，而 player 对象本身会被保留（变为空对象）。
 * // 这与 `eventEmit('era:deleteByObject', { player: {} })` 的效果是不同的。
 * eventEmit('era:deleteByObject', { player: { gold: {}, mana: {} } });
 */

/**
 * @section API Event: 'era:deleteByPath'
 * @description 通过指定路径，删除一个已存在的变量。
 * @param {object} detail - 包含路径的对象。
 * @param {string} detail.path - 要删除的变量的路径。
 * @example
 * eventEmit('era:deleteByPath', { path: 'player.inventory[0]' });
 */

// ==================================================================
// 内部核心函数
// ==================================================================

/**
 * 在聊天记录中查找并返回最后一条由 AI 发送的消息。
 * 这是注入变量修改指令的目标消息。
 * @returns {Promise<any | null>} 返回找到的消息对象，如果不存在 AI 消息则返回 null。
 */

/**
 * 执行一次 API 写入操作。
 * 它将指定的变量修改块追加到最后一条 AI 消息的末尾，并返回被修改的消息 ID。
 *
 * 状态同步不在本函数中另行排队。API dispatcher 会在同一领域任务内根据该消息 ID
 * 完成重算；这样原 API Ticket 只有在 ERA 状态真正提交后才会完成。
 * @param {ApiWriteJob} job - 要执行的写入任务。
 */
async function performApiWrite(job: ApiWriteJob): Promise<number> {
  // 1. 生成指令块
  const contentString = J(job.blockContent);
  const block = `\n<${job.blockTag}>\n${contentString}\n</${job.blockTag}>`;

  // 2. 查找目标消息并追加内容
  const lastAiMessage = await findLastAiMessage();
  if (!lastAiMessage) {
    throw new Error('找不到任何 AI 消息，无法执行 API 写入。');
  }

  const originalContent = getMessageContent(lastAiMessage) ?? '';
  const newContent = originalContent + block;

  logger.debug('performApiWrite', `实时写入 API 任务 (${job.blockTag}) 到消息 ID ${lastAiMessage.message_id}...`);

  // 3. 实时更新消息内容
  await updateMessageContent(lastAiMessage, newContent);

  return lastAiMessage.message_id;
}

// ==================================================================
// 事件处理器实现 (由 event_queue.ts 调用)
// ==================================================================

/**
 * **【处理器】** 处理 `era:insertByObject` 事件。
 * @param {object} data - 从事件的 `detail` 中获取的变量对象。
 */
export function insertByObject(data: object): Promise<number> {
  return performApiWrite({ blockTag: 'VariableInsert', blockContent: data });
}

/**
 * **【处理器】** 处理 `era:updateByObject` 事件。
 * @param {object} data - 从事件的 `detail` 中获取的变量对象。
 */
export function updateByObject(data: object): Promise<number> {
  return performApiWrite({ blockTag: 'VariableEdit', blockContent: data });
}

/**
 * **【处理器】** 处理 `era:insertByPath` 事件。
 * @param {string} path - 从事件 `detail` 的 `path` 属性获取。
 * @param {*} value - 从事件 `detail` 的 `value` 属性获取。
 */
export function insertByPath(path: string, value: any): Promise<number> {
  const block = _.set({}, path, value);
  return performApiWrite({ blockTag: 'VariableInsert', blockContent: block });
}

/**
 * **【处理器】** 处理 `era:updateByPath` 事件。
 * @param {string} path - 从事件 `detail` 的 `path` 属性获取。
 * @param {*} value - 从事件 `detail` 的 `value` 属性获取。
 */
export function updateByPath(path: string, value: any): Promise<number> {
  const block = _.set({}, path, value);
  return performApiWrite({ blockTag: 'VariableEdit', blockContent: block });
}

/**
 * **【处理器】** 处理 `era:deleteByObject` 事件。
 * @param {object} data - 从事件的 `detail` 中获取的变量结构。
 */
export function deleteByObject(data: object): Promise<number> {
  return performApiWrite({ blockTag: 'VariableDelete', blockContent: data });
}

/**
 * **【处理器】** 处理 `era:deleteByPath` 事件。
 * @param {string} path - 从事件 `detail` 的 `path` 属性获取。
 */
export function deleteByPath(path: string): Promise<number> {
  // 对于删除操作，我们用一个空对象作为值来表示删除该路径的意图
  const block = _.set({}, path, {});
  return performApiWrite({ blockTag: 'VariableDelete', blockContent: block });
}

/**
 * **【处理器】** 处理 `era:getCurrentVars` 事件。
 * 获取当前最新的变量状态，并通过 `era:queryResult` 事件发回结果。
 * @param {any} detail - 原始请求的 detail 对象。
 */
export function handleGetCurrentVars(detail: any): PostCommitNotification {
  logger.debug('handleGetCurrentVars', `请求获取当前变量。`);
  let result: any;
  try {
    const { stat, meta } = getEraData();
    const selectedMks: (string | null)[] = _.get(meta, SEL_PATH, []);
    const lastMk = selectedMks[selectedMks.length - 1] || '';
    const lastMessageId = selectedMks.length - 1;
    const messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
    const lastMessage = messages[lastMessageId];

    result = {
      mk: lastMk,
      message_id: lastMessageId,
      is_user: lastMessage ? isUserMessage(lastMessage) : false,
      stat: unescapeEraData(stat),
      statWithoutMeta: unescapeEraData(removeMetaFields(stat)),
    };
  } catch (error) {
    const errorMessage = `获取当前变量时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('handleGetCurrentVars', errorMessage);
    result = { error: errorMessage };
  }
  return () => emitQueryResultEvent('getCurrentVars', detail, result);
}

/**
 * **【处理器】** 处理 `era:getSnapshotAtMk` 事件。
 * 计算指定 MK 的历史快照，并通过 `era:queryResult` 事件发回结果。
 * @param {any} detail - 从事件中获取的 `detail` 对象，应包含 `mk`。
 */
export function handleGetSnapshotAtMk(detail: any): PostCommitNotification {
  logger.debug('handleGetSnapshotAtMk', `请求获取历史快照...`);
  let result: any;
  try {
    const mk = detail?.mk;
    if (!mk) {
      throw new Error('请求缺少 "mk" 参数。');
    }

    logger.debug('handleGetSnapshotAtMk', `MK: ${mk}`);
    const stat = getStatAtMK(mk);

    if (stat) {
      const { meta } = getEraData();
      const selectedMks: (string | null)[] = _.get(meta, SEL_PATH, []);
      const message_id = selectedMks.indexOf(mk);
      const messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
      const message = messages[message_id];

      result = {
        mk,
        message_id,
        is_user: message ? isUserMessage(message) : false,
        stat: unescapeEraData(stat),
        statWithoutMeta: unescapeEraData(removeMetaFields(stat)),
      };
    } else {
      const errorMessage = `找不到 MK "${mk}" 对应的快照。`;
      logger.warn('handleGetSnapshotAtMk', errorMessage);
      result = { error: errorMessage, stat: null };
    }
  } catch (error) {
    const errorMessage = `获取快照时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('handleGetSnapshotAtMk', errorMessage);
    result = { error: errorMessage };
  }
  return () => emitQueryResultEvent('getSnapshotAtMk', detail, result);
}

/**
 * **【处理器】** 处理 `era:getSnapshotsBetweenMks` 事件。
 * 计算两个 MK 之间的所有历史快照，并通过 `era:queryResult` 事件发回结果数组。
 * @param {any} detail - 从事件中获取的 `detail` 对象，应包含 `startMk` 和 `endMk`。
 */
export function handleGetSnapshotsBetweenMks(detail: any): PostCommitNotification {
  const { startMk, endMk } = detail || {};
  logger.debug('handleGetSnapshotsBetweenMks', `请求获取批量快照，从: ${startMk || '开始'}, 到: ${endMk || '结束'}`);
  let finalResult: any;

  try {
    const results = getStatsBetweenMKs(startMk, endMk);

    if (results) {
      const messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
      finalResult = results.map(item => {
        const message = messages[item.message_id];
        return {
          ...item,
          is_user: message ? isUserMessage(message) : false,
          stat: unescapeEraData(item.stat),
          statWithoutMeta: unescapeEraData(removeMetaFields(item.stat)),
        };
      });
    } else {
      logger.warn('handleGetSnapshotsBetweenMks', '在指定范围内没有找到快照，或范围无效。');
      finalResult = [];
    }
  } catch (error) {
    const errorMessage = `获取批量快照时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('handleGetSnapshotsBetweenMks', errorMessage);
    finalResult = { error: errorMessage };
  }
  return () => emitQueryResultEvent('getSnapshotsBetweenMks', detail, finalResult);
}

/**
 * **【处理器】** 处理 `era:getSnapshotAtMId` 事件。
 * 计算指定 message_id 的历史快照，并通过 `era:queryResult` 事件发回结果。
 * @param {any} detail - 从事件中获取的 `detail` 对象，应包含 `message_id`。
 */
export function handleGetSnapshotAtMId(detail: any): PostCommitNotification {
  logger.debug('handleGetSnapshotAtMId', `请求获取历史快照...`);
  let result: any;
  try {
    const message_id = detail?.message_id;
    if (typeof message_id !== 'number') {
      throw new Error('请求缺少 "message_id" 参数或类型不正确。');
    }

    logger.debug('handleGetSnapshotAtMId', `Message ID: ${message_id}`);

    const { meta } = getEraData();
    const selectedMks: (string | null)[] = _.get(meta, SEL_PATH, []);

    if (message_id < 0 || message_id >= selectedMks.length) {
      throw new Error(`Message ID ${message_id} 超出范围 [0, ${selectedMks.length - 1}]。`);
    }

    const mk = selectedMks[message_id];
    if (!mk) {
      const errorMessage = `Message ID ${message_id} 处没有找到有效的 MK。`;
      logger.warn('handleGetSnapshotAtMId', errorMessage);
      result = { error: errorMessage, stat: null };
    } else {
      const stat = getStatAtMK(mk);
      if (stat) {
        const messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
        const message = messages[message_id];
        result = {
          mk,
          message_id,
          is_user: message ? isUserMessage(message) : false,
          stat: unescapeEraData(stat),
          statWithoutMeta: unescapeEraData(removeMetaFields(stat)),
        };
      } else {
        const errorMessage = `获取快照失败，MK: ${mk} (来自 Message ID: ${message_id})。可能该快照已被清理。`;
        logger.error('handleGetSnapshotAtMId', errorMessage);
        result = { error: errorMessage, stat: null };
      }
    }
  } catch (error) {
    const errorMessage = `获取快照时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('handleGetSnapshotAtMId', errorMessage);
    result = { error: errorMessage };
  }
  return () => emitQueryResultEvent('getSnapshotAtMId', detail, result);
}

/**
 * **【处理器】** 处理 `era:getSnapshotsBetweenMIds` 事件。
 * 计算两个 message_id 之间的所有历史快照，并通过 `era:queryResult` 事件发回结果数组。
 * @param {any} detail - 从事件中获取的 `detail` 对象，应包含 `startId` 和 `endId`。
 */
export function handleGetSnapshotsBetweenMIds(detail: any): PostCommitNotification {
  const { startId, endId } = detail || {};
  logger.debug(
    'handleGetSnapshotsBetweenMIds',
    `请求获取批量快照，从 ID: ${startId ?? '开始'}, 到 ID: ${endId ?? '结束'}`,
  );
  let finalResult: any;

  try {
    const { meta } = getEraData();
    const selectedMks: (string | null)[] = _.get(meta, SEL_PATH, []);

    const startIndex = startId ?? 0;
    const endIndex = endId ?? selectedMks.length - 1;

    if (startIndex > endIndex || startIndex < 0 || endIndex >= selectedMks.length) {
      throw new Error(`ID 范围 [${startIndex}, ${endIndex}] 无效或超出范围 [0, ${selectedMks.length - 1}]。`);
    }

    const startMk = selectedMks[startIndex];
    const endMk = selectedMks[endIndex];

    if (!startMk || !endMk) {
      throw new Error('指定的 ID 范围内没有找到有效的起始或结束 MK。');
    }

    const results = getStatsBetweenMKs(startMk, endMk);

    if (results) {
      const messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
      finalResult = results.map(item => {
        const message = messages[item.message_id];
        return {
          ...item,
          is_user: message ? isUserMessage(message) : false,
          stat: unescapeEraData(item.stat),
          statWithoutMeta: unescapeEraData(removeMetaFields(item.stat)),
        };
      });
    } else {
      logger.warn('handleGetSnapshotsBetweenMIds', '在指定 ID 范围内没有找到快照。');
      finalResult = [];
    }
  } catch (error) {
    const errorMessage = `获取批量快照时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('handleGetSnapshotsBetweenMIds', errorMessage);
    finalResult = { error: errorMessage };
  }
  return () => emitQueryResultEvent('getSnapshotsBetweenMIds', detail, finalResult);
}

/**
 * **【处理器】** 处理 `era:requestWriteDone` 事件。
 * 请求 ERA 框架重新广播最新的 `writeDone` 事件。
 */
export function handleRequestWriteDone(): PostCommitNotification {
  logger.debug('handleRequestWriteDone', '接收到 writeDone 重播请求。');
  return async () => {
    if (await replayLastWriteDoneEvent()) {
      logger.debug('handleRequestWriteDone', '正在重播上一次的 writeDone 事件。');
    } else {
      logger.warn('handleRequestWriteDone', '没有可供重播的 writeDone 事件。');
    }
  };
}

/**
 * @section API Event: 'era:forceSync'
 * @description 强制触发一次变量同步，用于手动修复状态或在外部逻辑变更后更新变量。
 * @param {object} [detail] - （可选）包含同步模式和相关参数的对象。
 * @param {'full' | 'latest' | 'auto' | 'rollbackTo'} [detail.mode='auto'] - 同步模式:
 *   - `'full'`: 强制从头开始完全重算整个聊天记录。
 *   - `'latest'`: 只重算最后一条消息，并将状态停留在最新。
 *   - `'auto'` (默认): 触发一次标准的差异同步，自动修复不一致。
 *   - `'rollbackTo'`: 将变量状态回滚到指定 `message_id` 处理完毕后的状态，并停留在那里。需要提供 `message_id` 参数。
 * @param {number} [detail.message_id] - 当 `mode` 为 `'rollbackTo'` 时，必须提供此参数。
 * @example
 * // 触发标准同步
 * eventEmit('era:forceSync');
 *
 * // 强制完全重算
 * eventEmit('era:forceSync', { mode: 'full' });
 *
 * // 将状态回滚到第 5 条消息之后
 * eventEmit('era:forceSync', { mode: 'rollbackTo', message_id: 5 });
 */
export async function handleForceSync(
  detail: unknown,
  actionsTaken: ActionsTaken,
  payload: DispatcherPayload,
): Promise<PostCommitNotification> {
  const requestDetail = typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : {};
  const mode = typeof requestDetail.mode === 'string' ? requestDetail.mode : 'auto';
  logger.log('handleForceSync', `接收到强制同步请求，模式: ${mode}`);

  let request: SyncExecutionRequest = {
    reason: 'manual',
    target: { kind: 'auto' },
    fullRebuild: false,
  };

  switch (mode) {
    case 'full':
      request = { ...request, fullRebuild: true };
      break;
    case 'latest': {
      const latestMessage = getChatMessages(-1, { include_swipes: true })?.[0];
      if (latestMessage) {
        request = {
          ...request,
          target: { kind: 'message', messageId: latestMessage.message_id, stopAfterTarget: false },
        };
      } else {
        throw new Error('聊天记录为空，无法执行 "latest" 强制同步。');
      }
      break;
    }
    case 'rollbackTo': {
      const msgId = requestDetail.message_id;
      if (typeof msgId !== 'number') {
        throw new TypeError('"rollbackTo" 模式需要一个有效的 "message_id" 参数。');
      }
      request = {
        ...request,
        target: { kind: 'message', messageId: msgId, stopAfterTarget: true },
      };
      break;
    }
    case 'auto':
      break;
    default:
      throw new TypeError(`不支持的 forceSync 模式: ${mode}`);
  }

  return handleSyncEvent(request, actionsTaken, payload);
}
