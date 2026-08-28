<template>
  <section class="agent-card" role="region" aria-label="故事编排设置">
    <button id="era-agent-toggle" class="card-header" :aria-expanded="open" @click="toggle">
      <span>故事编排</span><span aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>
    <div v-show="open" class="content">
      <p class="intro">规划和变量解析使用独立预设；正式故事仍使用你当前的酒馆预设。</p>
      <div v-if="!regexEnabled" id="era-agent-regex-warning" class="warning">
        角色卡局部正则已禁用。即使开启下方功能，ERA 也会回退默认生成，避免报告污染上下文。
      </div>
      <div v-if="groupChat" id="era-agent-group-warning" class="warning">
        群聊暂不支持故事编排。本聊天会保持 ERA 默认生成与历史同步行为。
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
            <div class="model-row">
              <select :id="`era-agent-planning-model-list-${index}`" v-model="profile.modelSource.model">
                <option value="">手动填写或选择模型</option>
                <option v-for="model in modelsFor(profile)" :key="model" :value="model">{{ model }}</option>
              </select>
              <button :id="`era-agent-planning-load-models-${index}`" class="mini" @click.prevent="loadModels(profile)">
                加载模型
              </button>
            </div>
            <input
              :id="`era-agent-planning-model-${index}`"
              v-model="profile.modelSource.model"
              type="text"
              placeholder="模型名"
            />
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
            <div class="model-row">
              <select :id="`era-agent-settlement-model-list-${index}`" v-model="profile.modelSource.model">
                <option value="">手动填写或选择模型</option>
                <option v-for="model in modelsFor(profile)" :key="model" :value="model">{{ model }}</option>
              </select>
              <button
                :id="`era-agent-settlement-load-models-${index}`"
                class="mini"
                @click.prevent="loadModels(profile)"
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
          class="mini"
          :disabled="configuration.settlement.attempts.length >= 17"
          @click.prevent="addAttempt('settlement')"
        >
          添加下一次尝试配置
        </button>
      </fieldset>

      <fieldset class="stage connection-manager" :disabled="busy">
        <legend>本机自定义 API 方案</legend>
        <p class="intro">密钥仅保存在本机酒馆扩展设置中，不随角色卡、聊天或 ERA 报告导出。</p>
        <label class="field"
          >已有方案
          <select id="era-agent-profile-editor-select" :value="profileDraft.id" @change="editConnectionProfile($event)">
            <option value="">新建方案</option>
            <option v-for="item in connectionProfiles" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label class="field">名称 <input id="era-agent-profile-name" v-model="profileDraft.name" type="text" /></label>
        <label class="field"
          >API 地址 <input id="era-agent-profile-url" v-model="profileDraft.apiUrl" type="url"
        /></label>
        <label class="field"
          >API 密钥
          <input
            id="era-agent-profile-key"
            v-model="profileDraft.key"
            type="password"
            autocomplete="new-password"
            placeholder="留空则保留已有密钥"
          />
        </label>
        <div class="actions">
          <button id="era-agent-profile-save" class="mini primary" @click.prevent="saveConnectionProfile">
            保存方案
          </button>
          <button id="era-agent-profile-new" class="mini subtle" @click.prevent="resetProfileDraft">新建</button>
          <button
            v-if="profileDraft.id"
            id="era-agent-profile-clear-key"
            class="mini"
            @click.prevent="clearConnectionKey"
          >
            清除密钥
          </button>
          <button
            v-if="profileDraft.id"
            id="era-agent-profile-delete"
            class="mini danger"
            @click.prevent="deleteConnectionProfile"
          >
            删除方案
          </button>
        </div>
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
          保存到角色卡
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * 模块职责：呈现故事编排设置并把交互委托给页面实例级组合函数。
 * 模块边界：模板不直接调用 Service，也不拥有角色卡或连接密钥持久化。
 */
import { useAgentOrchestrationPanel } from './use-agent-orchestration-panel';

const {
  addAttempt,
  busy,
  clearConnectionKey,
  configuration,
  connectionMissing,
  connectionProfiles,
  currentPresetName,
  deleteConnectionProfile,
  editConnectionProfile,
  groupChat,
  legacyModel,
  load,
  loadModels,
  modelsFor,
  open,
  presetLabel,
  presetNames,
  presetSelection,
  profileDraft,
  refreshSources,
  regexEnabled,
  removeAttempt,
  resetProfileDraft,
  retry,
  retryPlanningEnabled,
  retrySettlementEnabled,
  save,
  saveConnectionProfile,
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
