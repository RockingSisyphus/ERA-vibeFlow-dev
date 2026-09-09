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
  readonly 历史状态栏显示范围: number;
  readonly 历史状态栏超出范围行为: "placeholder" | "empty" | "hidden";
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

export interface EraGreetingPlanInputV1 {
  readonly mode?: "traditional" | "external";
  readonly context: EraCharacterContextV1;
  readonly firstMessage: string | null;
}

export type EraGreetingPlanV1 =
  | {
      readonly kind: "greeting";
      readonly status: "created";
      readonly expected: string;
      readonly next: string;
    }
  | {
      readonly kind: "greeting";
      readonly status: "unchanged" | "skipped";
      readonly reason: string;
    };

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
    readonly display: boolean;
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
  readonly compatibility?: "managed-v2" | "legacy-unmanaged";
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

function readOverflowBehavior(
  source: Readonly<Record<string, unknown>>,
  issues: EraSettingsIssueV1[],
): "placeholder" | "empty" | "hidden" {
  const field = "历史状态栏超出范围行为";
  const value = source[field];
  if (value === undefined) return "placeholder";
  if (value === "placeholder" || value === "empty" || value === "hidden") return value;
  issues.push({ field, expected: "string", actual: actualType(value) });
  return "placeholder";
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
    "历史状态栏显示范围",
    "历史状态栏超出范围行为",
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
    历史状态栏显示范围: readNumber(normalized, "历史状态栏显示范围", 3, issues),
    历史状态栏超出范围行为: readOverflowBehavior(normalized, issues),
    繁体转简体: readBoolean(normalized, "繁体转简体", false, issues),
    调试模式: readBoolean(normalized, "调试模式", false, issues),
  };
  if (
    typeof normalized["历史状态栏显示范围"] === "number" &&
    (!Number.isSafeInteger(normalized["历史状态栏显示范围"]) ||
      normalized["历史状态栏显示范围"] < 0)
  ) {
    issues.push({
      field: "历史状态栏显示范围",
      expected: "number",
      actual: "negative-or-non-integer-number",
    });
  }
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
  const relativeRules = `    - **数值表达式更新**: 仅在需要基于已有变量计算时，把目标值写成只含 \`$expr\` 的对象，例如 \`{"hp":{"$expr":"hp - damage"}}\`。普通数值仍是直接赋值。
    - \`a\` 读取当前消息内已经更新后的 a；\`@a\` 读取本条消息开始时的 a。表达式结果与被引用变量都必须是有限数字。
    - 可先用 \`<FunctionInsert>\`、\`<FunctionEdit>\`、\`<FunctionDelete>\` 管理纯函数库；\`f(x)\` 使用当前函数，\`@f(x)\` 使用本消息开始时函数闭包。
    - 禁止输出 \`$inc\`、\`$mul\`、\`$div\`、\`$sub\`、\`$set\` 及 \`"+=2"\`、\`"-=2"\`、\`"*=2"\`、\`"/=2"\`；旧运算对象会被跳过，字符串仍只是普通字符串。`;
  return baselineOperationRuleContent()
    .replace(
      "- **`<VariableEdit>`**:\n    - **只改不增**: 用于修改已存在的数据，它绝不会在不存在的路径上创建新数据。",
      `- **\`<VariableEdit>\`**:\n    - **只改不增**: 用于修改已存在的数据，它绝不会在不存在的路径上创建新数据。\n${relativeRules}`,
    )
    .replace('"hp": 10', '"hp": { "$expr": "hp - 5" }');
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

const ERA_DEMO_GREETING_MARKER = "<!-- ERA_DEMO_GREETING_V2_BEGIN -->";

