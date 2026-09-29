/** Prompt and persistent report text for Agent stages. */
import type { JsonValue } from "@era/vibeflow-contracts";
import type { EraAgentStage, EraAgentRolePromptV1, EraAgentPlanningOutputV1 } from "./agent_configuration.ts";

function safeReport(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

export function formatAgentPlanReport(value: unknown): string {
  return `<era_plan>${safeReport(value)}</era_plan>`;
}

export function formatAgentUpdateReport(value: unknown): string {
  return `<era_update>${safeReport(value)}</era_update>`;
}

export function stripAgentReportsForPrompt(text: string): string {
  return text
    .replace(/<era_plan>[\s\S]*?<\/era_plan>/giu, "")
    .replace(/<era_update>[\s\S]*?<\/era_update>/giu, "")
    .replace(/<era_agent_error>[\s\S]*?<\/era_agent_error>/giu, "")
    .trim();
}

export function extractEraMessageKey(text: string): string | null {
  const match = text.match(/["']?era-message-key["']?\s*=\s*["']([^"']+)["']/u);
  return match?.[1] ?? null;
}

export function countAgentCycles(text: string): number {
  const plans = text.match(/<era_plan>/giu)?.length ?? 0;
  const updates = text.match(/<era_update>/giu)?.length ?? 0;
  return Math.max(plans, updates);
}

export function isolateStoryEraCommands(
  text: string,
): Readonly<{ story: string; audit: string }> {
  const patterns = [
    /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
    // 消息内函数调用及其操作区同样不是可见故事内容：正文模型写了它们也一律进审计，
    // 与结算开启时「正文标签不是写入者」的既有合同一致。
    /<EraFCallTx\b[^>]*>[\s\S]*?<\/EraFCallTx>/giu,
    /<EraFCall\b[^>]*?\/?>/giu,
    /<(?:Variable|Function)(?:Insert|Edit|Delete)\b[^>]*>[\s\S]*?<\/(?:Variable|Function)(?:Insert|Edit|Delete)>/giu,
  ];
  const captured: string[] = [];
  let story = text;
  for (const pattern of patterns) {
    story = story.replace(pattern, (match) => {
      captured.push(match);
      return "";
    });
  }
  story = stripAgentReportsForPrompt(story)
    .replace(/<era_data\b[^>]*>[\s\S]*?<\/era_data>/giu, "")
    .replace(/<StatusPlaceHolderImpl\s*\/>/giu, "")
    .trim();
  return { story, audit: captured.join("\n") };
}

export function builtinStagePrompts(
  stage: EraAgentStage,
): readonly (string | EraAgentRolePromptV1)[] {
  const contract =
    stage === "planning"
      ? '只输出严格 JSON：{"storyPlan":对象,"calls":[{"function":字符串,"args":数值数组,"purpose":可选字符串}]}。规划故事并仅列出确有必要的纯数值函数调用，不写正文。'
      : "直接按执行顺序输出 ERA 标签：<VariableInsert>JSON对象</VariableInsert>、<VariableEdit>JSON对象</VariableEdit>、<VariableDelete>JSON对象</VariableDelete>、<FunctionInsert>JSON对象</FunctionInsert>、<FunctionEdit>JSON对象</FunctionEdit>、<FunctionDelete>JSON对象</FunctionDelete>，可在任意操作之间使用 <EraFCall name=\"已注册函数名\" args='JSON对象' />。根据正式故事与当前状态只生成尚需执行的操作；无变化时输出空文本。不要输出 operations JSON、代码围栏或说明文字。";
  return [
    {
      role: "system",
      content: `你是 ERA ${stage === "planning" ? "故事规划" : "变量结算"}阶段。${contract}`,
    },
    "char_description",
    "char_personality",
    "scenario",
    "world_info_before",
    "world_info_after",
    "chat_history",
    "user_input",
  ];
}

export function buildStoryInjection(
  input: Readonly<{
    plan: EraAgentPlanningOutputV1;
    results: readonly Readonly<Record<string, JsonValue>>[];
  }>,
): string {
  return [
    "以下是 ERA 在正文生成前完成的故事计划与纯函数结果。请使用当前酒馆预设正常创作正式故事，不要复述报告，也不要自行改写函数结果。",
    safeReport({
      storyPlan: input.plan.storyPlan,
      calls: input.plan.calls,
      results: input.results,
    }),
  ].join("\n");
}

/** Check the report source before either restoring state or issuing a model request. */
