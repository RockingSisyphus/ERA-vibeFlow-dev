/**
 * ERA 初始化资源的纯规划器。
 *
 * 本模块只接收已经规范化为 JSON 的宿主快照，并返回声明式计划；不会读取
 * Tavern、DOM、文件、时间、随机数或任何模块级可变状态，也不会执行写入。
 */

export type EraJsonPrimitive = string | number | boolean | null;
export type EraJsonValue =
  | EraJsonPrimitive
  | readonly EraJsonValue[]
  | { readonly [key: string]: EraJsonValue };

export interface EraSettingsV1 {
  readonly 在ai消息尾部生成特殊符号: boolean;
  readonly 特殊符号值: string;
  readonly 开启悬浮球: boolean;
  readonly 开启黑夜模式: boolean;
  readonly 强制重载功能: boolean;
  readonly 强制重载消息数: number;
  readonly 繁体转简体: boolean;
  readonly 调试模式: boolean;
}

export interface EraSettingsIssueV1 {
  readonly field: string;
  readonly expected: "boolean" | "number" | "string" | "object";
  readonly actual: string;
}

export type EraSettingsPlanV1 =
  | {
      readonly kind: "settings";
      readonly status: "ready";
      readonly settings: EraSettingsV1;
      readonly removedUnknownKeys: readonly string[];
      readonly actions: readonly [
        {
          readonly kind: "replace-settings";
          readonly settings: EraSettingsV1;
        },
      ];
    }
  | {
      readonly kind: "settings";
      readonly status: "invalid";
      readonly error: {
        readonly code: "ERA_SETTINGS_INVALID";
        readonly message: string;
        readonly issues: readonly EraSettingsIssueV1[];
      };
      readonly actions: readonly [];
    };

export type EraCharacterContextV1 =
  | {
      readonly kind: "character";
      readonly characterName: string;
      readonly primaryWorldbook: string | null;
      readonly additionalWorldbooks: readonly string[];
    }
  | { readonly kind: "group-chat"; readonly groupName?: string }
  | { readonly kind: "no-character" };

export interface EraWorldbookEntryV1 {
  readonly name: string;
  readonly content: string;
  readonly enabled: true;
  readonly strategy: {
    readonly type: "constant";
    readonly keys: readonly [];
    readonly keys_secondary: {
      readonly logic: "and_any";
      readonly keys: readonly [];
    };
    readonly scan_depth: "same_as_global";
  };
  readonly position: {
    readonly type: "at_depth";
    readonly role: "system";
    readonly depth: 0;
    readonly order: 9999 | 9998;
  };
  readonly probability: 100;
  readonly recursion: {
    readonly prevent_incoming: false;
    readonly prevent_outgoing: false;
    readonly delay_until: null;
  };
  readonly effect: {
    readonly sticky: null;
    readonly cooldown: null;
    readonly delay: null;
  };
}

export interface EraWorldbookPlanInputV1 {
  readonly context: EraCharacterContextV1;
  readonly existingWorldbookNames: readonly string[];
  readonly primaryEntries: readonly unknown[];
}

export type EraWorldbookActionV1 =
  | { readonly kind: "create-worldbook"; readonly worldbookName: string }
  | {
      readonly kind: "bind-primary-worldbook";
      readonly characterName: string;
      readonly worldbookName: string;
      readonly additionalWorldbooks: readonly string[];
    }
  | {
      readonly kind: "create-entry";
      readonly worldbookName: string;
      readonly entry: EraWorldbookEntryV1;
    };

export interface EraWorldbookEntryPlanV1 {
  readonly entryName: string;
  readonly status: "planned" | "exists";
}

export type EraWorldbookPlanV1 =
  | {
      readonly kind: "worldbook";
      readonly status: "ready";
      readonly worldbookName: string;
      readonly createdPrimary: boolean;
      readonly details: readonly EraWorldbookEntryPlanV1[];
      readonly actions: readonly EraWorldbookActionV1[];
    }
  | {
      readonly kind: "worldbook";
      readonly status: "skipped" | "conflict";
      readonly reason: string;
      readonly details: readonly [];
      readonly actions: readonly [];
    };

export interface EraRegexPayloadV1 {
  readonly script_name: string;
  readonly enabled: true;
  readonly run_on_edit: true;
  readonly find_regex: string;
  readonly replace_string: string;
  readonly trim_strings: readonly [];
  readonly source: {
    readonly user_input: boolean;
    readonly ai_output: boolean;
    readonly slash_command: false;
    readonly world_info: false;
    readonly reasoning: false;
  };
  readonly destination: {
    readonly display: true;
    readonly prompt: boolean;
  };
  readonly min_depth: null;
  readonly max_depth: null;
}

export interface EraRegexPlanInputV1 {
  readonly context: EraCharacterContextV1;
  readonly localRegexEnabled: boolean;
  readonly existingRegexes: readonly unknown[];
}

export interface EraRegexDetailV1 {
  readonly regexName: string;
  readonly status: "planned" | "exists";
}