/** 快速初始化追加到角色主开场白的幂等示例；默认测试模式绝不自动写入。 */
export function getEraDemoGreetingBlock(mode: "traditional" | "external" = "traditional"): string {
  return `${ERA_DEMO_GREETING_MARKER}
<VariableInsert>
{
  "era_demo": {
    "player": {
      "name": "Aster",
      "level": 1,
      "hp": 12,
      "max_hp": 20,
      "alive": true,
      "note": null,
      "inventory": ["torch", "rope"],
      "profile": {
        "title": "Apprentice",
        "$meta": { "necessary": true, "updatable": true }
      }
    },
    "world": {
      "npcs": {
        "guide": { "name": "Mira", "mood": "calm" }
      }
    },
    "temporary": {
      "edit_target": 1,
      "delete_target": "remove-me"
    },
    "function_results": { "last": 0 },
    "scope_counts": {
      "manual": { "message": 0, "branch": 0, "always": 0 },
      "automatic": { "message": 0, "branch": 0, "always": 0 }
    },
      "test_mode": {
        "enabled": false,
        "run_id": "",
        "max_loads_per_floor": 0,
        "load_counts": {},
        "last_receipts": {}
      }
  }
}
</VariableInsert>
${mode === "traditional" ? "<StatusPlaceHolderImpl/>" : ""}`;
}

/** 保留作者正文；唯一标记存在即视为已初始化，否则追加示例块。 */
export function planEraDemoGreeting(input: EraGreetingPlanInputV1): EraGreetingPlanV1 {
  if (input.context.kind === "group-chat") {
    return cloneResourcePlanValue({ kind: "greeting", status: "skipped", reason: "群聊没有可安全更新的单一角色主开场白。" });
  }
  if (input.context.kind === "no-character" || input.firstMessage === null) {
    return cloneResourcePlanValue({ kind: "greeting", status: "skipped", reason: "当前聊天没有可更新的角色主开场白。" });
  }
  const current = input.firstMessage;
  const block = getEraDemoGreetingBlock(input.mode);
  if (current.includes(ERA_DEMO_GREETING_MARKER)) {
    return cloneResourcePlanValue({ kind: "greeting", status: "unchanged", reason: "主开场白已包含 ERA 示例标记。" });
  }
  const separator = current.trimEnd().length === 0 ? "" : "\n\n";
  return cloneResourcePlanValue({
    kind: "greeting",
    status: "created",
    expected: current,
    next: current.trimEnd() + separator + block,
  });
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
  display = true,
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
    destination: { display, prompt },
    min_depth: null,
    max_depth: null,
  };
}


/**
 * 当前示例状态栏。每一种读取语义拥有独立 DOM 标识，测试和角色卡作者都能
 * 同屏比较“所在楼层历史”与“活动分支最新”而不互相冒充。
 */
