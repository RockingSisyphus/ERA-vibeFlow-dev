/** Settings, greeting and worldbook planning. */
import type {
  EraSettingsV1, EraSettingsIssueV1, EraSettingsPlanV1,
  EraGreetingPlanInputV1, EraGreetingPlanV1,
  EraWorldbookEntryV1, EraWorldbookPlanInputV1,
  EraWorldbookActionV1, EraWorldbookEntryPlanV1, EraWorldbookPlanV1,
} from "./resource_contracts.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
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