export type EraRegexPlanV1 =
  | {
      readonly kind: "regex";
      readonly status: "ready";
      readonly details: readonly EraRegexDetailV1[];
      readonly actions: readonly {
        readonly kind: "upsert-missing-regex";
        readonly regex: EraRegexPayloadV1;
      }[];
    }
  | {
      readonly kind: "regex";
      readonly status: "skipped";
      readonly reason: string;
      readonly details: readonly [];
      readonly actions: readonly [];
    };

export type EraPlaceholderMessageV1 =
  | { readonly kind: "missing"; readonly messageId: number }
  | {
      readonly kind: "present";
      readonly messageId: number;
      readonly role: "assistant" | "user" | "unknown";
      readonly textContent: string | null;
      readonly attachments?: readonly EraJsonValue[];
    };

export interface EraPlaceholderPlanInputV1 {
  readonly enabled: boolean;
  readonly placeholder: string;
  readonly message: EraPlaceholderMessageV1;
}

export type EraPlaceholderPlanV1 =
  | {
      readonly kind: "placeholder";
      readonly status: "update";
      readonly messageId: number;
      readonly textContent: string;
      readonly actions: readonly [
        {
          readonly kind: "update-message-text";
          readonly messageId: number;
          readonly textContent: string;
        },
      ];
    }
  | {
      readonly kind: "placeholder";
      readonly status: "skipped" | "exists";
      readonly reason: string;
      readonly actions: readonly [];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defineOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/** 为 JSON 计划创建不共享对象或数组引用的副本。 */
export function cloneResourcePlanValue<T>(value: T): T {
  if (Array.isArray(value)) {
    const result = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) result[index] = cloneResourcePlanValue(value[index]);
    }
    return result as T;
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      defineOwn(result, key, cloneResourcePlanValue(value[key]));
    }
    return result as T;
  }
  return value;
}

function actualType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function readBoolean(
  source: Readonly<Record<string, unknown>>,
  field: string,
  fallback: boolean,
  issues: EraSettingsIssueV1[],
): boolean {
  const value = source[field];
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  issues.push({ field, expected: "boolean", actual: actualType(value) });
  return fallback;
}

function readString(
  source: Readonly<Record<string, unknown>>,
  field: string,
  fallback: string,
  issues: EraSettingsIssueV1[],
): string {
  const value = source[field];
  if (value === undefined) return fallback;
  if (typeof value === "string") return value;
  issues.push({ field, expected: "string", actual: actualType(value) });
  return fallback;
}

function readNumber(
  source: Readonly<Record<string, unknown>>,
  field: string,
  fallback: number,
  issues: EraSettingsIssueV1[],
): number {
  const value = source[field];
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  issues.push({ field, expected: "number", actual: actualType(value) });
  return fallback;
}

function settingKeys(): readonly string[] {
  return [
    "在ai消息尾部生成特殊符号",
    "特殊符号值",
    "开启悬浮球",
    "开启黑夜模式",
    "强制重载功能",
    "强制重载消息数",
    "繁体转简体",
    "调试模式",
  ];
}

/** 复刻候选 Zod object 的默认值、严格字段类型和未知字段 strip 语义。 */
export function planEraSettings(raw: unknown): EraSettingsPlanV1 {
  const normalized = raw ?? {};
  if (!isRecord(normalized)) {
    return cloneResourcePlanValue({
      kind: "settings",
      status: "invalid",
      error: {
        code: "ERA_SETTINGS_INVALID",
        message: "ERA 设置必须是对象。",
        issues: [
          { field: "", expected: "object", actual: actualType(normalized) },
        ],
      },
      actions: [],
    });
  }
  const issues: EraSettingsIssueV1[] = [];
  const settings: EraSettingsV1 = {
    在ai消息尾部生成特殊符号: readBoolean(
      normalized,
      "在ai消息尾部生成特殊符号",
      true,
      issues,
    ),
    特殊符号值: readString(
      normalized,
      "特殊符号值",
      "<StatusPlaceHolderImpl/>",
      issues,
    ),
    开启悬浮球: readBoolean(normalized, "开启悬浮球", true, issues),
    开启黑夜模式: readBoolean(normalized, "开启黑夜模式", false, issues),
    强制重载功能: readBoolean(normalized, "强制重载功能", false, issues),
    强制重载消息数: readNumber(normalized, "强制重载消息数", 2, issues),
    繁体转简体: readBoolean(normalized, "繁体转简体", false, issues),
    调试模式: readBoolean(normalized, "调试模式", false, issues),
  };
  if (issues.length > 0) {
    return cloneResourcePlanValue({
      kind: "settings",
      status: "invalid",
      error: {
        code: "ERA_SETTINGS_INVALID",
        message: "ERA 设置字段类型无效。",
        issues,
      },
      actions: [],
    });
  }
  const known = settingKeys();
  const removedUnknownKeys = Object.keys(normalized).filter(
    (key) => !known.includes(key),
  );
  return cloneResourcePlanValue({
    kind: "settings",
    status: "ready",
    settings,
    removedUnknownKeys,
    actions: [{ kind: "replace-settings", settings }],
  });
}

