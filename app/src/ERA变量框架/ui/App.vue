<template>
  <div class="era-app-container" :class="{ 'dark-theme': isDarkMode }">
    <ThemeManager ref="themeManager" />
    <FloatingBall v-show="currentComponent === 'FloatingBall'" @click="requestSwitchView('ExpandedView')" />
    <div
      v-show="currentComponent === 'ExpandedView'"
      ref="expandedLayer"
      class="era-expanded-layer"
      role="dialog"
      aria-modal="true"
      aria-label="ERA 面板"
      tabindex="-1"
    >
      <!-- 视口级展开层：悬浮模态容器 -->
      <div class="era-shell">
        <!-- 新增横向壳容器：左面板 + 右侧栏 -->
        <EraPanel :data="dataRef" />
        <RightRail />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { settings } from '../utils/era_data';
import { Logger } from '../utils/log';
import EraPanel from './components/EraPanel.vue';
import FloatingBall from './components/FloatingBall.vue';
import RightRail from './components/RightRail.vue';
import ThemeManager from './components/ThemeManager.vue';
import { useUiStore } from './store';

const logger = new Logger();

// 从 Pinia store 获取状态和 action
const uiStore = useUiStore();
const { currentView: currentComponent, eventData: dataRef } = storeToRefs(uiStore);

// 主题状态管理
const themeManager = ref<InstanceType<typeof ThemeManager> | null>(null);
const isDarkMode = ref(false);
const expandedLayer = ref<HTMLElement | null>(null);
let floatingBallFocusTimer: number | null = null;

const restoreFloatingBallFocus = () => {
  if (floatingBallFocusTimer !== null) {
    window.clearTimeout(floatingBallFocusTimer);
  }
  // 先让浏览器完成对已隐藏 dialog 的焦点清理，再恢复到重新显示的按钮。
  // 若在同一渲染轮直接 focus，浏览器可能随后把焦点退回 body。
  floatingBallFocusTimer = window.setTimeout(() => {
    floatingBallFocusTimer = null;
    document.getElementById('era-floating-ball')?.focus();
  }, 0);
};

const loadThemeSetting = () => {
  try {
    const darkModeValue = settings.value?.['开启黑夜模式'] ?? false;
    isDarkMode.value = darkModeValue;
    if (themeManager.value) {
      themeManager.value.isDarkMode = darkModeValue;
    }
    logger.debug('loadThemeSetting', `主题已更新为: ${darkModeValue ? 'Dark' : 'Light'}`);
  } catch (e) {
    logger.error('loadThemeSetting', '加载主题设置失败', e);
    isDarkMode.value = false; // Fallback to light mode
  }
};

onMounted(() => {
  loadThemeSetting();
  window.addEventListener('era-settings-updated', loadThemeSetting);
  window.addEventListener('keydown', handleWindowKeydown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('era-settings-updated', loadThemeSetting);
  window.removeEventListener('keydown', handleWindowKeydown, true);
  if (floatingBallFocusTimer !== null) {
    window.clearTimeout(floatingBallFocusTimer);
  }
});

const requestSwitchView = (viewName: 'FloatingBall' | 'ExpandedView') => {
  logger.debug('requestSwitchView', `请求切换视图到: ${viewName}`);
  uiStore.switchView(viewName);
  if (viewName === 'FloatingBall') {
    void nextTick().then(restoreFloatingBallFocus);
  }
};

const closeExpandedView = async () => {
  logger.debug('closeExpandedView', '收到 Escape，关闭面板并恢复悬浮球焦点。');
  uiStore.switchView('FloatingBall');
  await nextTick();
  restoreFloatingBallFocus();
};

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || currentComponent.value !== 'ExpandedView') {
    return;
  }
  // 在捕获阶段截获 Escape，避免依赖 dialog 初始聚焦时序，也不让宿主接管本次关闭。
  event.preventDefault();
  event.stopPropagation();
  void closeExpandedView();
};

watch(currentComponent, async viewName => {
  await nextTick();
  if (viewName === 'ExpandedView') {
    expandedLayer.value?.focus();
    return;
  }
  restoreFloatingBallFocus();
});
</script>

<style>
.era-app-container {
  --era-viewport-padding: clamp(12px, 2.5vw, 24px);
  --era-viewport-block-space: clamp(24px, 5vw, 48px);
  --era-region-height: min(680px, calc(100svh - var(--era-viewport-block-space)));
  position: absolute;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  isolation: isolate;
}

.era-app-container,
.era-app-container *,
.era-app-container *::before,
.era-app-container *::after {
  box-sizing: border-box;
}
</style>

<style scoped>
.era-shell {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: min(100%, 1032px);
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 992px) {
  .era-shell {
    flex-direction: column;
  }

  :deep(.era-panel),
  :deep(.right-rail) {
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }
}

/* ===[新增] 悬浮球：固定在右下角 + 开启点击 === */
:deep(.floating-ball) {
  /* 选中子组件根元素（scoped 下用 deep） */
  position: absolute; /* 相对唯一的 viewport mount 定位，避免宿主嵌套 fixed 偏移 */
  right: max(16px, env(safe-area-inset-right)); /* 右侧安全区 + 基础边距 */
  bottom: max(90px, env(safe-area-inset-bottom)); /* 底部安全区 + 基础边距 */
  z-index: 2147483647; /* 高于容器根，确保始终可点 */
  pointer-events: auto; /* 启用点击（父容器是 none） */
  touch-action: manipulation; /* 移动端减少点击延迟 */
  will-change: transform; /* 提前分层，避免站点 3D/滤镜影响 */
}

.era-expanded-layer {
  position: absolute;
  inset: 0;
  display: grid;
  align-items: safe center;
  justify-items: center;
  padding: var(--era-viewport-padding);
  pointer-events: auto;
  z-index: 2147483646;
  background: transparent;
  overflow-x: clip;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
