const BLOCK_MS = 5000;
const TAG = '[SwipeAwaitDemo]';

type ProbeEvent =
  | 'demo-ready'
  | 'demo-stopped'
  | 'message-swiped-enter'
  | 'message-swiped-release'
  | 'generation-started'
  | 'generate-after-data'
  | 'chat-completion-settings-ready'
  | 'message-received'
  | 'generation-stopped'
  | 'generation-ended';

type ProbeRecord = {
  sequence: number;
  event: ProbeEvent;
  epochMs: number;
  performanceMs: number;
  details: Record<string, unknown>;
};

type ProbeState = {
  version: 1;
  active: boolean;
  blockMs: number;
  records: ProbeRecord[];
  stop: () => void;
};

type ProbeWindow = Window & {
  __ERA_SWIPE_AWAIT_DEMO__?: ProbeState;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

$(() => {
  const probeWindows = [
    ...new Set([window.parent, window.top].filter((item): item is Window => item !== null)),
  ] as ProbeWindow[];

  // 热重载或重复导入时，先清理旧实例，避免多个监听器把延迟叠加。
  for (const probeWindow of probeWindows) {
    probeWindow.__ERA_SWIPE_AWAIT_DEMO__?.stop();
  }

  const records: ProbeRecord[] = [];
  let stopped = false;

  const record = (event: ProbeEvent, details: Record<string, unknown> = {}): ProbeRecord => {
    const item: ProbeRecord = {
      sequence: records.length + 1,
      event,
      epochMs: Date.now(),
      performanceMs: performance.now(),
      details,
    };
    records.push(item);
    // 既保留内存探针，也把完整记录序列化到 Console，方便自动化从顶层页面取证。
    console.info(`${TAG} ${JSON.stringify(item)}`);
    return item;
  };

  const onMessageSwiped = async (messageId: number) => {
    const [message] = getChatMessages(messageId, { include_swipes: true });
    const isOverswipe =
      message !== undefined && Array.isArray(message.swipes) && Number(message.swipe_id) >= message.swipes.length;
    const started = record('message-swiped-enter', {
      messageId,
      blockMs: BLOCK_MS,
      isOverswipe,
      swipeId: message?.swipe_id,
      swipeCount: message?.swipes.length,
    });

    if (!isOverswipe) {
      record('message-swiped-release', {
        messageId,
        blocked: false,
        elapsedMs: performance.now() - started.performanceMs,
      });
      return;
    }

    // 关键验证点：这个 Promise 会被 Tavern Helper 原样返回给 SillyTavern，
    // 而 SillyTavern 会 await 监听器完成后才继续 swipe/生成流程。
    await sleep(BLOCK_MS);

    record('message-swiped-release', {
      messageId,
      blocked: true,
      elapsedMs: performance.now() - started.performanceMs,
    });
  };

  const onGenerationStarted: ListenerType[typeof tavern_events.GENERATION_STARTED] = (type, options, dryRun) => {
    record('generation-started', {
      type,
      dryRun,
      hasAbortSignal: options?.signal instanceof AbortSignal,
    });
  };

  const onGenerateAfterData: ListenerType[typeof tavern_events.GENERATE_AFTER_DATA] = (_generateData, dryRun) => {
    record('generate-after-data', { dryRun });
  };

  const onChatCompletionSettingsReady: ListenerType[typeof tavern_events.CHAT_COMPLETION_SETTINGS_READY] = data => {
    record('chat-completion-settings-ready', {
      model: data.model,
      stream: data.stream,
    });
  };

  const onMessageReceived: ListenerType[typeof tavern_events.MESSAGE_RECEIVED] = (messageId, type) => {
    record('message-received', { messageId, type });
  };

  const onGenerationStopped = () => {
    record('generation-stopped');
  };

  const onGenerationEnded: ListenerType[typeof tavern_events.GENERATION_ENDED] = messageId => {
    record('generation-ended', { messageId });
  };

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;

    // 保留原 handler 并显式移除，确保 demo 热重载后不会叠加监听。
    eventRemoveListener(tavern_events.MESSAGE_SWIPED, onMessageSwiped);
    eventRemoveListener(tavern_events.GENERATION_STARTED, onGenerationStarted);
    eventRemoveListener(tavern_events.GENERATE_AFTER_DATA, onGenerateAfterData);
    eventRemoveListener(tavern_events.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);
    eventRemoveListener(tavern_events.MESSAGE_RECEIVED, onMessageReceived);
    eventRemoveListener(tavern_events.GENERATION_STOPPED, onGenerationStopped);
    eventRemoveListener(tavern_events.GENERATION_ENDED, onGenerationEnded);

    probeState.active = false;
    record('demo-stopped');

    for (const probeWindow of probeWindows) {
      if (probeWindow.__ERA_SWIPE_AWAIT_DEMO__ === probeState) {
        delete probeWindow.__ERA_SWIPE_AWAIT_DEMO__;
      }
    }
    $(window).off('.swipe-await-demo');
  };

  const probeState: ProbeState = {
    version: 1,
    active: true,
    blockMs: BLOCK_MS,
    records,
    stop,
  };
  for (const probeWindow of probeWindows) {
    probeWindow.__ERA_SWIPE_AWAIT_DEMO__ = probeState;
  }

  eventMakeFirst(tavern_events.MESSAGE_SWIPED, onMessageSwiped);
  eventMakeFirst(tavern_events.GENERATION_STARTED, onGenerationStarted);
  eventMakeFirst(tavern_events.GENERATE_AFTER_DATA, onGenerateAfterData);
  eventMakeFirst(tavern_events.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);
  eventMakeFirst(tavern_events.MESSAGE_RECEIVED, onMessageReceived);
  eventMakeFirst(tavern_events.GENERATION_STOPPED, onGenerationStopped);
  eventMakeFirst(tavern_events.GENERATION_ENDED, onGenerationEnded);

  record('demo-ready', { blockMs: BLOCK_MS });
  toastr.info(`Swipe Promise 等待测试已启用：overswipe 将等待 ${BLOCK_MS}ms。`, TAG);

  $(window).on('pagehide.swipe-await-demo', stop);
});