function baselineOperationRuleContent(): string {
  return '<variable_rule>\n# ERA 变量操作规则\n\n- **无变化则不操作**: 当变量信息与故事发展相比没有变化时，禁止生成任何指令块。\n- **新增则 `Insert`**: 当出现全新的角色、物品、状态或信息时，必须使用 `<VariableInsert>`。\n- **修改则 `Update`**: 当已有的数据需要更新其值时（如等级提升、状态改变），必须使用 `<VariableEdit>`。\n- **移除则 `Delete`**: 当数据被明确地消耗、移除或销毁时，必须使用 `<VariableDelete>`。\n\n## 指令核心规则\n- **`<VariableInsert>`**:\n    - **只增不改**: 用于添加新数据，它绝不会覆盖任何已经存在的数据。\n- **`<VariableEdit>`**:\n    - **只改不增**: 用于修改已存在的数据，它绝不会在不存在的路径上创建新数据。\n- **`<VariableDelete>`**:\n    - **删除节点**: 在指令中，使用一个 **空对象 `{}`** 作为值，表示要删除该键对应的整个节点。\n\n</variable_rule>\n\n<format_request>\n你必须根据有关要求及变量现有状态，补完 `<VariableThink>` 及 `<VariableInsert>`、`<VariableEdit>`、`<VariableDelete>` 等指令块。\n\n**严格遵守以下流程**:\n\n1.  **输出正文**:\n    -   首先，生成本次回复的正文内容。\n\n2.  **输出思考与指令**:\n    -   在正文内容之后，必须立即输出 `<VariableThink>` 块，并在其中进行思考。\n    -   在 `<VariableThink>` 块之后，必须立即输出一个或多个指令块 (`<VariableInsert>`、`<VariableEdit>`、`<VariableDelete>`)。\n\n3.  **格式要求**:\n    -   所有指令块的内容都必须是 **严格合法** 的 JSON 格式。\n    -   所有 JSON 的键（key）都必须使用双引号 `"`。\n    -   严格遵循 `<variable_rule>` 中定义的所有规则。\n\n# ** 回复内容必须仿照格式示例，以该格式回复；必须包含意图分析、变量变更分析和操作计划，以及操作计划计划生成的完整`<VariableInsert>`或`<VariableEdit>`的标签代码块来实现对ERA变量的维护 **\n\n即，必须保证最终输出格式为：\n  {其他内容（如正文）和格式}\n\n  <VariableThink>\n    1.  **意图分析**: {变量更新意图}\n    2.  **操作计划**:\n      - {操作意图}\n  </VariableThink>\n  <VariableInsert>\n  {Insert的JSON格式变量,严格遵守变量路径}\n  </VariableInsert>\n  <VariableEdit>\n  {Edit的JSON格式变量,严格遵守变量路径}\n  </VariableEdit>\n\n### 格式示例\n  {其他内容（如正文）和格式...}\n\n  <VariableThink>\n  1.  **意图分析**: 故事中出现了一个新角色 "Elara"，需要将其添加到 `characters` 对象中。同时，主角 "player" 的 `hp` 从 15 减少到了 10。\n  2.  **操作计划**:\n      -   生成一个 `<VariableInsert>` 块来添加新角色 "Elara"。\n      -   生成一个 `<VariableEdit>` 块来更新 "player" 的 `hp`。\n  </VariableThink>\n  <VariableInsert>\n  {\n    "characters": {\n      "Elara": {\n        "class": "Archer"\n      }\n    }\n  }\n  </VariableInsert>\n  <VariableEdit>\n  {\n    "characters": {\n      "player": {\n        "hp": 10\n      }\n    }\n  }\n  </VariableEdit>\n</format_request>\n';
}

function operationRuleContent(): string {
  const relativeRules = `    - **相对数值更新**: 仅在需要基于当前数值计算时，把目标值写成以下恰好一个键的 JSON 对象：
        - 加减: \`{"$inc": 25}\`；减法使用负数，例如 \`{"$inc": -10}\`。
        - 乘法: \`{"$mul": 1.2}\`。
        - 除法: \`{"$div": 2}\`，除数不能为 0。
    - 操作数和目标当前值必须是有限数字；不要组合多个操作符或添加其他字段。
    - 禁止输出 \`"+=2"\`、\`"-=2"\`、\`"*=2"\`、\`"/=2"\`、\`$sub\`、\`$set\` 或任意表达式；这些字符串只会被当成普通文本。`;
  return baselineOperationRuleContent()
    .replace(
      "- **`<VariableEdit>`**:\n    - **只改不增**: 用于修改已存在的数据，它绝不会在不存在的路径上创建新数据。",
      `- **\`<VariableEdit>\`**:\n    - **只改不增**: 用于修改已存在的数据，它绝不会在不存在的路径上创建新数据。\n${relativeRules}`,
    )
    .replace('"hp": 10', '"hp": { "$inc": -5 }');
}

