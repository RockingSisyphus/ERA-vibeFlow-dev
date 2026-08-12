'use strict';

import { ERA_EVENT_EMITTER, LOGS_PATH, QueryResultPayload, SEL_PATH, WriteDonePayload } from '../../utils/constants';
import { unescapeEraData } from '../../utils/data';
import { getEraData, removeMetaFields } from '../../utils/era_data';
import { Logger } from '../../utils/log';
import { DispatcherPayload } from '../types';

const logger = new Logger();
let lastWriteDonePayload: WriteDonePayload | null = null;

/**
 * 保留既有 `era:apiWrite` 广播协议。
 *
 * 它现在只是状态提交后的兼容通知，不再由 ERA 自己监听，也不再承担触发重算的职责。
 * 因果性的状态同步已经在原 API Ticket 内完成，避免 50ms 延迟事件逃出生成高水位。
 */
export async function emitApiWriteEvent(): Promise<void> {
  await eventEmit(ERA_EVENT_EMITTER.API_WRITE);
  logger.log('emitApiWriteEvent', `已触发兼容通知 ${ERA_EVENT_EMITTER.API_WRITE}。`);
}

// ==================================================================
// 核心事件广播器
// ==================================================================

/**
 * **【广播器】** 触发 `era:writeDone` 事件。
 * 当一次完整的变量写入操作（包括增、删、改）成功完成后，应调用此函数。
 * 它向外部脚本广播一个事件，通知它们变量状态已发生改变，并提供详细的上下文。
 *
 * @param {DispatcherPayload} payload - 包含核心上下文信息的内部载荷。
 */
export async function emitWriteDoneEvent(payload: DispatcherPayload): Promise<void> {
  // 在广播前，获取最新的全量 ERA 数据
  const { stat, meta } = getEraData();
  const statWithoutMeta = removeMetaFields(stat);
  logger.debug('emitWriteDoneEvent', '获取了最新的 ERA 数据并生成了纯净版', { stat, meta, statWithoutMeta });

  // 构建完整的 WriteDonePayload
  const fullPayload: WriteDonePayload = {
    ...payload,
    stat: unescapeEraData(stat),
    statWithoutMeta: unescapeEraData(statWithoutMeta),
    selectedMks: _.get(meta, SEL_PATH, []),
    editLogs: _.get(meta, LOGS_PATH, {}),
  };

  logger.debug('emitWriteDoneEvent', '构建了完整的事件载荷', {
    inputPayload: payload,
    fullPayload: fullPayload,
  });

  lastWriteDonePayload = fullPayload;
  await eventEmit(ERA_EVENT_EMITTER.WRITE_DONE, fullPayload);
  logger.log('emitWriteDoneEvent', `已触发 ${ERA_EVENT_EMITTER.WRITE_DONE} 事件。`, fullPayload);
}

/**
 * 重播最近一次已经完成的状态通知。
 *
 * 最近载荷由广播器直接保存，而不是再监听自己发出的事件。这样通知通道不会反向依赖
 * API handler，也避免热重载时因为重复监听而保存到不确定的实例。
 */
export async function replayLastWriteDoneEvent(): Promise<boolean> {
  if (!lastWriteDonePayload) {
    return false;
  }
  await eventEmit(ERA_EVENT_EMITTER.WRITE_DONE, lastWriteDonePayload);
  return true;
}

/**
 * **【广播器】** 触发 `era:queryResult` 事件。
 * 用于响应所有 `GET_...` 系列的 API 请求。
 *
 * @param {QueryResultPayload['queryType']} queryType - 原始查询的类型。
 * @param {any} request - 原始查询的 `detail` 对象。
 * @param {any} result - 查询的结果（单个 QueryResultItem 或 QueryResultItem 数组）。
 */
export async function emitQueryResultEvent(
  queryType: QueryResultPayload['queryType'],
  request: any,
  result: any,
): Promise<void> {
  const { meta } = getEraData();
  const payload: QueryResultPayload = {
    queryType,
    request,
    result,
    selectedMks: _.get(meta, SEL_PATH, []),
    editLogs: _.get(meta, LOGS_PATH, {}),
  };

  await eventEmit(ERA_EVENT_EMITTER.VARS_QUERY_RESULT, payload);
  logger.log('emitQueryResultEvent', `已为查询 [${queryType}] 发送 ${ERA_EVENT_EMITTER.VARS_QUERY_RESULT} 事件。`);
}
