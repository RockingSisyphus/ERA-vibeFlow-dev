/**
 * @file ERA 变量框架 - ERA 核心变量读写模块
 */

'use strict';

import { SettingsSchema, EraConfig } from './constants';
import { ref, readonly, DeepReadonly, Ref } from 'vue';
import { readSidecarRuntimeSnapshot } from '../service/sidecar-runtime-snapshot';
import { removeMetaFields as removeMetaFieldsPure } from './meta-fields';

declare function getScriptId(): string;

// --- 响应式配置中心 ---

/**
 * @description 存储全局脚本设置的响应式引用。
 * @internal
 */
const scriptSettingsRef: Ref<EraConfig> = ref(SettingsSchema.parse({}));

/**
 * @description 供外部模块使用的只读的脚本设置。
 * @example
 * import { settings } from './utils/era_data';
 * if (settings.value.调试模式) { ... }
 */
export const settings: DeepReadonly<Ref<EraConfig>> = readonly(scriptSettingsRef);

/**
 * @description 初始化脚本设置，从酒馆变量中读取并填充到响应式引用中。
 * 应在脚本启动时调用一次。
 */
export function initEraSettings() {
  const rawSettings = getVariables({ type: 'script', script_id: getScriptId() });
  scriptSettingsRef.value = SettingsSchema.parse(rawSettings ?? {});
}

/**
 * 递归地从对象中移除所有以 `$` 开头的字段（如 `$meta`, `$template`）。
 * 此函数会创建一个对象的深拷贝，因此不会修改原始对象。
 * @param {any} obj - 待处理的对象或值。
 * @returns {any} 一个不包含 `$` 前缀字段的新对象或原始值。
 */
export function removeMetaFields(obj: any): any {
  return removeMetaFieldsPure(obj);
}

/**
 * 获取并确保 ERA 的元数据和状态数据对象的存在。
 * @returns {{meta: object, stat: object}} 包含元数据和状态数据的对象。
 */
export function getEraData(): { meta: any; stat: any } {
  const helper = globalThis as typeof globalThis & {
    getCurrentCharacterId?: () => string | null;
    SillyTavern?: { groupId?: string | null; getCurrentChatId?: () => string };
  };
  if (
    typeof helper.getCurrentCharacterId !== 'function' ||
    typeof helper.SillyTavern?.getCurrentChatId !== 'function'
  ) {
    return { meta: {}, stat: {} };
  }
  const snapshot = readSidecarRuntimeSnapshot({
    characterId: helper.getCurrentCharacterId(),
    groupId: helper.SillyTavern.groupId || null,
    chatId: helper.SillyTavern.getCurrentChatId(),
  });
  // 宏与旧兼容读取必须同步且不可回退到聊天变量；缺快照时使用空对象。
  return snapshot === null
    ? { meta: {}, stat: {} }
    : { meta: structuredClone(snapshot.eraMeta), stat: structuredClone(snapshot.statData) };
}

/**
 * 冻结的旧差分 oracle 不得再绕过 Service 把 ERA 状态写入聊天变量。
 *
 * 保留导出只是为了让旧测试得到明确、可定位的失败；生产状态写入必须经过
 * `era.sidecar.store`，由该 Nodeset 事务性提交 Sidecar V2 文件。
 */
export async function updateEraStatData(_updater: (currentStatData: any) => any | Promise<any>) {
  throw new Error('ERA_LEGACY_CHAT_STATE_WRITE_FORBIDDEN: 请通过 Service Sidecar 状态事务提交变量。');
}

/** 与 `updateEraStatData` 相同，禁止旧路径直接写入聊天 `ERAMetaData`。 */
export async function updateEraMetaData(_updater: (currentMetaData: any) => any | Promise<any>) {
  throw new Error('ERA_LEGACY_CHAT_STATE_WRITE_FORBIDDEN: 请通过 Service Sidecar 状态事务提交元数据。');
}

/**
 * 原子性地更新脚本设置
 * @param {(currentSettings: EraConfig) => EraConfig | Promise<EraConfig>} updater
 * @returns {Promise<void>}
 */
export async function updateScriptSettings(
  updater: (currentSettings: EraConfig) => EraConfig | Promise<EraConfig>,
): Promise<void> {
  await updateVariablesWith(
    async rawSettings => {
      const currentSettings = SettingsSchema.parse(rawSettings ?? {});
      const newSettings = await updater(currentSettings);
      // 更新内存中的响应式引用
      scriptSettingsRef.value = newSettings;
      return newSettings;
    },
    { type: 'script', script_id: getScriptId() },
  );
}
