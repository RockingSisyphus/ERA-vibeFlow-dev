<template>
  <!-- 外层卡片：与 ActionButtons 保持一致的玻璃卡风格，但默认收起 -->
  <section class="settings-card" role="region" aria-label="ERA 设置">
    <!-- 设置卡片容器 -->
    <!-- 标题行：可点击折叠/展开 -->
    <button class="card-header" :aria-expanded="isOpen" @click="onToggle">
      <!-- 点击切换展开状态 -->
      <span class="title">ERA 设置</span>
      <!-- 标题文字 -->
      <span class="chev" aria-hidden="true">{{ isOpen ? '▾' : '▸' }}</span>
      <!-- 展开箭头 -->
    </button>

    <!-- 内容体：默认收起；展开后显示变量列表与操作 -->
    <div v-show="isOpen" class="content">
      <!-- 展开内容容器 -->
      <!-- 顶部操作区：刷新/保存/重置编辑 -->
      <div class="toolbar">
        <!-- 工具条 -->
        <button class="mini-btn" title="重新读取脚本变量" @click.stop="loadVars">🔄 重新读取</button>
        <!-- 读取按钮 -->
        <div class="spacer"></div>
        <!-- 占位撑开 -->
        <button class="mini-btn subtle" title="丢弃未保存的修改" @click.stop="discardEdits">↩︎ 丢弃修改</button>
        <!-- 丢弃编辑 -->
        <button class="mini-btn primary" title="保存修改到脚本变量" @click.stop="saveEdits">💾 保存修改</button>
        <!-- 保存修改 -->
      </div>

      <!-- 变量列表：逐项渲染 -->
      <div class="vars">
        <template v-if="rows.length > 0">
          <!-- 有变量时渲染列表 -->
          <div v-for="row in rows" :key="row.key" class="var-row">
            <!-- 每个变量一行 -->
            <label class="var-key" :title="row.key">{{ row.key }}</label>
            <!-- 变量名 -->
            <!-- 根据变量类型选择不同的编辑控件 -->
            <div class="var-editor">
              <!-- 编辑器容器 -->
              <!-- 布尔：勾选框 -->
              <template v-if="row.type === 'boolean'">
                <label class="switch">
                  <!-- 自定义开关外观 -->
                  <input v-model="edits[row.key]" type="checkbox" />
                  <!-- 勾选值 -->
                  <span class="track"></span>
                  <!-- 轨道 -->
                </label>
              </template>

              <!-- 数字：number 输入 -->
              <template v-else-if="row.type === 'number'">
                <input v-model.number="edits[row.key]" type="number" class="ipt" :placeholder="String(row.value)" />
                <!-- 数字输入 -->
              </template>

              <!-- 字符串：text 输入 -->
              <template v-else-if="row.type === 'string'">
                <input v-model="edits[row.key]" type="text" class="ipt" :placeholder="String(row.value)" />
                <!-- 文本输入 -->
              </template>

              <!-- 其他（对象/数组/null/未知）：JSON 文本域 -->
              <template v-else>
                <textarea
                  v-model="jsonBuffers[row.key]"
                  class="ipt ta"
                  :placeholder="safeStringify(row.value)"
                  @input="markJsonTouched(row.key)"
                ></textarea>
                <!-- JSON 文本域 -->
                <span class="hint" :class="{ ok: jsonState[row.key]?.ok, bad: jsonState[row.key]?.bad }">{{
                  jsonState[row.key]?.msg ?? '以 JSON 格式编辑此值'
                }}</span>
                <!-- JSON 校验提示 -->
              </template>
            </div>
            <!-- 类型徽标 -->
            <span class="type-chip">{{ humanType(row.type) }}</span>
            <!-- 类型展示 -->
          </div>
        </template>

        <template v-else>
          <!-- 没有变量时的占位 -->
          <div class="placeholder">
            <p>未读取到任何脚本变量。</p>
            <!-- 文本提示 -->
            <p class="dim">请先确保 <code>app_ready</code> 初始化工作流已完成默认设置写入。</p>
            <!-- 辅助说明 -->
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/* 块头：逻辑说明
   - 默认收起，展开时读取脚本域变量；
   - 支持 boolean/number/string/json 四类编辑；
   - 保存时按原类型回写到脚本域。
*/
import { reactive, ref } from 'vue'; // 中文注释：Vue 响应式 API
import toastr from 'toastr';
import { requestEraService } from '../../../service/client';
import { ERA_UI_EVENT } from '../../../service/types';
import { SettingsSchema } from '../../../utils/constants';
import { settings } from '../../../utils/era_data';
import { Logger } from '../../../utils/log'; // 中文注释：项目内日志工具

