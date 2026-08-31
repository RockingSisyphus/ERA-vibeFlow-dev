<template>
  <section class="agent-card" role="region" aria-label="多阶段生成设置">
    <button id="era-agent-toggle" class="card-header" :aria-expanded="open" @click="toggle">
      <span>多阶段生成</span><span aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>
    <div v-show="open" class="content">
      <p class="intro">规划和变量解析使用独立预设；正式故事仍使用你当前的酒馆预设。</p>
      <div v-if="groupChat" id="era-agent-group-warning" class="warning">
        群聊暂不支持多阶段生成。本聊天会保持 ERA 默认生成与历史同步行为。
      </div>

      <fieldset class="stage" :disabled="busy || groupChat">
        <label class="stage-title"
          ><input id="era-agent-planning-enabled" v-model="configuration.planning.enabled" type="checkbox" />
          正文前规划与函数调用</label
        >
        <label class="field"
          >失败后重试
          <input
            id="era-agent-planning-retries"
            v-model.number="configuration.planning.retryCount"
            aria-label="规划失败后重试次数"
            type="number"
            min="0"
            max="16"
        /></label>
        <div v-for="(profile, index) in configuration.planning.attempts" :key="`planning-${index}`" class="attempt">
          <strong>尝试 {{ index + 1 }}</strong>
          <label class="field"
            >辅助阶段预设
            <select
              :id="`era-agent-planning-preset-${index}`"
              :value="presetSelection(profile)"
              @change="selectPreset('planning', index, $event)"
            >
              <option value="builtin">ERA 内建预设</option>
              <option value="in_use">
                当前正在使用{{ currentPresetName ? `（${currentPresetName}，含未保存修改）` : '（含未保存修改）' }}
              </option>
              <option v-for="name in presetNames" :key="name" :value="`preset:${name}`">{{ name }}</option>
              <option v-if="presetSelection(profile) === 'embedded'" value="embedded" disabled>已嵌入快照</option>
            </select>
          </label>
          <label class="field"
            >模型来源
            <select
              :id="`era-agent-planning-model-source-${index}`"
              :value="profile.modelSource.kind"
              @change="selectModelSource('planning', index, $event)"
            >
              <option value="tavern-current">酒馆当前连接与模型</option>
              <option value="custom-profile">ERA 本机自定义 API</option>
            </select>
          </label>
          <p v-if="legacyModel(profile)" class="migration-note">
            已保留 V1 模型覆盖：{{ legacyModel(profile) }}。主动切换来源后将清除此兼容值。
          </p>
          <div v-if="profile.modelSource.kind === 'custom-profile'" class="custom-route">
            <label class="field"
              >连接方案
              <select
                :id="`era-agent-planning-profile-${index}`"
                :value="profile.modelSource.profileId"
                @change="selectConnectionProfile('planning', index, $event)"
              >
                <option value="">请选择本机方案</option>
                <option v-for="item in connectionProfiles" :key="item.id" :value="item.id">{{ item.name }}</option>
                <option v-if="connectionMissing(profile)" :value="profile.modelSource.profileId" disabled>
                  需要重新绑定：{{ profile.modelSource.profileNameHint || profile.modelSource.profileId }}
                </option>
              </select>
            </label>
            <button
              :id="`era-agent-planning-profile-new-${index}`"
              class="mini subtle"
              @click.prevent="newConnection('planning', index)"
            >
              新建方案草稿
            </button>
            <label class="field"
              >方案名称
              <input
                :id="`era-agent-planning-profile-name-${index}`"
                v-model="connectionDraft('planning', index).name"
                type="text"
                placeholder="例如：本地 OpenAI"
              />
            </label>
            <label class="field"
              >API 地址
              <input
                :id="`era-agent-planning-profile-url-${index}`"
                v-model="connectionDraft('planning', index).apiUrl"
                type="url"
                placeholder="https://example.test/v1"
              />
            </label>
            <label class="field"
              >API 密钥
              <input
                :id="`era-agent-planning-profile-key-${index}`"
                v-model="connectionDraft('planning', index).key"
                type="password"
                autocomplete="new-password"
                placeholder="留空则保留已保存密钥"
              />
            </label>
            <label v-if="connectionDraft('planning', index).boundProfileId" class="inline-choice"
              ><input
                :id="`era-agent-planning-profile-save-as-${index}`"
                v-model="connectionDraft('planning', index).saveAs"
                type="checkbox"
              />
              另存为新方案</label
            >
            <label v-if="connectionDraft('planning', index).boundProfileId" class="inline-choice"
              ><input
                :id="`era-agent-planning-profile-clear-key-${index}`"
                v-model="connectionDraft('planning', index).clearKey"
                type="checkbox"
              />
              保存时清除密钥</label
            >
            <div class="model-row">
              <select :id="`era-agent-planning-model-list-${index}`" v-model="profile.modelSource.model">
                <option value="">手动填写或选择模型</option>
                <option v-for="model in connectionDraft('planning', index).models" :key="model" :value="model">
                  {{ model }}
                </option>
              </select>
              <button
                :id="`era-agent-planning-load-models-${index}`"
                class="mini"
                @click.prevent="loadModels('planning', index)"
              >
                加载模型
              </button>
            </div>
            <input
              :id="`era-agent-planning-model-${index}`"
              v-model="profile.modelSource.model"
              type="text"
              placeholder="模型名"
            />
            <button
              v-if="connectionDraft('planning', index).boundProfileId"
              :id="`era-agent-planning-profile-delete-${index}`"
              class="mini danger"
              @click.prevent="deleteConnectionProfile('planning', index)"
            >
              删除本机方案
            </button>
          </div>
          <div class="preset-row">
            <span>{{ presetLabel(profile) }}</span>
            <button
              v-if="configuration.planning.attempts.length > 1"
              class="mini danger"
              @click.prevent="removeAttempt('planning', index)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          id="era-agent-planning-add-attempt"
          class="mini"
          :disabled="configuration.planning.attempts.length >= 17"
          @click.prevent="addAttempt('planning')"
        >
          添加下一次尝试配置
        </button>
      </fieldset>

      <fieldset class="stage" :disabled="busy || groupChat">
        <label class="stage-title"
          ><input id="era-agent-settlement-enabled" v-model="configuration.settlement.enabled" type="checkbox" />
          正文后独立变量解析</label
        >
        <label class="field"
          >失败后重试
          <input
            id="era-agent-settlement-retries"
            v-model.number="configuration.settlement.retryCount"
            aria-label="变量解析失败后重试次数"
            type="number"
            min="0"
            max="16"
        /></label>
        <div v-for="(profile, index) in configuration.settlement.attempts" :key="`settlement-${index}`" class="attempt">
          <strong>尝试 {{ index + 1 }}</strong>
          <label class="field"
            >辅助阶段预设
            <select
              :id="`era-agent-settlement-preset-${index}`"
              :value="presetSelection(profile)"
              @change="selectPreset('settlement', index, $event)"
            >
              <option value="builtin">ERA 内建预设</option>
              <option value="in_use">
                当前正在使用{{ currentPresetName ? `（${currentPresetName}，含未保存修改）` : '（含未保存修改）' }}
              </option>
              <option v-for="name in presetNames" :key="name" :value="`preset:${name}`">{{ name }}</option>
              <option v-if="presetSelection(profile) === 'embedded'" value="embedded" disabled>已嵌入快照</option>
            </select>
          </label>
          <label class="field"
            >模型来源
            <select
              :id="`era-agent-settlement-model-source-${index}`"
              :value="profile.modelSource.kind"
              @change="selectModelSource('settlement', index, $event)"
            >
              <option value="tavern-current">酒馆当前连接与模型</option>
              <option value="custom-profile">ERA 本机自定义 API</option>
            </select>
          </label>
          <p v-if="legacyModel(profile)" class="migration-note">
            已保留 V1 模型覆盖：{{ legacyModel(profile) }}。主动切换来源后将清除此兼容值。
          </p>
          <div v-if="profile.modelSource.kind === 'custom-profile'" class="custom-route">
            <label class="field"
              >连接方案
              <select
                :id="`era-agent-settlement-profile-${index}`"
                :value="profile.modelSource.profileId"
                @change="selectConnectionProfile('settlement', index, $event)"
              >
                <option value="">请选择本机方案</option>
                <option v-for="item in connectionProfiles" :key="item.id" :value="item.id">{{ item.name }}</option>
                <option v-if="connectionMissing(profile)" :value="profile.modelSource.profileId" disabled>
                  需要重新绑定：{{ profile.modelSource.profileNameHint || profile.modelSource.profileId }}
                </option>
              </select>
            </label>
            <button
              :id="`era-agent-settlement-profile-new-${index}`"
              class="mini subtle"
              @click.prevent="newConnection('settlement', index)"
            >
              新建方案草稿
            </button>
            <label class="field"
              >方案名称
              <input
                :id="`era-agent-settlement-profile-name-${index}`"
                v-model="connectionDraft('settlement', index).name"
                type="text"
                placeholder="例如：变量解析 API"
              />
            </label>
            <label class="field"
              >API 地址
              <input
                :id="`era-agent-settlement-profile-url-${index}`"
                v-model="connectionDraft('settlement', index).apiUrl"
                type="url"
                placeholder="https://example.test/v1"
              />
            </label>
            <label class="field"
              >API 密钥
              <input
                :id="`era-agent-settlement-profile-key-${index}`"
                v-model="connectionDraft('settlement', index).key"
                type="password"
                autocomplete="new-password"
                placeholder="留空则保留已保存密钥"
              />
            </label>
            <label v-if="connectionDraft('settlement', index).boundProfileId" class="inline-choice"
              ><input
                :id="`era-agent-settlement-profile-save-as-${index}`"
                v-model="connectionDraft('settlement', index).saveAs"
                type="checkbox"
              />
              另存为新方案</label
            >
            <label v-if="connectionDraft('settlement', index).boundProfileId" class="inline-choice"
              ><input
                :id="`era-agent-settlement-profile-clear-key-${index}`"
                v-model="connectionDraft('settlement', index).clearKey"
                type="checkbox"
              />
              保存时清除密钥</label
            >
            <div class="model-row">
              <select :id="`era-agent-settlement-model-list-${index}`" v-model="profile.modelSource.model">
                <option value="">手动填写或选择模型</option>
                <option v-for="model in connectionDraft('settlement', index).models" :key="model" :value="model">
                  {{ model }}
                </option>
              </select>
              <button
                :id="`era-agent-settlement-load-models-${index}`"
                class="mini"
                @click.prevent="loadModels('settlement', index)"
              >
                加载模型
              </button>
            </div>
            <input
              :id="`era-agent-settlement-model-${index}`"
              v-model="profile.modelSource.model"
              type="text"
              placeholder="模型名"
            />
            <button
              v-if="connectionDraft('settlement', index).boundProfileId"
              :id="`era-agent-settlement-profile-delete-${index}`"
              class="mini danger"
              @click.prevent="deleteConnectionProfile('settlement', index)"
            >
              删除本机方案
            </button>
          </div>
          <div class="preset-row">
            <span>{{ presetLabel(profile) }}</span>
            <button
              v-if="configuration.settlement.attempts.length > 1"
              class="mini danger"
              @click.prevent="removeAttempt('settlement', index)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          id="era-agent-settlement-add-attempt"
          class="mini"
          :disabled="configuration.settlement.attempts.length >= 17"
          @click.prevent="addAttempt('settlement')"
        >
          添加下一次尝试配置
        </button>
      </fieldset>

      <div class="status">
        <span>最近会话：{{ sessionStatus }}</span>
        <div v-if="session && !groupChat" class="retry-row">
          <button
            v-if="retryPlanningEnabled"
            id="era-agent-retry-planning"
            class="mini"
            :disabled="busy"
            @click="retry('planning')"
          >
            重跑规划
          </button>
          <button
            v-if="retryPlanningEnabled"
            id="era-agent-retry-story"
            class="mini"
            :disabled="busy"
            @click="retry('story')"
          >
            重跑故事
          </button>
          <button
            v-if="retrySettlementEnabled"
            id="era-agent-retry-settlement"
            class="mini"
            :disabled="busy"
            @click="retry('settlement')"
          >
            重跑变量解析
          </button>
        </div>
      </div>
      <div class="actions">
        <button id="era-agent-refresh-sources" class="mini subtle" :disabled="busy" @click="refreshSources">
          刷新预设与连接
        </button>
        <button class="mini subtle" :disabled="busy" @click="load">重新读取</button>
        <button id="era-agent-save" class="mini primary" :disabled="busy || groupChat" @click="save">
          保存方案并写入角色卡
        </button>
      </div>
      <p class="intro">新建或修改的 API 方案会在点击上方总保存按钮后持久化；仅加载模型不会提前保存草稿。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * 模块职责：呈现多阶段生成设置并把交互委托给页面实例级组合函数。
 * 模块边界：模板不直接调用 Service，也不拥有角色卡或连接密钥持久化。
 */
import { useAgentOrchestrationPanel } from './use-agent-orchestration-panel';

const {
  addAttempt,
  busy,
  connectionDraft,
  configuration,
  connectionMissing,
  connectionProfiles,
  currentPresetName,
  deleteConnectionProfile,
  groupChat,
  legacyModel,
  load,
  loadModels,
  newConnection,
  open,
  presetLabel,
  presetNames,
  presetSelection,
  refreshSources,
  removeAttempt,
  retry,
  retryPlanningEnabled,
  retrySettlementEnabled,
  save,
  selectConnectionProfile,
  selectModelSource,
  selectPreset,
  session,
  sessionStatus,
  toggle,
} = useAgentOrchestrationPanel();
</script>

<style scoped>
@import './AgentOrchestrationPanel.css';
</style>