function worldbookEntry(
  name: string,
  content: string,
  order: 9999 | 9998,
): EraWorldbookEntryV1 {
  return {
    name,
    content,
    enabled: true,
    strategy: {
      type: "constant",
      keys: [],
      keys_secondary: { logic: "and_any", keys: [] },
      scan_depth: "same_as_global",
    },
    position: { type: "at_depth", role: "system", depth: 0, order },
    probability: 100,
    recursion: {
      prevent_incoming: false,
      prevent_outgoing: false,
      delay_until: null,
    },
    effect: { sticky: null, cooldown: null, delay: null },
  };
}

/** 返回候选基线的两条世界书条目，顺序为操作规则、意图说明。 */
export function getEraWorldbookEntries(): readonly EraWorldbookEntryV1[] {
  return cloneResourcePlanValue([
    worldbookEntry("ERA 变量操作规则", operationRuleContent(), 9999),
    worldbookEntry(
      "ERA 变量意图说明",
      "{{//请在这里补充对你设计的变量系统的说明，以便ai理解你的意图并正确的更新变量}}\n",
      9998,
    ),
  ]);
}

function entryName(value: unknown): string | null {
  return isRecord(value) && typeof value.name === "string" ? value.name : null;
}

/** 规划主世界书创建/绑定与仅缺失条目的追加，不覆盖任何同名条目。 */
export function planEraWorldbook(
  input: EraWorldbookPlanInputV1,
): EraWorldbookPlanV1 {
  if (input.context.kind === "group-chat") {
    return cloneResourcePlanValue({
      kind: "worldbook",
      status: "skipped",
      reason: "群聊没有可安全绑定的当前角色主世界书。",
      details: [],
      actions: [],
    });
  }
  if (input.context.kind === "no-character") {
    return cloneResourcePlanValue({
      kind: "worldbook",
      status: "skipped",
      reason: "当前聊天没有角色，无法规划角色主世界书。",
      details: [],
      actions: [],
    });
  }

  const actions: EraWorldbookActionV1[] = [];
  const createdPrimary = input.context.primaryWorldbook === null;
  const worldbookName = input.context.primaryWorldbook ?? "ERA卡示例世界书";
  if (
    createdPrimary &&
    input.existingWorldbookNames.includes("ERA卡示例世界书")
  ) {
    return cloneResourcePlanValue({
      kind: "worldbook",
      status: "conflict",
      reason:
        "未绑定主世界书，但同名的 ERA卡示例世界书 已存在；拒绝覆盖或误绑定。",
      details: [],
      actions: [],
    });
  }
  if (createdPrimary) {
    actions.push({ kind: "create-worldbook", worldbookName });
    actions.push({
      kind: "bind-primary-worldbook",
      characterName: input.context.characterName,
      worldbookName,
      additionalWorldbooks: [...input.context.additionalWorldbooks],
    });
  }

  const entries = getEraWorldbookEntries();
  const existingNames = input.primaryEntries
    .map(entryName)
    .filter((name): name is string => name !== null);
  const details: EraWorldbookEntryPlanV1[] = [];
  for (const entry of entries) {
    if (existingNames.includes(entry.name)) {
      details.push({ entryName: entry.name, status: "exists" });
    } else {
      details.push({ entryName: entry.name, status: "planned" });
      actions.push({ kind: "create-entry", worldbookName, entry });
    }
  }
  return cloneResourcePlanValue({
    kind: "worldbook",
    status: "ready",
    worldbookName,
    createdPrimary,
    details,
    actions,
  });
}

function regexPayload(
  scriptName: string,
  findRegex: string,
  replaceString: string,
  userInput: boolean,
  prompt: boolean,
): EraRegexPayloadV1 {
  return {
    script_name: scriptName,
    enabled: true,
    run_on_edit: true,
    find_regex: findRegex,
    replace_string: replaceString,
    trim_strings: [],
    source: {
      user_input: userInput,
      ai_output: true,
      slash_command: false,
      world_info: false,
      reasoning: false,
    },
    destination: { display: true, prompt },
    min_depth: null,
    max_depth: null,
  };
}

