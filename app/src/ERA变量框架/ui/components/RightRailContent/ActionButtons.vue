<template>
  <!-- 右侧操作卡：外层自包含，不依赖父组件样式 -->
  <section class="action-buttons-card" role="complementary" aria-label="ERA 快捷操作">
    <!-- 中文注释：操作卡容器 -->
    <h4 class="card-title">快捷操作</h4>
    <!-- 中文注释：卡片标题 -->
    <div class="btns">
      <!-- 中文注释：按钮垂直栈 -->
      <div class="btn-group">
        <button
          class="btn primary"
          title="重新计算所有变量"
          :disabled="pendingAction !== null"
          :aria-busy="pendingAction === 'full'"
          @click.stop="onFullSync"
        >
          <!-- 发起全量变量重算。 -->
          <span class="ico" aria-hidden="true">🔄</span>
          <!-- 中文注释：图标 -->
          <span class="label">完全重算变量</span>
          <!-- 中文注释：文字 -->
        </button>
        <p class="btn-desc">
          当变量与预期不符时，点击此按钮可从**第一条消息**开始重新计算所有消息，以确保数据完全同步。这是一个非常耗时的操作。
        </p>
      </div>

      <div class="btn-group">
        <button
          class="btn subtle"
          title="只重算最新一楼的变量"
          :disabled="pendingAction !== null"
          :aria-busy="pendingAction === 'latest'"
          @click.stop="onLastSync"
        >
          <!-- 发起最近一楼的变量重算。 -->
          <span class="ico" aria-hidden="true">♻️</span>
          <!-- 中文注释：图标 -->
          <span class="label">重算最后一楼变量</span>
          <!-- 中文注释：文字 -->
        </button>
        <p class="btn-desc">
          仅根据最新一条消息重新计算变量，速度较快。适用于修复最近一次操作导致的小问题或在手动编辑了最后一条消息后重新写入变量（注意，era会无视所有**用户发送的消息**中的变量更新语句）。
        </p>
      </div>

      <!-- 新增：时间旅行/回滚功能 -->
      <div class="btn-group">
        <div class="input-btn-combo">
          <input
            v-model.number="rollbackId"
            type="number"
            min="0"
            step="1"
            class="input-field"
            placeholder="消息 ID"
            aria-label="要回滚到的消息 ID"
          />
          <button
            class="btn subtle combo-btn"
            title="将变量状态回滚到指定消息"
            :disabled="pendingAction !== null"
            :aria-busy="pendingAction === 'rollback'"
            @click.stop="onRollbackTo"
          >
            <span class="ico" aria-hidden="true">⏳</span>
            <span class="label">回滚到</span>
          </button>
        </div>
        <p class="btn-desc">输入一个消息 ID，点击按钮可将变量状态“时间旅行”回该消息处理完毕后的那一刻。</p>
      </div>

      <div class="btn-group">
        <button
          class="btn danger"
          title="为角色卡注入 ERA 规则"
          :disabled="pendingAction !== null"
          :aria-busy="pendingAction === 'initialize'"
          @click.stop="onInjectRegex"
        >
          <span class="ico" aria-hidden="true">🥽</span>
          <span class="label">ERA 快速初始化</span>
        </button>
        <p class="btn-desc">
          【角色卡作者专用】点击后，会向当前角卡幂等添加三项基础资源：<br />
          1. 添加“ERA 状态栏模板”正则，将占位符替换为状态栏。<br />
          2. 向角色主世界书中添加“ERA变量操作规则”条目。<br />
          3. 向角色主世界书中添加“ERA变量意图说明”条目。<br />
          ERA 技术块的折叠、隐藏和提示清理由内建投影完成，不再注入隐藏正则。<br />
          注意：作者可以用该功能快速注入使用era的几个基础配置。但你仍旧需要：<br />
          1. 自己设计角色卡用到的变量结构并写入角色的开场白。<br />
          2. 在角色主世界书中‘ERA变量意图说明’条目中添加向ai说明各个变量的意图的提示词。<br />
          3. 修改‘ERA状态栏模板’正则中的状态栏代码，令其与**你设计的变量系统匹配**。
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import toastr from 'toastr';
import { requestEraService } from '../../../service/client';
import { ERA_UI_EVENT } from '../../../service/types';
import { Logger } from '../../../utils/log';
import { isNonNegativeSafeMessageId } from '../../utils/message-id';
import { awaitUiSettlement } from '../../utils/service-settlement';
import { waitForEraFacade } from '../../utils/facade';