const logger = new Logger(); // 中文注释：实例化日志

// === 折叠状态 ===
const isOpen = ref(false); // 中文注释：是否展开

// === 原始数据与编辑缓存 ===
type Row = { key: string; value: any; type: 'boolean' | 'number' | 'string' | 'json' }; // 中文注释：一行变量的结构
const rows = ref<Row[]>([]); // 中文注释：可渲染的变量行
const edits = reactive<Record<string, any>>({}); // 中文注释：针对简单类型的编辑缓存（布尔/数字/字符串）
const jsonBuffers = reactive<Record<string, string>>({}); // 中文注释：针对 JSON 类型的文本缓存
const jsonState = reactive<Record<string, { ok?: boolean; bad?: boolean; msg?: string }>>({}); // 中文注释：JSON 校验状态

// === 工具：类型判定与人类可读名 ===
function detectType(v: any): Row['type'] {
  // 中文注释：检测变量类型
  if (typeof v === 'boolean') return 'boolean'; // 中文注释：布尔
  if (typeof v === 'number' && Number.isFinite(v)) return 'number'; // 中文注释：有限数
  if (typeof v === 'string') return 'string'; // 中文注释：字符串
  return 'json'; // 中文注释：其他一律归为 json（对象/数组/null/特殊数等）
}
function humanType(t: Row['type']): string {
  // 中文注释：类型中文名
  return t === 'boolean' ? '布尔' : t === 'number' ? '数字' : t === 'string' ? '字符串' : 'JSON'; // 中文注释：映射
}
function safeStringify(v: any): string {
  // 中文注释：安全 JSON 序列化
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  } // 中文注释：失败则转字符串
}

// === 加载变量列表 ===
function loadVars() {
  try {
    logger.debug('loadVars', '尝试读取脚本设置...');
    const obj = settings.value;
    logger.debug('loadVars', '成功读取脚本设置:', obj);

    if (!obj || Object.keys(obj).length === 0) {
      logger.warn('loadVars', '设置对象为空，UI 将不会被填充。');
      rows.value = [];
      toastr.info('未找到任何脚本变量。');
      return;
    }

    // 清空旧缓存
    rows.value = [];
    for (const k of Object.keys(edits)) delete edits[k];
    for (const k of Object.keys(jsonBuffers)) delete jsonBuffers[k];
    for (const k of Object.keys(jsonState)) delete jsonState[k];

    // 构建可编辑行
    Object.entries(obj)
      .filter(([key]) => key !== '开启悬浮球')
      .forEach(([key, value]) => {
        const t = detectType(value);
        rows.value.push({ key, value, type: t });
        if (t === 'json') {
          jsonBuffers[key] = safeStringify(value);
        } else {
          edits[key] = value;
        }
      });
    toastr.success('已从脚本变量中加载最新设置。', '读取成功');
  } catch (e) {
    logger.error('loadVars', '读取脚本变量失败:', e);
    toastr.error('读取 ERA 设置失败，请检查浏览器控制台。', '读取失败');
  }
}

// === 展开折叠 ===
function onToggle() {
  // 中文注释：切换展开
  isOpen.value = !isOpen.value; // 中文注释：翻转状态
  if (isOpen.value && rows.value.length === 0) loadVars(); // 中文注释：首次展开时读取数据
}

// === JSON 文本域编辑标记 + 校验 ===
function markJsonTouched(key: string) {
  // 中文注释：标记 JSON 文本改动并校验
  const txt = jsonBuffers[key] ?? ''; // 中文注释：读取文本
  if (txt.trim() === '') {
    // 中文注释：空文本提示
    jsonState[key] = { bad: true, ok: false, msg: '不能为空（若要设为 null 请写 null）' }; // 中文注释：空提示
    return; // 中文注释：返回
  }
  try {
    JSON.parse(txt);
    jsonState[key] = { ok: true, bad: false, msg: 'JSON 格式有效' };
  } catch (e: any) {
    // 中文注释：校验通过
    jsonState[key] = { bad: true, ok: false, msg: `JSON 格式错误：${e?.message ?? ''}` };
  } // 中文注释：校验失败
}

