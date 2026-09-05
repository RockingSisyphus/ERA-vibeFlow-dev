/**
 * @file ERA 变量框架 - 核心常量模块
 * @description
 * 该文件集中定义了整个 ERA 框架所使用的关键常量。
 * 这些常量主要描述 ERA 历史格式以及 Sidecar V2 `state` 中沿用的键名。
 *
 * **核心数据结构**:
 * ERA 的数据被分为两部分，存储在 Sidecar V2 文件的 `state` 下：
 * 1. **元数据 (ERAMetaData)**: 包含框架自身运行所需的核心数据，如 `EditLogs` 和 `SelectedMks`。
 * 2. **状态数据 (stat_data)**: 包含所有由用户和 AI 管理的游戏/故事变量，如 `player`、`world_state` 等。
 *
 * 其结构大致如下：
 * ```json
 * {
 *   "state": {
 *     "eraMeta": { "EditLogs": { ... }, "SelectedMks": [ ... ] },
 *     "statData": { "player": { "hp": 100, "gold": 50 }, "world_state": { ... } }
 *   }
 * }
 * ```
 * 将这些路径定义为常量，有助于：
 * 1. **避免硬编码**：减少因拼写错误导致的 bug。
 * 2. **提高可维护性**：如果未来需要调整数据结构，只需修改此文件即可。
 * 3. **增强代码可读性**：常量的名称清晰地表达了其所指向的数据的含义。
 */

'use strict';

import { z } from 'zod';

/**
 * @constant {z.ZodObject} SettingsSchema
 * @description
 * 定义了脚本设置的 Zod schema，包括类型和默认值。
 */
export const SettingsSchema = z.object({
  在ai消息尾部生成特殊符号: z.boolean().default(true),
  特殊符号值: z.string().default('<StatusPlaceHolderImpl/>'),
  开启悬浮球: z.boolean().default(true),
  开启黑夜模式: z.boolean().default(false),
  历史状态栏显示范围: z.number().int().nonnegative().default(3),
  历史状态栏超出范围行为: z.enum(['placeholder', 'empty', 'hidden']).default('placeholder'),
  繁体转简体: z.boolean().default(false),
  调试模式: z.boolean().default(false),
});

/**
 * @type {EraConfig}
 * @description ERA 框架的配置类型。
 */
export type EraConfig = z.infer<typeof SettingsSchema>;

/**
 * @constant {object} CHAT_SCOPE
 * @description
 * 冻结旧差分 oracle 所使用的聊天 scope。生产 ERA 不得通过它读写状态；
 * 当前聊天变量只保留 `ERAMetaData.SidecarId` 指针。
 */
export const CHAT_SCOPE = { type: 'chat' as const };

/**
 * @constant {string} META_DATA_PATH
 * @description 历史聊天变量和 Sidecar state 投影中 ERA 元数据的根键名。
 */
export const META_DATA_PATH = 'ERAMetaData';

/**
 * @constant {string} STAT_DATA_PATH
 * @description 历史聊天变量和 Sidecar state 投影中用户状态数据的根键名。
 */
export const STAT_DATA_PATH = 'stat_data';

/**
 * @constant {string} LOGS_PATH
 * @description
 * 在 `ERAMetaData` 对象中，存储**编辑日志（Edit Logs）**的对象的键名，即 `"EditLogs"`。
 * `EditLogs` 是一个以**消息密钥（MK）**为键，以该消息引发的变量变更记录数组为值的对象。
 * 这是实现“逆序回滚”功能的基础数据。
 *
 * @example
 * // chat.ERAMetaData.EditLogs 的一个条目
 * "era_mk_1759246942209_jipmrj": [
 *   { "op": "insert", "path": "testData.inventory", "value_new": { "gold": 100, "slots": ["sword", "shield"] } },
 *   { "op": "update", "path": "player.hp", "value_old": 90, "value_new": 100 }
 * ]
 */
export const LOGS_PATH = 'EditLogs';

/**
 * @constant {string} SEL_PATH
 * @description
 * 在 `ERAMetaData` 对象中，存储**已选择消息密钥链（Selected Message Keys）**的数组的键名，即 `"SelectedMks"`。
 * `SelectedMks` 是一个稀疏数组，其**索引约等于消息 ID**，值是该楼层消息的 MK。
 * 这个数组是 ERA 框架的“脊梁”，是连接抽象变量状态与具体聊天历史的桥梁。
 * 框架通过比对 `SelectedMks` 与实际消息流中的 MK，来判断数据是否需要同步。
 *
 * @example
 * // chat.ERAMetaData.SelectedMks
 * [ , "era_mk_greeting", "era_mk_abc123", , "era_mk_xyz789"]
 */
export const SEL_PATH = 'SelectedMks';

/**
 * @constant {string} ERA_DATA_TAG
 * @description
 * 用于在消息内容中包裹 ERA 元数据（如消息密钥 MK）的 XML 风格标签名。
 * e.g., `<era_data>{...}</era_data>`
 */
export const ERA_DATA_TAG = 'era_data';

/**
 * @constant {RegExp} ERA_DATA_REGEX
 * @description
 * 用于从消息内容字符串中匹配和提取 `<era_data>` 块的正则表达式。
 * 这个常量被定义在这里，以避免 `message_key.ts` 和 `message_utils.ts` 之间的循环依赖。
 */
export const ERA_DATA_REGEX = new RegExp(`<${ERA_DATA_TAG}>({.*?})<\\/${ERA_DATA_TAG}>`);