const logger = new Logger();
const rollbackId = ref<number | string | null>(null);
const pendingAction = ref<'full' | 'latest' | 'rollback' | 'initialize' | null>(null);

async function submitUiCommand(type: string, args: readonly unknown[], label: string): Promise<void> {
  await awaitUiSettlement(requestEraService(type, args, 'ui'), label);
}

async function runUiCommand(
  action: Exclude<typeof pendingAction.value, null>,
  type: string,
  args: readonly unknown[],
  label: string,
): Promise<void> {
  if (pendingAction.value !== null) return;
  pendingAction.value = action;
  try {
    await submitUiCommand(type, args, label);
  } finally {
    pendingAction.value = null;
  }
}

async function onInjectRegex() {
  logger.log('onInjectRegex', '点击“ERA 快速初始化”，提交资源初始化工作流。');
  try {
    await runUiCommand('initialize', ERA_UI_EVENT.INITIALIZE_RESOURCES, [], '资源初始化');
    toastr.success('世界书与正则资源已由 ERA Service 完成校验与写入。', '初始化完成');
  } catch (error) {
    logger.error('onInjectRegex', '资源初始化失败。', error);
    toastr.error('初始化未完成，请检查 ERA 服务状态与 Console。', '初始化失败');
  }
}

/** 完全重算通过公共 Facade 进入同一同步事务，避免 UI 自行重放消息。 */
async function onFullSync() {
  logger.log('onFullSync', '点击“完全重算变量”，直达 ERA Service。');
  try {
    if (pendingAction.value !== null) return;
    pendingAction.value = 'full';
    try {
      const api = await waitForEraFacade();
      await api.sync({ mode: 'full' });
    } finally {
      pendingAction.value = null;
    }
    toastr.success('“完全重算变量”已完成。', '操作成功');
  } catch (error) {
    logger.error('onFullSync', '完全重算失败。', error);
    toastr.error('完全重算未完成，请检查控制台。', '操作失败');
  }
}

/** 只重算最新楼层，并等待 Sidecar 提交完成，避免 UI 把入队成功误报为业务成功。 */
async function onLastSync() {
  logger.log('onLastSync', '点击“重算最后一楼变量”，直达 ERA Service。');
  try {
    if (pendingAction.value !== null) return;
    pendingAction.value = 'latest';
    try {
      const api = await waitForEraFacade();
      await api.sync({ mode: 'latest' });
    } finally {
      pendingAction.value = null;
    }
    toastr.success('“重算最后一楼变量”已完成。', '操作成功');
  } catch (error) {
    logger.error('onLastSync', '最后一楼重算失败。', error);
    toastr.error('最后一楼重算未完成，请检查控制台。', '操作失败');
  }
}

/** 定向回滚先校验消息 ID，防止无效输入进入 Service FIFO。 */
async function onRollbackTo() {
  const messageId = rollbackId.value;
  if (!isNonNegativeSafeMessageId(messageId)) {
    toastr.warning('请输入有效的非负安全整数消息 ID。', '输入无效');
    return;
  }
  logger.log('onRollbackTo', `点击“回滚到”，直达 ERA Service (message_id: ${messageId})。`);
  try {
    if (pendingAction.value !== null) return;
    pendingAction.value = 'rollback';
    try {
      const api = await waitForEraFacade();
      await api.sync({ rollbackTo: messageId });
    } finally {
      pendingAction.value = null;
    }
    toastr.success(`已回滚到消息 #${messageId}。`, '操作成功');
  } catch (error) {
    logger.error('onRollbackTo', '定向回滚失败。', error);
    toastr.error('定向回滚未完成，请检查控制台。', '操作失败');
  }
}
</script>

<style scoped>
/* === 新增：输入框与按钮组合 === */
.input-btn-combo {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.input-field {
  flex-grow: 1;
  width: 0; /* 让 flex-grow 生效 */
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--settings-border-input, var(--border-soft));
  background: var(--settings-bg-btn-subtle, var(--actions-btn-bg));
  color: var(--settings-text-input, var(--text-normal));
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  transition: all 0.3s ease;
  box-shadow: var(--settings-shadow-inset);
}
.input-field::placeholder {
  color: var(--text-soft);
  font-weight: 500;
}
.input-field:focus {
  outline: none;
  border-color: var(--actions-outline-focus);
  box-shadow:
    var(--settings-shadow-inset),
    0 0 0 3px var(--snapshot-accent-soft);
}
/* 隐藏 number input 的原生箭头 */
.input-field::-webkit-outer-spin-button,
.input-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.input-field[type='number'] {
  -moz-appearance: textfield;
}

