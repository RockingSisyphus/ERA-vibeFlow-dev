/** Regex and placeholder planning; shared resource setup is registered separately. */
import type {
  EraRegexPayloadV1, EraRegexPlanInputV1, EraRegexDetailV1,
  EraRegexPlanV1, EraPlaceholderPlanInputV1, EraPlaceholderPlanV1,
} from "./resource_contracts.ts";
import { isRecord, cloneResourcePlanValue } from "./resource_setup.ts";
export * from "./resource_contracts.ts";
export * from "./resource_setup.ts";

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
    (() => {
      let closed = false;
      addEventListener('pagehide', () => { closed = true; }, { once: true });
      const mountEraStatusbar = () => closed ? false : window.parent.ERA.statusbar.mount(window);
      window.eraStatusbarMounted = window.parent.ERA
        ? Promise.resolve(mountEraStatusbar())
        : waitGlobalInitialized('ERA').then(mountEraStatusbar);
      void window.eraStatusbarMounted.catch(error => {
        if (!closed) document.body.dataset.eraStatusbarBootstrapError = error instanceof Error ? error.message : String(error);
      });
    })();
  </script>
  <section class="era-demo" data-era-statusbar-root="v1" data-era-overflow="placeholder" data-era-demo-statusbar="v2" hidden inert>
    <h3>ERA 示例状态栏</h3>
    <div class="grid">
      <div class="cell"><div class="label">宏：所在楼 HP</div><div class="value" data-era-demo-source="macro" data-era-demo-field="era_demo.player.hp">{{ERA:era_demo.player.hp}}</div></div>
      <div class="cell"><div class="label">宏：所在楼角色档案规则</div><div class="value" data-era-demo-source="macro-withmeta" data-era-demo-field="era_demo.player.$meta.fields.profile">{{ERA-withmeta:era_demo.player.$meta.fields.profile}}</div></div>
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
        <button disabled data-era-demo-action="variable-insert">Variable Insert</button>
        <button disabled data-era-demo-action="variable-edit">Variable Edit</button>
        <button disabled data-era-demo-action="variable-delete">Variable Delete</button>
        <button disabled data-era-demo-action="function-insert">Function Insert</button>
        <button disabled data-era-demo-action="function-edit">Function Edit</button>
        <button disabled data-era-demo-action="function-writeback">函数计算并写回</button>
        <button disabled data-era-demo-action="function-delete">Function Delete</button>
        <button disabled data-era-demo-action="scope-message">message scope</button>
        <button disabled data-era-demo-action="scope-branch">branch scope</button>
        <button disabled data-era-demo-action="scope-always">always scope</button>
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
      let closed = false;
      let removeAutomaticStatus = () => undefined;
      let unsubscribe = () => undefined;
      void window.eraStatusbarMounted.then(mounted => closed || mounted === false ? null : ERA.ready()).then(async current => {
        if (closed || current === null) return;
        const messageId = current.message_id;
        const handleAutomaticStatus = event => {
          const detail = event && event.detail;
          if (detail && detail.messageId === messageId) show('auto', 'status', detail);
        };
        owner.addEventListener(automaticStatusEvent, handleAutomaticStatus);
        removeAutomaticStatus = () => owner.removeEventListener(automaticStatusEvent, handleAutomaticStatus);
        let historyRead = 0;
        const renderHistorical = async () => {
          const read = ++historyRead;
          try {
            const historical = await ERA.history.atMessage(messageId);
            if (closed || read !== historyRead) return;
            show('history', 'statWithoutMeta', demo(historical));
            show('history', 'statFunc', historical.statFunc);
            show('history', 'identity', identity(historical));
          } catch (error) {
            if (!closed && read === historyRead) show('history', 'identity', { status: 'failed', error: error instanceof Error ? error.message : String(error) });
          }
        };
        // 显式历史查询不是订阅；每次本楼发布后重新查询，保留各读取 API 的真实语义。
        unsubscribe = ERA.subscribe(state => {
          renderCurrent(state);
          renderSubscription(state);
          void renderHistorical();
        });
        document.querySelectorAll('[data-era-demo-action]').forEach(button => button.addEventListener('click', () => void runManual(button.dataset.eraDemoAction)));
        // 作者交互只在 ERA.ready 已完成并安装点击处理后开放。
        setBusy(false);
        try { await runAutomatic(messageId); }
        catch (error) { show('auto', 'status', { status: 'failed', error: error instanceof Error ? error.message : String(error) }); }
      }).catch(error => {
        if (!closed) show('receipt', 'latest', { status: 'failed', error: error instanceof Error ? error.message : String(error) });
      });
      addEventListener('pagehide', () => { closed = true; unsubscribe(); removeAutomaticStatus(); }, { once: true });
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