function baselineStatusBarHtml(): string {
  return '<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>ERA 状态栏模板</title>\n    <style>\n      body {\n        font-family:\n          -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, \'Noto Sans\', sans-serif,\n          \'Apple Color Emoji\', \'Segoe UI Emoji\', \'Segoe UI Symbol\', \'Noto Color Emoji\';\n        margin: 0;\n        padding: 0;\n        background-color: transparent;\n      }\n      .era-statusbar {\n        color: #e0e0e0;\n        background: linear-gradient(145deg, #2c3e50, #34495e);\n        border-radius: 12px;\n        padding: 16px;\n        margin-top: 20px;\n        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);\n        border: 1px solid #4a6278;\n        overflow: hidden;\n      }\n      .era-statusbar-header {\n        display: flex;\n        align-items: center;\n        border-bottom: 1px solid #4a6278;\n        padding-bottom: 10px;\n        margin-bottom: 12px;\n      }\n      .era-statusbar-header h4 {\n        margin: 0;\n        font-size: 1.1em;\n        font-weight: 700;\n        color: #1abc9c;\n        text-shadow: 0 0 5px rgba(26, 188, 156, 0.5);\n      }\n      .era-statusbar-grid {\n        display: grid;\n        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));\n        gap: 10px;\n      }\n      .era-statusbar-item {\n        background-color: rgba(255, 255, 255, 0.05);\n        padding: 8px 12px;\n        border-radius: 8px;\n      }\n      .era-statusbar-item-label {\n        font-size: 0.85em;\n        color: #bdc3c7;\n        margin-bottom: 4px;\n      }\n      .era-statusbar-item-value {\n        font-size: 1em;\n        font-weight: 700;\n        color: #ecf0f1;\n      }\n      .era-instructions {\n        margin-top: 16px;\n        padding-top: 12px;\n        border-top: 1px solid #4a6278;\n        font-size: 0.9em;\n        line-height: 1.6;\n      }\n      .era-instructions a {\n        color: #3498db;\n        text-decoration: none;\n      }\n      .era-instructions a:hover {\n        text-decoration: underline;\n      }\n      .era-instructions .ai-note {\n        font-size: 0.8em;\n        color: #7f8c8d;\n      }\n    </style>\n  </head>\n  <body>\n    <div class="era-statusbar">\n      <div class="era-statusbar-header">\n        <h4>角色状态</h4>\n      </div>\n      <div class="era-statusbar-grid">\n        <div class="era-statusbar-item">\n          <div class="era-statusbar-item-label">姓名</div>\n          <div class="era-statusbar-item-value" id="player-name">--</div>\n        </div>\n        <div class="era-statusbar-item">\n          <div class="era-statusbar-item-label">等级</div>\n          <div class="era-statusbar-item-value" id="player-level">--</div>\n        </div>\n        <div class="era-statusbar-item">\n          <div class="era-statusbar-item-label">生命值</div>\n          <div class="era-statusbar-item-value" id="player-hp">-- / --</div>\n        </div>\n        <div class="era-statusbar-item">\n          <div class="era-statusbar-item-label">魔力值</div>\n          <div class="era-statusbar-item-value" id="player-mp">-- / --</div>\n        </div>\n      </div>\n\n      <div class="era-statusbar-header" style="margin-top: 16px">\n        <h4>附近NPC</h4>\n      </div>\n      <div id="npc-list" class="era-statusbar-grid">\n        <div class="era-statusbar-item-label" style="padding: 8px 12px">暂无NPC信息</div>\n      </div>\n\n      <!-- \n      AI 你好！当角色卡作者让你修改此文件时，请在修改后删除下面的 "instructions-wrapper"整个 div 元素。\n    -->\n      <div id="instructions-wrapper">\n        <div class="era-statusbar-header" style="margin-top: 16px">\n          <h4>给角色卡作者的说明</h4>\n        </div>\n        <div class="era-instructions">\n          <strong>你接下来需要做的：</strong><br />\n          1. 自己设计角色卡用到的变量结构，并使用 &amp;lt;VariableInsert&amp;gt 标签写入角色的开场白。<br />\n          2. 在角色主世界书的‘ERA变量意图说明’条目中，添加向 AI 说明各个变量意图的提示词。<br />\n          3. 修改本状态栏的 HTML 代码，使其与**你设计的变量系统匹配**。<br />\n          <br />\n          完成第一步和第二步请参考：<br />\n          <a\n            href="https://github.com/RockingSisyphus/ERA-EfficientRollbackArchitecture/blob/master/doc/%E4%BD%A0%E6%9C%80%E5%A5%BD%E8%87%AA%E5%B7%B1%E7%9C%8B%E4%B8%80%E9%81%8D%E7%9A%84era%E5%8D%A1%E5%AE%8C%E6%95%B4%E5%88%B6%E4%BD%9C%E6%96%87%E6%A1%A3%EF%BC%88%E5%8C%85%E5%90%AB%E5%8F%98%E9%87%8F%E5%88%9D%E5%A7%8B%E5%8C%96%E5%92%8C%E4%B8%96%E7%95%8C%E4%B9%A6%E6%8F%90%E7%A4%BA%E8%AF%8D%EF%BC%89/%E5%A6%82%E4%BD%95%E8%AE%BE%E8%AE%A1%E5%92%8C%E8%AF%B4%E6%98%8E%E4%BD%A0%E7%9A%84%E5%8F%98%E9%87%8F%E7%B3%BB%E7%BB%9F.md"\n            target="_blank"\n            rel="noopener noreferrer"\n            >如何设计和说明你的变量系统</a\n          >\n          <br /><br />\n          推荐你进入‘ERA 状态栏模板’正则中，将‘替换为’的内容（也就是当前模板状态栏的html代码）全部复制发送给 AI (如\n          Cline, ChatGPT, Claude等)，让它帮你完成第 3 步。为了让 AI\n          更好地理解如何修改，请同时将以下链接中的文档内容一并提供给它：<br />\n          <a\n            href="https://github.com/RockingSisyphus/ERA-EfficientRollbackArchitecture/tree/master/doc/%E9%80%82%E5%90%88%E6%8F%90%E4%BE%9B%E7%BB%99ai%E7%9A%84%E7%8A%B6%E6%80%81%E6%A0%8Fhtml%E5%BC%80%E5%8F%91%E6%96%87%E6%A1%A3%EF%BC%88%E5%8F%AA%E5%8C%85%E5%90%ABhtml%E7%8A%B6%E6%80%81%E6%A0%8F%E4%BB%A3%E7%A0%81%E4%B9%A6%E5%86%99%E9%83%A8%E5%88%86%EF%BC%89"\n            target="_blank"\n            rel="noopener noreferrer"\n            >ERA 状态栏开发文档</a\n          >\n          <br /><br />\n          <strong>关于 ERA 框架:</strong><br />\n          作者: 世界的山田<br />\n          ERA 框架交流群: 1006127516<br />\n          <a\n            href="https://github.com/RockingSisyphus/ERA-EfficientRollbackArchitecture/tree/master"\n            target="_blank"\n            rel="noopener noreferrer"\n            >ERA 项目地址</a\n          >\n          |\n          <a\n            href="https://discord.com/channels/1134557553011998840/1423319849400270928"\n            target="_blank"\n            rel="noopener noreferrer"\n            >Discord 发布帖</a\n          >\n        </div>\n      </div>\n    </div>\n\n    <script>\n      document.addEventListener(\'DOMContentLoaded\', () => {\n        const playerName = document.getElementById(\'player-name\');\n        const playerLevel = document.getElementById(\'player-level\');\n        const playerHp = document.getElementById(\'player-hp\');\n        const playerMp = document.getElementById(\'player-mp\');\n        const npcListContainer = document.getElementById(\'npc-list\');\n        let isInitialLoad = true;\n\n        function updateUI(stat) {\n          // 更新玩家信息\n          const pName = _.get(stat, \'player.name\');\n          if (pName !== undefined) playerName.textContent = pName;\n          else if (isInitialLoad) playerName.textContent = \'示例数据, 完成步骤1后显示\';\n\n          const pLevel = _.get(stat, \'player.level\');\n          if (pLevel !== undefined) playerLevel.textContent = pLevel;\n          else if (isInitialLoad) playerLevel.textContent = \'示例数据, 完成步骤1后显示\';\n\n          const pHp = _.get(stat, \'player.hp\');\n          const pMaxHp = _.get(stat, \'player.max_hp\');\n          if (pHp !== undefined && pMaxHp !== undefined) playerHp.textContent = `${pHp} / ${pMaxHp}`;\n          else if (isInitialLoad) playerHp.textContent = \'示例数据, 完成步骤1后显示\';\n\n          const pMp = _.get(stat, \'player.mp\');\n          const pMaxMp = _.get(stat, \'player.max_mp\');\n          if (pMp !== undefined && pMaxMp !== undefined) playerMp.textContent = `${pMp} / ${pMaxMp}`;\n          else if (isInitialLoad) playerMp.textContent = \'示例数据, 完成步骤1后显示\';\n\n          // 更新NPC列表\n          const npcs = _.get(stat, \'world_state.npcs\', {});\n          npcListContainer.innerHTML = \'\'; // 清空旧列表\n          if (_.isEmpty(npcs)) {\n            if (isInitialLoad)\n              npcListContainer.innerHTML =\n                \'<div class="era-statusbar-item-label" style="padding: 8px 12px;">示例数据, 完成步骤1后显示</div>\';\n            else\n              npcListContainer.innerHTML =\n                \'<div class="era-statusbar-item-label" style="padding: 8px 12px;">暂无NPC信息</div>\';\n          } else {\n            for (const npcId in npcs) {\n              const npc = npcs[npcId];\n              const npcElement = document.createElement(\'div\');\n              npcElement.className = \'era-statusbar-item\';\n              npcElement.innerHTML = `\n                    <div class="era-statusbar-item-label">${npc.name || \'未知NPC\'}</div>\n                    <div class="era-statusbar-item-value">心情: ${npc.mood || \'平常\'}</div>\n                `;\n              npcListContainer.appendChild(npcElement);\n            }\n          }\n\n          isInitialLoad = false;\n        }\n\n        eventOn(\'era:writeDone\', detail => {\n          if (detail && detail.statWithoutMeta) {\n            updateUI(detail.statWithoutMeta);\n          }\n        });\n\n        eventEmit(\'era:requestWriteDone\');\n      });\n    </script>\n\n    <!-- \n    ================================================================\n    给 AI 的参考代码 (默认注释)\n    \n    AI 你好！当角色卡作者让你修改此文件时，请参考下面的注释代码。\n    \n    ### 宏模式 (简单)\n    - **用法**: 直接在 HTML 中写入 `{{ERA:路径.到.变量}}` 宏。\n    - **优点**: 非常简单，无需编写任何 JavaScript。\n    - **缺点**: 需要在 ERA 设置中开启“强制重载状态栏”，每次变量更新都会导致整个状态栏闪烁刷新。\n    - **建议**: 你作为ai，最好提醒一下角色卡作者使用era的api，监听writeDone事件是更优雅更稳健的解决方案。\n    - **示例**: `<div class="era-statusbar-item-value">{{ERA:player.hp}} / {{ERA:player.max_hp}}</div>`\n\n    ---\n\n    ### API 模式 (进阶，推荐)\n    - **用法**: 使用 JavaScript 监听和发送 ERA 框架的事件，来动态地读写变量。\n    - **优点**: 更新平滑无闪烁，性能更好，可以实现复杂的前端交互。\n\n    #### 核心事件与数据结构\n    \n    **1. `era:writeDone` 事件**: 这是响应数据变化的**唯一推荐方式**。当任何变量发生改变后，ERA 都会广播此事件，其回调函数会接收一个包含详细信息的 `detail` 对象。\n    \n    **`writeDone` 事件的 `detail` 对象 (`WriteDonePayload`) 结构如下:**\n    ```typescript\n    {\n      mk: string; // 本次更新的消息密钥\n      message_id: number; // 本次更新的消息 ID\n      actions: {\n        rollback: boolean; // 是否执行了回滚\n        apply: boolean;    // 是否应用了来自AI输出的变量变更\n        resync: boolean;   // 是否因历史记录变化而执行了再同步\n        api: boolean;      // 是否由API直接调用触发\n        apiWrite: boolean; // 是否由API写入操作(如update/insert)触发\n      };\n      selectedMks: (string | null)[]; // 当前聊天的主干消息密钥链\n      editLogs: { [key: string]: any[] }; // 完整的编辑日志\n      stat: any; // 包含 $meta 字段的完整变量状态\n      statWithoutMeta: any; // 不含 $meta 的纯净变量状态 (推荐使用)\n      consecutiveProcessingCount: number; // 对当前消息的连续处理次数\n    }\n    ```\n\n    **2. 核心读取事件**:\n    - **`eventOn(\'era:writeDone\', callback)`**: 监听变量写入完成。\n      `eventOn(\'era:writeDone\', (detail) => { console.log(detail.statWithoutMeta); });`\n    - **`eventEmit(\'era:requestWriteDone\')`**: 主动请求一次最新变量，ERA 会以一个 `era:writeDone` 事件来响应。\n\n    **3. 核心写入事件 (通过 `eventEmit` 发送)**:\n    - **注意**: 所有写入事件最终都会触发一次 `era:writeDone`。为避免无限循环（例如：API写入 -> `writeDone` -> API写入），你可以在 `writeDone` 的监听器中检查 `detail.actions.apiWrite` 字段。\n      `eventOn(\'era:writeDone\', (detail) => { if (detail.actions.apiWrite) return; /* 避免响应由API自身触发的更新 */ });`\n    \n    - **`era:insertByObject`**: 非破坏性地插入一个或多个变量。\n      `eventEmit(\'era:insertByObject\', { player: { score: 0 } });`\n    - **`era:updateByObject`**: 修改一个或多个已存在的变量。\n      `eventEmit(\'era:updateByObject\', { player: { level: 2 } });`\n    - **`era:insertByPath`**: 在指定路径插入一个新变量。\n      `eventEmit(\'era:insertByPath\', { path: \'inventory.item_002\', value: { name: \'新物品\' } });`\n    - **`era:updateByPath`**: 修改指定路径的变量，支持数学运算。\n      `eventEmit(\'era:updateByPath\', { path: \'player.hp\', value: \'-=10\' });`\n    - **`era:deleteByPath`**: 删除指定路径的变量。\n      `eventEmit(\'era:deleteByPath\', { path: \'inventory.item_001\' });`\n    ================================================================\n  --></body>\n</html>\n';
}

