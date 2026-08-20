/*
 * 仅承载 ERA-Test-Pack 的临时身份测试接线：读取当前 Tavern 事实并发布测试报告。
 * marker 语义、匹配和重绑判断必须留在 VibeFlow service workflow，不能在此实现。
 */

import type { EraCapabilityContext } from './types';

const SIDECAR_TEST_FIXTURE_SESSION_KEY = '__ERA_SIDECAR_TEST_FIXTURE_V1__';
const SIDECAR_TEST_REPORT_GLOBAL_KEY = '__ERA_SIDECAR_TEST_REPORT__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clonePortable<T>(value: T): T {
  return structuredClone(value);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('ERA 宿主操作已取消。', 'AbortError');
}

/**
 * Tavern Helper 脚本可能处在同源 sandbox frame，Pack 则有意从顶层 Tavern
 * 页面运行。因此测试 fixture/report 必须使用一个明确受控的顶层槽；生产状态
 * 从不调用这里。
 */
function localWindow(): Record<string, unknown> | undefined {
  const candidate = (globalThis as { window?: unknown }).window;
  return candidate !== null && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : undefined;
}

function ownData(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

/** fixture/report 固定落在 Pack 明确控制的顶层槽。 */
function testGlobalRoot(): Record<string, unknown> {
  const local = localWindow();
  try {
    const candidate = local === undefined ? undefined : Reflect.get(local, 'top');
    if (candidate !== null && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
  } catch {
    // 未安装 fixture 时保持 probe 禁用，不构成宿主错误。
  }
  return globalThis as Record<string, unknown>;
}

/**
 * 与 Pack 的 topWindow 规则一致：身份来自当前同源 Tavern realm，而非任意跨域 frame。
 */
function identityGlobalRoot(): Record<string, unknown> {
  const local = localWindow();
  if (local === undefined) return globalThis as Record<string, unknown>;
  try {
    const candidate = Reflect.get(local, 'top');
    const localLocation = Reflect.get(local, 'location');
    const candidateLocation =
      candidate !== null && typeof candidate === 'object' ? Reflect.get(candidate, 'location') : undefined;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      isRecord(localLocation) &&
      isRecord(candidateLocation) &&
      typeof localLocation.origin === 'string' &&
      localLocation.origin === candidateLocation.origin
    ) {
      return candidate as Record<string, unknown>;
    }
  } catch {
    // Pack 也会在跨源或受限顶层窗口时回退到当前 realm。
  }
  return local;
}

function readSessionFixture(): unknown {
  try {
    const storage = (testGlobalRoot() as { sessionStorage?: Storage }).sessionStorage;
    const raw = storage?.getItem(SIDECAR_TEST_FIXTURE_SESSION_KEY);
    return typeof raw === 'string' ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readCurrentTavern(root: Record<string, unknown>): Record<string, unknown> {
  const tavern = [root, localWindow(), globalThis as Record<string, unknown>]
    .map(candidate => ownData(candidate, 'SillyTavern'))
    .find(isRecord);
  if (!isRecord(tavern)) {
    throw new TypeError('ERA Sidecar 测试无法读取顶层 Tavern 身份接口。');
  }
  return tavern;
}

function readIdentityContext(tavern: Record<string, unknown>): Record<string, unknown> {
  const readContext = ownData(tavern, 'getContext');
  const rawContext = typeof readContext === 'function' ? Reflect.apply(readContext, tavern, []) : undefined;
  return isRecord(rawContext) ? rawContext : {};
}

function currentStringOrNull(direct: unknown, fallback: unknown): unknown {
  return typeof direct === 'string' || direct === null ? direct : fallback;
}

function missingIdentityFields(identity: Readonly<Record<string, unknown>>): string[] {
  return [
    identity.characterId !== null && typeof identity.characterId !== 'string' ? 'characterId' : null,
    identity.groupId !== null && typeof identity.groupId !== 'string' ? 'groupId' : null,
    typeof identity.chatId !== 'string' || identity.chatId.length === 0 ? 'chatId' : null,
    typeof identity.scriptId !== 'string' || identity.scriptId.length === 0 ? 'scriptId' : null,
  ].filter((field): field is string => field !== null);
}

/**
 * 读取现有 Tavern 身份能力所见的原始身份事实。此函数不比较 marker、也不做重绑
 * 判定；字段缺失直接失败，随后由 workflow 把技术失败归类为 invalid。
 */
function readTopSidecarIdentity(): Readonly<Record<string, unknown>> {
  const root = identityGlobalRoot();
  const tavern = readCurrentTavern(root);
  const context = readIdentityContext(tavern);
  const directCharacterId = Reflect.get(tavern, 'characterId');
  const directGroupId = Reflect.get(tavern, 'groupId');
  const readChatId = ownData(tavern, 'getCurrentChatId');
  const directChatId = typeof readChatId === 'function' ? Reflect.apply(readChatId, tavern, []) : undefined;
  // 与 Pack 采用同一技术优先级：顶层公开成员优先，context 仅在模块未直出时回退。
  const characterId = currentStringOrNull(directCharacterId, ownData(context, 'characterId'));
  const groupId = currentStringOrNull(directGroupId, ownData(context, 'groupId'));
  const chatId = typeof directChatId === 'string' ? directChatId : ownData(context, 'chatId');
  const controller = ownData(root, '__STTestHarnessEraPackLoaderV4');
  const loaderScriptId = ownData(controller, 'scriptId');
  const helperScriptId = typeof getScriptId === 'function' ? getScriptId() : undefined;
  const scriptId = typeof loaderScriptId === 'string' && loaderScriptId.length > 0 ? loaderScriptId : helperScriptId;
  const identity = { characterId, groupId, chatId, scriptId };
  const missing = missingIdentityFields(identity);
  if (missing.length > 0) {
    throw new TypeError(`ERA Sidecar 测试无法读取完整的顶层 Tavern 身份：${missing.join('、')}。`);
  }
  return identity;
}

/**
 * 创建测试专用的 technical adapter。为了避免测试 probe 膨胀为第二套业务 Host，
 * 它只在 workflow 要求时读取当前聊天 marker；必须不写业务变量、不注册事件，
 * 否则会改变生产 FIFO 和同步时序，也不决定 marker 是匹配、冲突还是可以重绑。
 */
export interface SidecarTestAdapterOptions {
  /** 既有生产身份能力；所有业务解释仍由 workflow 负责。 */
  readonly readCurrentIdentity?: (context: EraCapabilityContext) => unknown;
}

/**
 * 创建测试专用 technical adapter。为了避免测试 probe 变成第二个业务 Host，它只
 * 搬运宿主事实和 workflow 报告，绝不保存 Sidecar 数据或判断业务结论。
 */
export function createSidecarTestAdapter(options: SidecarTestAdapterOptions = {}) {
  return {
    /**
     * 读取当前身份、当前聊天 marker 与 session fixture；缺少或损坏数据原样交给
     * workflow，由纯节点给出 invalid/not-applicable 等结论，不能在宿主层猜测。
     */
    read_context: async (
      _input: Readonly<Record<string, unknown>>,
      context: EraCapabilityContext,
    ): Promise<unknown> => {
      throwIfAborted(context.signal);
      // workflow 仅在已监听的少量生命周期/生成事件调用 probe；没有 Pack fixture
      // 时完全不读身份或聊天变量，确保普通生产流量无额外开销。
      const fixture = readSessionFixture();
      if (fixture === null) return { fixture: null };
      try {
        const chatVariables = getVariables({ type: 'chat' });
        const marker = isRecord(chatVariables) ? chatVariables.__eraSidecarTestV1 : undefined;
        const rawIdentity =
          options.readCurrentIdentity === undefined ? readTopSidecarIdentity() : options.readCurrentIdentity(context);
        const result = {
          // 与 Pack 写 marker 使用同一生产 identity contract；Host 只转交事实，
          // workflow 才解释匹配、冲突与重绑结论。
          identity: clonePortable(rawIdentity),
          marker: clonePortable(marker),
          fixture: clonePortable(fixture),
        };
        throwIfAborted(context.signal);
        return result;
      } catch (error) {
        // 只在 Pack 已启用 fixture 时记录无敏感数据的技术失败；workflow 将其归类
        // 为 invalid，避免把缺失报告误写成产品通过。
        console.warn('ERA Sidecar 测试读取失败。', error);
        return { fixture: clonePortable(fixture), technicalError: true };
      }
    },
    /**
     * 仅把 workflow 已得出的测试报告放到受控全局槽，保留有限 history 供 Artifact
     * 采集；它从不解释报告内容或触发同步、CRUD、变量写入。
     */
    publish_report: (input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      if (!isRecord(input.report)) throw new TypeError('Sidecar 测试报告必须是对象。');
      const root = testGlobalRoot();
      const previous = root[SIDECAR_TEST_REPORT_GLOBAL_KEY];
      const history = isRecord(previous) && Array.isArray(previous.history) ? previous.history.slice(-63) : [];
      const report = clonePortable(input.report);
      root[SIDECAR_TEST_REPORT_GLOBAL_KEY] = {
        latest: report,
        history: [...history, report],
      };
      return { status: 'published' };
    },
    /** 停止与测试 teardown 都只清除 adapter 所有的临时报告槽。 */
    clear_report: (_input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown => {
      throwIfAborted(context.signal);
      delete testGlobalRoot()[SIDECAR_TEST_REPORT_GLOBAL_KEY];
      return { status: 'cleared' };
    },
  };
}
