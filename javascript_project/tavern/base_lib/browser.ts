/** 原始 API 和只读数据转换。无队列、回执、重试或流程驱动。 */
export function browserApi(): any { return globalThis; }

/** 原生 debounce 只安排保存；等宿主实际保存成功的通知，取消时释放监听。 */
export function saveTavernSettings(tavern: any, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const source = tavern.eventSource;
    const event = tavern.eventTypes.SETTINGS_UPDATED;
    const cleanup = () => {
      source.removeListener(event, complete);
      signal.removeEventListener("abort", cancel);
    };
    const complete = () => { cleanup(); resolve(); };
    const cancel = () => { cleanup(); reject(signal.reason); };
    source.on(event, complete);
    signal.addEventListener("abort", cancel, {once: true});
    try { tavern.saveSettingsDebounced(); }
    catch (error) { cleanup(); reject(error); }
  });
}

export function browserHosts(api: any): any[] {
  return [...new Set([api.window?.top, api.window?.parent, api.window, api].filter(Boolean))];
}
export function currentTavern(api: any): any {
  for (const host of browserHosts(api)) {
    const context = host.SillyTavern?.getContext?.();
    if (context && Array.isArray(context.characters) && Object.hasOwn(context, "characterId") && typeof context.writeExtensionField === "function") return context;
  }
  return api.SillyTavern;
}
export function record(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function variableScope(value: any): any {
  if (!record(value) || typeof value.type !== "string") return {type: "chat"};
  if (value.type === "chat") return {type: "chat"};
  if (value.type === "script") return typeof value.script_id === "string" ? {type: "script", script_id: value.script_id} : {type: "script"};
  if (value.type === "message") return typeof value.message_id === "number" || value.message_id === "latest" ? {type: "message", message_id: value.message_id} : {type: "message"};
  throw new TypeError(`ERA 不允许的变量作用域：${value.type}`);
}
export function identity(api: any): any {
  return {characterId: api.getCurrentCharacterId(), groupId: api.SillyTavern.groupId || null, chatId: api.SillyTavern.getCurrentChatId()};
}
export function regexData(regex: any): any {
  const source = regex.source ?? {};
  const destination = regex.destination ?? {};
  return {
    id: regex.id, scriptName: regex.script_name, disabled: !regex.enabled, runOnEdit: regex.run_on_edit,
    findRegex: regex.find_regex, trimStrings: regex.trim_strings ?? [], replaceString: regex.replace_string,
    placement: [...(source.user_input ? [1] : []), ...(source.ai_output ? [2] : []), ...(source.slash_command ? [3] : []), ...(source.world_info ? [5] : []), ...(source.reasoning ? [6] : [])],
    substituteRegex: 0, minDepth: regex.min_depth, maxDepth: regex.max_depth,
    markdownOnly: destination.display, promptOnly: destination.prompt,
  };
}
export function currentRegexEnabled(api: any): boolean {
  for (const host of browserHosts(api)) {
    if (typeof host.isCharacterTavernRegexesEnabled === "function") return host.isCharacterTavernRegexesEnabled();
    if (typeof host.TavernHelper?.isCharacterTavernRegexesEnabled === "function") return host.TavernHelper.isCharacterTavernRegexesEnabled();
  }
  return api.isCharacterTavernRegexesEnabled();
}
export function enabledScriptIds(tree: any[], ancestor = true): string[] {
  return tree.flatMap(entry => {
    if (!ancestor || entry.enabled !== true) return [];
    return entry.type === "script" ? [entry.id] : enabledScriptIds(entry.scripts, true);
  });
}
/** 酒馆接口的绝对 URL，避免把页面 API 误当 AOT 的本地静态资源。 */
export function tavernEndpoint(api: any, path: string): string {
  const location = api.window?.top?.location ?? api.window?.location ?? api.location;
  return new URL(path, location.origin).href;
}