// === 丢弃未保存的编辑 ===
function discardEdits() {
  logger.log('discardEdits', '点击“丢弃修改”');
  loadVars(); // 重新读取宿主快照，确保丢弃全部未提交的本地改动。
  toastr.info('所有未保存的修改已被丢弃。', '操作完成');
}

// === 保存修改 ===
async function saveEdits() {
  // 保存请求只能经过 ERA Service 的逻辑提交边界，避免 UI 直接写入脚本变量。
  const originalRows = JSON.parse(JSON.stringify(rows.value)); // 深拷贝原始数据用于回滚

  try {
    // 1. 先构造并校验完整设置，不提前修改响应式快照。
    const updatedSettings: Record<string, any> = {};
    rows.value.forEach(row => {
      if (row.type === 'json') {
        if (jsonState[row.key]?.bad) {
          throw new Error(`键 ${row.key} 的 JSON 格式不正确`);
        }
        if (jsonBuffers[row.key] != null) {
          const newValue = JSON.parse(jsonBuffers[row.key]);
          updatedSettings[row.key] = newValue;
        }
      } else if (edits[row.key] !== undefined) {
        updatedSettings[row.key] = edits[row.key];
      }
    });
    const nextSettings = SettingsSchema.parse({ ...settings.value, ...updatedSettings });
    const admission = requestEraService(ERA_UI_EVENT.UPDATE_SETTINGS, [{ settings: nextSettings }], 'ui');
    if (!admission.accepted) throw new Error(`${admission.code}: ${admission.message}`);
    const settlement = await admission.done;
    if (settlement.status !== 'completed') throw new Error(`设置提交未完成：${settlement.status}`);

    rows.value.forEach(row => {
      if (Object.prototype.hasOwnProperty.call(nextSettings, row.key)) {
        row.value = nextSettings[row.key as keyof typeof nextSettings];
      }
    });
    logger.log('saveEdits', '脚本变量已保存');
    toastr.success('设置已成功保存到脚本变量。', '保存成功');
  } catch (e) {
    logger.error('saveEdits', '保存失败：', e);
    toastr.error(`保存失败：${(e as any)?.message ?? e}。正在回滚界面。`, '保存失败');
    // 2. 错误处理：回滚 UI
    rows.value = originalRows;
    // 重新填充 edits 和 jsonBuffers 以匹配回滚后的 UI
    originalRows.forEach((row: Row) => {
      if (row.type === 'json') {
        jsonBuffers[row.key] = safeStringify(row.value);
      } else {
        edits[row.key] = row.value;
      }
    });
  }
}
</script>

<style scoped>
/* === 外层卡片容器（与 ActionButtons 保持同系外观） === */
.settings-card {
  /* 玻璃卡容器 */
  width: 100%; /* 占满侧栏宽度 */
  padding: 12px; /* 内边距 */
  background: var(--settings-bg-glass);
  border: 1px solid var(--border-strong);
  border-radius: 16px; /* 圆角 */
  backdrop-filter: blur(10px); /* 毛玻璃 */
  box-shadow: var(--settings-shadow-card), var(--settings-shadow-inset);
  display: flex; /* 纵向布局 */
  flex-direction: column; /* 垂直排布 */
  gap: 10px; /* 间距 */
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}