function statusBarHtml(): string {
  return baselineStatusBarHtml()
    .replace(
      "    - **`era:updateByObject`**: 修改一个或多个已存在的变量。\n      `eventEmit('era:updateByObject', { player: { level: 2 } });`",
      "    - **`era:updateByObject`**: 修改一个或多个已存在的变量；数值可用单键 `$inc/$mul/$div` 对象做相对更新。\n      `eventEmit('era:updateByObject', { player: { level: 2, hp: { $inc: -10 } } });`",
    )
    .replace(
      "    - **`era:updateByPath`**: 修改指定路径的变量，支持数学运算。\n      `eventEmit('era:updateByPath', { path: 'player.hp', value: '-=10' });`",
      '    - **`era:updateByPath`**: 修改指定路径的变量；相对数值更新使用严格 JSON 运算对象。\n      `eventEmit(\'era:updateByPath\', { path: \'player.hp\', value: { $inc: -10 } });`\n      不支持 `"+=2"`、`"-=2"`、`"*=2"`、`"/=2"` 字符串表达式；它们会作为普通字符串保存。',
    );
}

/** 返回候选基线的四条角色局部正则，保持冻结顺序与完整载荷。 */
export function getEraRegexPayloads(): readonly EraRegexPayloadV1[] {
  return cloneResourcePlanValue([
    regexPayload(
      "ERA 数据隐藏正则",
      "/<(variable(?:insert|edit|delete))>\\s*(?=[\\s\\S]*?\\S[\\s\\S]*?<\\/\\1>)((?:(?!<(?:era_data|variable(?:think|insert|edit|delete))>|<\\/\\1>)[\\s\\S])*?)\\s*<\\/\\1>/gi",
      "",
      true,
      true,
    ),
    regexPayload(
      "ERA 状态栏模板",
      "/<StatusPlaceHolderImpl\\/>/gsi",
      `\`\`\`html\n${statusBarHtml()}\n\`\`\``,
      false,
      false,
    ),
    regexPayload(
      "ERA 元数据隐藏正则",
      "/<era_data>\\s*(?=[\\s\\S]*?\\S[\\s\\S]*?<\\/era_data>)((?:(?!<(?:era_data|variable(?:think|insert|edit|delete))>|<\\/era_data>)[\\s\\S])*?)\\s*<\\/era_data>/gi",
      "",
      true,
      true,
    ),
    regexPayload(
      "ERA 思考块隐藏正则",
      "/<variablethink>\\s*(?=[\\s\\S]*?\\S[\\s\\S]*?<\\/variablethink>)((?:(?!<variablethink>)[\\s\\S])*?)\\s*<\\/variablethink>/gi",
      "",
      true,
      true,
    ),
  ]);
}