function statusBarExampleHtml(): string {
  return String.raw`<!-- html> Tavern Helper 前端片段识别标记；文档外壳由 Helper 提供。 -->
<style data-era-statusbar-shell-style>
    .era-demo { color-scheme:dark; font-family:system-ui,sans-serif; color:#edf4f6; margin:12px 0; padding:14px; border:1px solid #446675; border-radius:12px; background:linear-gradient(145deg,#243641,#304b58); box-shadow:0 6px 18px #0005; }
    h3,h4 { margin:0 0 9px; color:#67e3c1; }
    h4 { margin-top:14px; font-size:.95rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:7px; }
    .cell { min-width:0; padding:7px 9px; border-radius:7px; background:#ffffff0d; }
    .label { color:#b7c9d1; font-size:.76rem; }
    .value { margin-top:3px; overflow-wrap:anywhere; white-space:pre-wrap; font-family:ui-monospace,monospace; font-size:.82rem; }
    .actions { display:flex; flex-wrap:wrap; gap:6px; }
    button { border:1px solid #579080; border-radius:7px; padding:6px 9px; color:#eef; background:#203d3a; cursor:pointer; }
    button:disabled { opacity:.55; cursor:wait; }
    .receipt { margin-top:8px; min-height:2.6em; padding:7px; border-radius:7px; background:#0003; white-space:pre-wrap; font: .78rem ui-monospace,monospace; }
    details { margin-top:10px; }
    summary { cursor:pointer; color:#9fc7d5; }
  </style>
  <script data-era-statusbar-bootstrap>
    const mountEraStatusbar = () => window.parent.ERA.statusbar.mount(window);
    window.eraStatusbarMounted = window.parent.ERA
      ? mountEraStatusbar()
      : waitGlobalInitialized('ERA').then(mountEraStatusbar);
    void window.eraStatusbarMounted.catch(error => {
      document.body.dataset.eraStatusbarBootstrapError = error instanceof Error ? error.message : String(error);
    });
  </script>
  <section class="era-demo" data-era-statusbar-root="v1" data-era-overflow="placeholder" data-era-demo-statusbar="v2" hidden inert>
    <h3>ERA 示例状态栏</h3>
    <div class="grid">
      <div class="cell"><div class="label">宏：所在楼 HP</div><div class="value" data-era-demo-source="macro" data-era-demo-field="era_demo.player.hp">{{ERA:era_demo.player.hp}}</div></div>
      <div class="cell"><div class="label">宏：所在楼对象（含 meta）</div><div class="value" data-era-demo-source="macro-withmeta" data-era-demo-field="era_demo.player.profile">{{ERA-withmeta:era_demo.player.profile}}</div></div>
      <div class="cell"><div class="label">宏：数组</div><div class="value" data-era-demo-source="macro" data-era-demo-field="era_demo.player.inventory">{{ERA:era_demo.player.inventory}}</div></div>
      <div class="cell"><div class="label">宏：不存在路径</div><div class="value" data-era-demo-source="macro" data-era-demo-field="era_demo.missing">{{ERA:era_demo.missing}}</div></div>
    </div>

    <h4>ERA.get()：本状态栏所在楼层</h4>
    <div class="grid" data-era-demo-section="get">
      <div class="cell"><div class="label">statData</div><div class="value" data-era-demo-source="get" data-era-demo-field="statData"></div></div>
      <div class="cell"><div class="label">stat</div><div class="value" data-era-demo-source="get" data-era-demo-field="stat"></div></div>
      <div class="cell"><div class="label">statWithoutMeta</div><div class="value" data-era-demo-source="get" data-era-demo-field="statWithoutMeta"></div></div>
      <div class="cell"><div class="label">statFunc</div><div class="value" data-era-demo-source="get" data-era-demo-field="statFunc"></div></div>
      <div class="cell"><div class="label">mk / message / revision</div><div class="value" data-era-demo-source="get" data-era-demo-field="identity"></div></div>
    </div>

    <h4>ERA.subscribe()：本楼投影更新</h4>
    <div class="grid">
      <div class="cell"><div class="label">所在楼变量</div><div class="value" data-era-demo-source="subscribe" data-era-demo-field="statWithoutMeta"></div></div>
      <div class="cell"><div class="label">mk / message / revision</div><div class="value" data-era-demo-source="subscribe" data-era-demo-field="identity"></div></div>
    </div>

    <h4>ERA.history.atMessage()：状态栏所在楼层</h4>
    <div class="grid">
      <div class="cell"><div class="label">历史变量</div><div class="value" data-era-demo-source="history" data-era-demo-field="statWithoutMeta"></div></div>
      <div class="cell"><div class="label">历史函数</div><div class="value" data-era-demo-source="history" data-era-demo-field="statFunc"></div></div>
      <div class="cell"><div class="label">mk / message / revision</div><div class="value" data-era-demo-source="history" data-era-demo-field="identity"></div></div>
    </div>

    <details>
      <summary>真实 ERA.commit() 示例</summary>
      <div class="actions">
        <button data-era-demo-action="variable-insert">Variable Insert</button>
        <button data-era-demo-action="variable-edit">Variable Edit</button>
        <button data-era-demo-action="variable-delete">Variable Delete</button>
        <button data-era-demo-action="function-insert">Function Insert</button>
        <button data-era-demo-action="function-edit">Function Edit</button>
        <button data-era-demo-action="function-writeback">函数计算并写回</button>
        <button data-era-demo-action="function-delete">Function Delete</button>
        <button data-era-demo-action="scope-message">message scope</button>
        <button data-era-demo-action="scope-branch">branch scope</button>
        <button data-era-demo-action="scope-always">always scope</button>
      </div>
      <div class="receipt" data-era-demo-source="receipt" data-era-demo-field="latest">尚未执行</div>
    </details>
    <div class="value" data-era-demo-source="auto" data-era-demo-field="status">自动测试模式未运行</div>
  </section>
  <script>
    (() => {
      const encode = value => {
        if (value === undefined) return '[undefined]';
        try { return JSON.stringify(value); } catch { return String(value); }
      };
      window.__ERA_DEMO_AUTHOR_EXECUTION_COUNT__ = (window.__ERA_DEMO_AUTHOR_EXECUTION_COUNT__ || 0) + 1;
      document.body.dataset.eraDemoAuthorExecutionCount = String(window.__ERA_DEMO_AUTHOR_EXECUTION_COUNT__);
      const field = (source, name) => document.querySelector('[data-era-demo-source="' + source + '"][data-era-demo-field="' + name + '"]');
      const show = (source, name, value) => { const node = field(source, name); if (node) node.textContent = encode(value); };
      const owner = (() => { try { return window.top || window; } catch { return window; } })();
      const automaticStatusEvent = 'era-demo-automatic-status';
      const identity = state => ({ mk: state.mk, message_id: state.message_id, revision: state.revision });
      const demo = state => state && state.statWithoutMeta && state.statWithoutMeta.era_demo;
      const renderCurrent = state => {
        show('get', 'statData', state.statData && state.statData.era_demo);
        show('get', 'stat', state.stat && state.stat.era_demo);
        show('get', 'statWithoutMeta', demo(state));
        show('get', 'statFunc', state.statFunc);
        show('get', 'identity', identity(state));
      };
      const renderSubscription = state => {
        show('subscribe', 'statWithoutMeta', demo(state));
        show('subscribe', 'identity', identity(state));
      };
      const receiptView = receipt => ({ status: receipt.status, scope: receipt.scope, messageId: receipt.messageId, state: identity(receipt.state) });
      const nestedIncrement = (branch, scope) => ({ edit: { era_demo: { scope_counts: { [branch]: { [scope]: { $expr: 'era_demo.scope_counts.' + branch + '.' + scope + ' + 1' } } } } } });
      const action = name => {
        if (name === 'variable-insert') return { operations: [{ insert: { era_demo: { temporary: { manual_inserted: 'created' } } } }] };
        if (name === 'variable-edit') return { operations: [{ edit: { era_demo: { temporary: { edit_target: { $expr: 'era_demo.temporary.edit_target + 1' } } } } }] };
        if (name === 'variable-delete') return { operations: [{ delete: { era_demo: { temporary: { delete_target: {} } } } }] };
        if (name === 'function-insert') return { operations: [{ functionInsert: { era_demo_double: { params: ['x'], expr: 'x * 2' } } }] };
        if (name === 'function-edit') return { operations: [{ functionEdit: { era_demo_double: { params: ['x'], expr: 'x * 3' } } }] };
        if (name === 'function-delete') return { operations: [{ functionDelete: { era_demo_double: {} } }] };
        if (name === 'function-writeback') return { operations: [{ edit: { era_demo: { function_results: { last: { $expr: 'era_demo_double(era_demo.player.level)' } } } } }] };
        const scope = name.slice('scope-'.length);
        return { scope, operations: [nestedIncrement('manual', scope)] };
      };
      const setBusy = busy => document.querySelectorAll('[data-era-demo-action]').forEach(button => { button.disabled = busy; });
      const runManual = async name => {
        setBusy(true);
        try {
          const request = action(name);
          const receipt = await ERA.commit(request.operations, { scope: request.scope || 'message' });
          show('receipt', 'latest', receiptView(receipt));
        } catch (error) {
          show('receipt', 'latest', { status: 'failed', error: error instanceof Error ? error.message : String(error) });
        } finally { setBusy(false); }
      };
      const runAutomatic = async messageId => {
        const current = ERA.get();
        const test = demo(current) && demo(current).test_mode;
        if (!test || test.enabled !== true) return;
        const maximum = Number(test.max_loads_per_floor || 0);
        const loads = test.load_counts && typeof test.load_counts === 'object' ? test.load_counts : {};
        const previous = Number(loads[String(messageId)] || 0);
        const lastReceipts = test.last_receipts && typeof test.last_receipts === 'object' ? test.last_receipts : {};
        const completed = lastReceipts[String(messageId)];
        if (!Number.isSafeInteger(maximum) || maximum <= 0 || previous >= maximum) {
          show('auto', 'status', completed || { run_id: test.run_id, messageId, previous, maximum, status: 'budget-exhausted' });
          return;
        }
        const loadPatch = { era_demo: { test_mode: { load_counts: { [String(messageId)]: previous + 1 } } } };
        const firstLoad = !Object.prototype.hasOwnProperty.call(loads, String(messageId));
        const receipts = [];
          // 第一笔事务原子记录本次真实挂载。状态发布只更新现有 iframe，
          // 不会重建状态栏或再次执行作者脚本，因此无需页面级防重锁。
          receipts.push(await ERA.commit([
            nestedIncrement('automatic', 'always'),
            firstLoad ? { insert: loadPatch } : { edit: loadPatch },
          ], { scope: 'always' }));
          receipts.push(await ERA.commit([nestedIncrement('automatic', 'message')], { scope: 'message' }));
          receipts.push(await ERA.commit([nestedIncrement('automatic', 'branch')], { scope: 'branch' }));
          const result = { run_id: test.run_id, messageId, load: previous + 1, receipts: receipts.map(receiptView) };
          const receiptPatch = { era_demo: { test_mode: { last_receipts: { [String(messageId)]: result } } } };
          const firstReceipt = !Object.prototype.hasOwnProperty.call(lastReceipts, String(messageId));
          await ERA.commit([firstReceipt ? { insert: receiptPatch } : { edit: receiptPatch }], { scope: 'always' });
          show('auto', 'status', result);
          owner.dispatchEvent(new CustomEvent(automaticStatusEvent, { detail: result }));
      };
      let unsubscribe = () => undefined;
      void window.eraStatusbarMounted.then(() => ERA.ready()).then(async current => {
        const messageId = current.message_id;
        const handleAutomaticStatus = event => {
          const detail = event && event.detail;
          if (detail && detail.messageId === messageId) show('auto', 'status', detail);
        };
        owner.addEventListener(automaticStatusEvent, handleAutomaticStatus);
        window.addEventListener('unload', () => owner.removeEventListener(automaticStatusEvent, handleAutomaticStatus), { once: true });
        let historyRead = 0;
        const renderHistorical = async () => {
          const read = ++historyRead;
          try {
            const historical = await ERA.history.atMessage(messageId);
            if (read !== historyRead) return;
            show('history', 'statWithoutMeta', demo(historical));
            show('history', 'statFunc', historical.statFunc);
            show('history', 'identity', identity(historical));
          } catch (error) {
            if (read === historyRead) show('history', 'identity', { status: 'failed', error: error instanceof Error ? error.message : String(error) });
          }
        };
        // 显式历史查询不是订阅；每次本楼发布后重新查询，保留各读取 API 的真实语义。
        unsubscribe = ERA.subscribe(state => {
          renderCurrent(state);
          renderSubscription(state);
          void renderHistorical();
        });
        document.querySelectorAll('[data-era-demo-action]').forEach(button => button.addEventListener('click', () => void runManual(button.dataset.eraDemoAction)));
        try { await runAutomatic(messageId); }
        catch (error) { show('auto', 'status', { status: 'failed', error: error instanceof Error ? error.message : String(error) }); }
      });
      addEventListener('pagehide', () => unsubscribe(), { once: true });
    })();
  </script>
`;
}

/** 返回 ERA 的角色局部正则，保持冻结顺序与完整载荷。 */
export function getEraRegexPayloads(): readonly EraRegexPayloadV1[] {
  return cloneResourcePlanValue([
    regexPayload(
      "ERA 状态栏模板",
      "/<StatusPlaceHolderImpl\\/>/gsi",
      `\n\n\`\`\`html\n${statusBarExampleHtml()}\n\`\`\`\n\n`,
      false,
      false,
    ),
  ]);
}

function regexName(value: unknown): string | null {
  return isRecord(value) && typeof value.script_name === "string"
    ? value.script_name
    : null;
}

function regexIsManagedV2(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.replace_string === "string" &&
    value.replace_string.includes("data-era-statusbar-root");
}

/** 按 script_name 规划仅缺失正则的追加；已有对象保持原样。 */
export function planEraCharacterRegexes(
  input: EraRegexPlanInputV1,
): EraRegexPlanV1 {
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
      const existing = input.existingRegexes.find(value => regexName(value) === regex.script_name);
      details.push({
        regexName: regex.script_name,
        status: "exists",
        compatibility: regexIsManagedV2(existing) ? "managed-v2" : "legacy-unmanaged",
      });
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