/* 标题按钮：收起/展开控制 */
.card-header {
  /* 标题行按钮 */
  display: flex; /* 横向布局 */
  align-items: center; /* 垂直居中 */
  justify-content: space-between; /* 两端对齐 */
  padding: 8px 10px; /* 内边距 */
  border-radius: 10px; /* 圆角 */
  border: 1px solid var(--border-soft);
  background: var(--chip-bg);
  color: var(--text-title);
  font-weight: 800; /* 加粗 */
  font-size: 13px; /* 字号 */
  cursor: pointer; /* 可点 */
  box-shadow: var(--settings-shadow-inset), var(--shadow-button);
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.card-header:hover {
  transform: translateY(-1px);
  box-shadow: var(--settings-shadow-inset), var(--shadow-button-hover);
} /* 悬停态 */
.title {
  pointer-events: none;
} /* 避免子元素截获点击 */
.chev {
  opacity: 0.7;
} /* 箭头淡化 */

/* 内容体 */
.content {
  display: flex;
  flex-direction: column;
  gap: 10px;
} /* 内容容器 */

/* 工具条 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
} /* 工具条布局 */
.spacer {
  flex: 1;
} /* 右对齐按钮用 */

.mini-btn {
  /* 通用小按钮 */
  padding: 6px 10px; /* 内边距 */
  border-radius: 8px; /* 圆角 */
  border: 1px solid var(--border-normal);
  background: var(--chip-bg);
  color: var(--text-normal);
  cursor: pointer; /* 可点击 */
  font-size: 12px; /* 字号 */
  font-weight: 700; /* 加粗 */
  box-shadow: var(--settings-shadow-inset), var(--settings-shadow-minibtn);
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.mini-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--settings-shadow-inset), var(--settings-shadow-minibtn-hover);
} /* 悬停 */
.mini-btn.primary {
  background: var(--settings-bg-btn-primary);
  border-color: var(--settings-border-btn-primary);
  color: var(--settings-text-primary-btn);
} /* 主要 */
.mini-btn.subtle {
  background: var(--settings-bg-btn-subtle);
  border-color: var(--settings-border-input);
} /* 次要 */

/* 变量列表 */
.vars {
  display: flex;
  flex-direction: column;
  gap: 8px;
} /* 列表容器 */

.var-row {
  /* 一行变量 */
  display: grid; /* 网格布局 */
  grid-template-columns: 1fr minmax(120px, 1.2fr) auto; /* 三列：键 / 编辑器 / 类型 */
  align-items: center; /* 垂直居中 */
  gap: 10px; /* 列间距 */
  padding: 8px 10px; /* 内边距 */
  border: 1px solid var(--border-soft);
  border-radius: 10px; /* 圆角 */
  background: var(--settings-bg-var-row);
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}
.var-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--text-subtitle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.3s ease;
} /* 键名样式 */
.var-editor {
  display: flex;
  align-items: center;
  gap: 8px;
} /* 编辑器容器 */

.ipt {
  /* 通用输入框 */
  width: 100%; /* 拉满可用宽度 */
  padding: 8px 10px; /* 内边距 */
  border-radius: 8px; /* 圆角 */
  border: 1px solid var(--settings-border-input);
  background: var(--bg-solid);
  font-size: 12px; /* 字号 */
  color: var(--settings-text-input);
  box-shadow: var(--settings-shadow-inset);
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease;
}
.ta {
  min-height: 64px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
} /* JSON 文本域 */

.type-chip {
  /* 类型标签 */
  font-size: 11px; /* 字号 */
  color: var(--text-subtitle);
  background: var(--settings-bg-type-chip);
  border: 1px solid var(--settings-border-type-chip);
  border-radius: 999px; /* 胶囊 */
  padding: 4px 8px; /* 内边距 */
  white-space: nowrap; /* 不换行 */
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease;
}

/* 自定义开关（布尔） */
.switch {
  position: relative;
  width: 42px;
  height: 24px;
  display: inline-block;
} /* 开关容器 */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
} /* 隐藏原生框 */
.switch .track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--settings-bg-switch-track);
  box-shadow: var(--settings-shadow-inset);
  transition: background 0.2s ease;
} /* 轨道 */
.switch .track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--settings-bg-switch-handle);
  box-shadow: var(--settings-shadow-switch-handle);
  transition:
    transform 0.2s ease,
    background 0.3s ease;
} /* 拖头 */
.switch input:checked + .track {
  background: var(--settings-bg-switch-checked);
} /* 选中轨道色 */
.switch input:checked + .track::after {
  transform: translateX(18px);
} /* 拖头右移 */

.hint {
  font-size: 11px;
  color: var(--text-normal);
  transition: color 0.3s ease;
} /* JSON 提示 */
.hint.ok {
  color: var(--settings-text-hint-ok);
} /* 通过提示色 */
.hint.bad {
  color: var(--settings-text-hint-bad);
} /* 错误提示色 */

.placeholder {
  padding: 10px;
  color: var(--text-normal);
  font-size: 12px;
  border: 1px dashed var(--border-dashed);
  border-radius: 10px;
  background: var(--bg-placeholder);
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease;
} /* 空状态 */
</style>