function regexName(value: unknown): string | null {
  return isRecord(value) && typeof value.script_name === "string"
    ? value.script_name
    : null;
}

/** 按 script_name 规划仅缺失正则的追加；已有对象保持原样。 */
export function planEraCharacterRegexes(
  input: EraRegexPlanInputV1,
): EraRegexPlanV1 {
  if (!input.localRegexEnabled) {
    return cloneResourcePlanValue({
      kind: "regex",
      status: "skipped",
      reason: "当前角色卡未开启局部正则，请先在角色卡设置中启用。",
      details: [],
      actions: [],
    });
  }
  if (input.context.kind === "group-chat") {
    return cloneResourcePlanValue({
      kind: "regex",
      status: "skipped",
      reason: "群聊没有可安全更新的单一角色局部正则。",
      details: [],
      actions: [],
    });
  }
  if (input.context.kind === "no-character") {
    return cloneResourcePlanValue({
      kind: "regex",
      status: "skipped",
      reason: "当前聊天没有角色，无法规划角色局部正则。",
      details: [],
      actions: [],
    });
  }

  const existingNames = input.existingRegexes
    .map(regexName)
    .filter((name): name is string => name !== null);
  const details: EraRegexDetailV1[] = [];
  const actions: Array<{
    readonly kind: "upsert-missing-regex";
    readonly regex: EraRegexPayloadV1;
  }> = [];
  for (const regex of getEraRegexPayloads()) {
    if (existingNames.includes(regex.script_name)) {
      details.push({ regexName: regex.script_name, status: "exists" });
    } else {
      details.push({ regexName: regex.script_name, status: "planned" });
      actions.push({ kind: "upsert-missing-regex", regex });
    }
  }
  return cloneResourcePlanValue({
    kind: "regex",
    status: "ready",
    details,
    actions,
  });
}

