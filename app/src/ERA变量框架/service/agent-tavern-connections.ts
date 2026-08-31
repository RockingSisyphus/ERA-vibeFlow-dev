/*
 * 模块职责：实现多阶段生成的本机连接方案与模型枚举宿主能力。
 * 模块边界：只持有 extension settings 中的本机秘密，返回值必须是脱敏摘要。
 */

import {
  connectionProfiles,
  MAX_CONNECTION_PROFILES,
  newProfileId,
  profileId,
  profileRecord,
  profileSummary,
  requireApiUrl,
  requireProfile,
  type LocalConnectionProfile,
} from './agent-tavern-configuration';
import { currentTavernContext } from './tavern-browser-host';
import type { EraTavernAdapter } from './types';

type AgentOperations = EraTavernAdapter['agent'];
type ConnectionOperations = Pick<
  AgentOperations,
  | 'upsert_connection_profile'
  | 'delete_connection_profile'
  | 'clear_connection_profile_key'
  | 'list_connection_models'
  | 'list_connection_models_draft'
>;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('ERA 宿主操作已取消。', 'AbortError');
}

/** 只在 Host 内解析密码提供器，否则密钥会越过能力边界进入 Service 记录。 */
function submittedKey(input: Readonly<Record<string, unknown>>): string | null {
  return typeof input.keyProvider === 'function' ? String(input.keyProvider()) : null;
}

/** 统一构造受限方案，保证新建、更新、保留和显式清密钥使用同一优先级。 */
function buildProfile(input: Readonly<Record<string, unknown>>): {
  readonly existing: LocalConnectionProfile | null;
  readonly profile: LocalConnectionProfile;
} {
  const profiles = connectionProfiles();
  const requestedId = profileId(input.id);
  const existing = requestedId === null ? null : profileRecord(profiles[requestedId]);
  if (existing === null && Object.keys(profiles).length >= MAX_CONNECTION_PROFILES) {
    throw new RangeError(`本机连接方案不得超过 ${MAX_CONNECTION_PROFILES} 个。`);
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 128) : '';
  if (name.length === 0) throw new TypeError('连接方案名称不能为空。');
  const secret = submittedKey(input);
  return {
    existing,
    profile: {
      id: existing?.id ?? requestedId ?? newProfileId(),
      name,
      apiUrl: requireApiUrl(input.apiUrl),
      key: input.clearKey === true ? '' : secret && secret.length > 0 ? secret : (existing?.key ?? ''),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Tavern Helper 的 getModelList 会把非成功响应和错误 JSON 都折叠为空数组，无法与提供器
 * 合法返回零个模型区分。ERA 在同一个酒馆本地状态端点读取明确终态，避免建立第二套外网客户端。
 */
async function modelsFor(apiUrl: string, key: string, signal: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/backends/chat-completions/status', {
    method: 'POST',
    headers: currentTavernContext().getRequestHeaders(),
    body: JSON.stringify({
      reverse_proxy: apiUrl,
      proxy_password: key,
      chat_completion_source: 'openai',
    }),
    cache: 'no-cache',
    signal,
  });
  if (!response.ok) throw new TypeError(`酒馆模型状态请求失败（HTTP ${response.status}）。`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || Object.prototype.hasOwnProperty.call(payload, 'error') || !Array.isArray(payload.data)) {
    throw new TypeError('酒馆模型状态响应缺少有效 data 数组。');
  }
  return [
    ...new Set(
      payload.data
        .map(item => {
          if (!isRecord(item)) return '';
          const value = item.id ?? item.name;
          return typeof value === 'string' ? value.trim() : '';
        })
        .filter(Boolean),
    ),
  ]
    .sort()
    .slice(0, 2048);
}

/**
 * 本机方案操作必须整体保持脱敏；异常也只公开稳定 ERA 诊断，避免供应商响应泄漏秘密。
 */
export function createAgentConnectionOperations(): ConnectionOperations {
  return {
    upsert_connection_profile: async (input, context) => {
      // 保存设置终态后才返回摘要，避免 UI 把尚未持久化的方案当成成功。
      throwIfAborted(context.signal);
      const { existing, profile } = buildProfile(input);
      connectionProfiles()[profile.id] = profile;
      await currentTavernContext().saveSettingsDebounced();
      throwIfAborted(context.signal);
      return { status: existing === null ? 'created' : 'updated', profile: profileSummary(profile) };
    },
    delete_connection_profile: async (input, context) => {
      // 方案删除不触碰角色卡引用；缺失引用由下一次执行给出可重绑诊断。
      throwIfAborted(context.signal);
      const id = profileId(input.id);
      if (id === null || !Object.prototype.hasOwnProperty.call(connectionProfiles(), id)) {
        throw new TypeError('ERA_AGENT_PROFILE_MISSING：本机连接方案不存在。');
      }
      delete connectionProfiles()[id];
      await currentTavernContext().saveSettingsDebounced();
      throwIfAborted(context.signal);
      return { status: 'deleted', id };
    },
    clear_connection_profile_key: async (input, context) => {
      // 清密钥是独立显式动作，空密码提交不能走到这里。
      throwIfAborted(context.signal);
      const profile = requireProfile(input.id);
      const cleared = { ...profile, key: '' };
      connectionProfiles()[profile.id] = cleared;
      await currentTavernContext().saveSettingsDebounced();
      throwIfAborted(context.signal);
      return { status: 'cleared', profile: profileSummary(cleared) };
    },
    list_connection_models: async (input, context) => {
      // 已保存方案在 Host 内解析真实密钥，Service 只看到模型列表和脱敏摘要。
      throwIfAborted(context.signal);
      const profile = requireProfile(input.id);
      try {
        const models = await modelsFor(profile.apiUrl, profile.key, context.signal);
        throwIfAborted(context.signal);
        return { profile: profileSummary(profile), models };
      } catch (error) {
        if (context.signal.aborted) throw error;
        throw new TypeError(`ERA_AGENT_MODEL_LIST_FAILED：无法从“${profile.name}”加载模型列表。`, {
          cause: error,
        });
      }
    },
    list_connection_models_draft: async (input, context) => {
      // 草稿枚举允许先验证端点；提供器只在此同步读取一次，不进入异常文本。
      throwIfAborted(context.signal);
      try {
        const models = await modelsFor(requireApiUrl(input.apiUrl), submittedKey(input) ?? '', context.signal);
        throwIfAborted(context.signal);
        return { models };
      } catch (error) {
        if (context.signal.aborted) throw error;
        throw new TypeError('ERA_AGENT_MODEL_LIST_FAILED：无法从尚未保存的连接草稿加载模型列表。', {
          cause: error,
        });
      }
    },
  };
}
