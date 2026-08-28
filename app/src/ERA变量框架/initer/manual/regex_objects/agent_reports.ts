export const FOLD_ERA_AGENT_REPORTS_REGEX: Omit<TavernRegex, 'id' | 'scope'> = {
  script_name: 'ERA Agent 报告折叠正则',
  enabled: true,
  run_on_edit: true,
  find_regex: String.raw`/<era_(plan|update|agent_error)>([\s\S]*?)<\/era_\1>/gi`,
  replace_string: '<details class="era-agent-report"><summary>ERA 阶段报告</summary><pre>$2</pre></details>',
  trim_strings: [],
  source: { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false },
  destination: { display: true, prompt: false },
  min_depth: null,
  max_depth: null,
};

export const STRIP_ERA_AGENT_REPORTS_REGEX: Omit<TavernRegex, 'id' | 'scope'> = {
  script_name: 'ERA Agent 提示清理正则',
  enabled: true,
  run_on_edit: true,
  find_regex: String.raw`/<era_(?:plan|update|agent_error)>[\s\S]*?<\/era_(?:plan|update|agent_error)>/gi`,
  replace_string: '',
  trim_strings: [],
  source: { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false },
  destination: { display: false, prompt: true },
  min_depth: null,
  max_depth: null,
};