/**
 * 只规划消息文本更新。附件不进入 action，因此执行器不能借此重写附件。
 */
export function planEraPlaceholder(
  input: EraPlaceholderPlanInputV1,
): EraPlaceholderPlanV1 {
  if (!input.enabled) {
    return cloneResourcePlanValue({
      kind: "placeholder",
      status: "skipped",
      reason: "占位符保障功能未开启。",
      actions: [],
    });
  }
  if (input.message.kind === "missing") {
    return cloneResourcePlanValue({
      kind: "placeholder",
      status: "skipped",
      reason: `未找到消息 ${input.message.messageId}。`,
      actions: [],
    });
  }
  if (input.message.role !== "assistant") {
    return cloneResourcePlanValue({
      kind: "placeholder",
      status: "skipped",
      reason:
        input.message.role === "user"
          ? "用户消息不追加 ERA 占位符。"
          : "消息角色不明确，拒绝修改其文本。",
      actions: [],
    });
  }
  const currentContent = input.message.textContent;
  if (currentContent && currentContent.includes(input.placeholder)) {
    return cloneResourcePlanValue({
      kind: "placeholder",
      status: "exists",
      reason: "AI 消息已经包含目标占位符。",
      actions: [],
    });
  }
  const textContent =
    (currentContent || "").trimEnd() + "\n" + input.placeholder;
  return cloneResourcePlanValue({
    kind: "placeholder",
    status: "update",
    messageId: input.message.messageId,
    textContent,
    actions: [
      {
        kind: "update-message-text",
        messageId: input.message.messageId,
        textContent,
      },
    ],
  });
}