.combo-btn {
  flex-shrink: 0; /* 防止按钮被压缩 */
  padding-left: 12px;
  padding-right: 12px;
}

/* === 外层卡片：与左侧 ERA 面板同风格（玻璃卡 + 轻浮雕） === */
.action-buttons-card {
  width: 100%;
  min-width: 0;
  padding: 12px; /* 内边距 */ /* 中文注释：留白 */
  background: var(--actions-bg-glass);
  border: 1px solid var(--border-strong);
  border-radius: 16px; /* 中文注释：圆角 */
  backdrop-filter: blur(10px); /* 中文注释：毛玻璃效果 */
  box-shadow: var(--actions-shadow-card), var(--shadow-inset);
  display: flex; /* 中文注释：纵向布局 */
  flex-direction: column; /* 中文注释：垂直排列 */
  gap: 10px; /* 中文注释：元素间距 */
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}

/* 标题：与面板标题权重接近但略轻 */
.card-title {
  /* 中文注释：卡片标题 */
  margin: 0 0 4px; /* 中文注释：底部留白 */
  font-size: 14px; /* 中文注释：字号 */
  font-weight: 800; /* 中文注释：加粗 */
  letter-spacing: 0.3px; /* 中文注释：字距 */
  color: var(--text-title);
  transition: color 0.3s ease;
}

/* 按钮栈：竖直排列 */
.btns {
  /* 中文注释：按钮容器 */
  display: flex; /* 中文注释：flex 布局 */
  flex-direction: column; /* 中文注释：垂直排列 */
  gap: 16px; /* 中文注释：上下间距 */
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-desc {
  font-size: 11px;
  color: var(--text-soft);
  padding: 0 4px;
  line-height: 1.5;
  margin: 0;
  transition: color 0.3s ease;
}

/* 通用按钮造型：大号、易点、可聚焦 */
.btn {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center; /* 中文注释：垂直居中 */
  column-gap: 8px; /* 中文注释：图标与文字间距 */
  padding: 10px 12px; /* 中文注释：触控友好尺寸 */
  border-radius: 12px; /* 中文注释：圆角 */
  border: 1px solid var(--border-soft);
  background: var(--actions-btn-bg);
  color: var(--actions-btn-text);
  font-weight: 700; /* 中文注释：字重 */
  font-size: 13px; /* 中文注释：字号 */
  cursor: pointer; /* 中文注释：可点击 */
  box-shadow: var(--settings-shadow-inset), var(--shadow-button);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    background 0.2s ease,
    color 0.3s ease,
    border-color 0.3s ease;
  text-align: left; /* 中文注释：靠左 */
}

/* 主按钮：略带品牌色调（蓝青） */
.btn.primary {
  /* 中文注释：主按钮 */
  background: var(--actions-btn-primary-bg);
  border-color: var(--actions-btn-primary-border);
  color: var(--actions-btn-primary-text);
}

/* 次按钮：更素雅 */
.btn.subtle {
  /* 中文注释：次按钮 */
  background: var(--actions-btn-subtle-bg);
  border-color: var(--actions-btn-subtle-border);
}

/* 危险按钮：用于特殊或破坏性操作 */
.btn.danger {
  background: var(--actions-btn-danger-bg);
  border-color: var(--actions-btn-danger-border);
  color: var(--actions-btn-danger-text);
}

/* 悬停与按压反馈 */
.btn:hover {
  /* 中文注释：悬停态 */
  transform: translateY(-1px); /* 中文注释：轻浮起 */
  box-shadow: var(--settings-shadow-inset), var(--shadow-button-hover);
}
.btn:active {
  /* 中文注释：按下态 */
  transform: translateY(0); /* 中文注释：回落 */
  box-shadow: var(--settings-shadow-inset), var(--actions-shadow-btn-active);
}
.btn:disabled {
  cursor: wait;
  opacity: 0.62;
  transform: none;
}

/* 焦点可见性（无障碍） */
.btn:focus-visible {
  /* 中文注释：键盘聚焦态 */
  outline: 2px solid var(--actions-outline-focus);
  outline-offset: 2px; /* 中文注释：描边偏移 */
}

/* 图标与文字 */
.ico {
  /* 中文注释：图标框 */
  display: inline-grid; /* 中文注释：网格放置 */
  place-items: center; /* 中文注释：居中 */
  width: 22px; /* 中文注释：宽度 */
  height: 22px; /* 中文注释：高度 */
  filter: saturate(0.95); /* 中文注释：轻饱和 */
}
.label {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
