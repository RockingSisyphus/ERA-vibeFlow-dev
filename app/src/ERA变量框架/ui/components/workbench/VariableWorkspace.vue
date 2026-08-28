<template>
  <section class="workspace-section" aria-label="当前变量">
    <div class="workspace-toolbar">
      <label class="search-field">
        <span>搜索变量</span>
        <input v-model="filter" type="search" placeholder="名称、路径或值" />
      </label>
      <button type="button" @click="openAdd([])">新增变量</button>
      <button type="button" @click="openBatch">批量/高级</button>
    </div>
    <p class="workspace-hint">这里显示完整 statData，包括 $meta、$template 等 ERA 控制字段。</p>
    <ul v-if="rootKeys.length" class="variable-tree" aria-label="变量树">
      <VariableTreeNode
        v-for="key in rootKeys"
        :key="key"
        :label="key"
        :value="root[key]"
        :path="[key]"
        :depth="0"
        :filter="filter"
        @edit="openEdit"
        @add="openAdd"
        @remove="openDelete"
      />
    </ul>
    <div v-else class="workspace-empty">当前没有变量。可以从“新增变量”开始。</div>

    <WorkbenchDrawer
      v-if="editor"
      :title="editorTitle"
      :subtitle="editor.mode === 'batch' ? '变量根' : pathText(editor.path)"
      @close="closeEditor"
    >
      <form class="editor-form" @submit.prevent="save">
        <label v-if="editor.mode === 'add'">
          <span>新变量名称</span>
          <input v-model="keyInput" aria-label="新变量名称" autocomplete="off" />
        </label>

        <template v-if="editor.mode !== 'delete'">
          <div
            v-if="editor.mode === 'edit' && typeof editor.initial === 'number'"
            class="mode-switch"
            role="group"
            aria-label="数值编辑方式"
          >
            <button type="button" :class="{ active: inputMode === 'value' }" @click="inputMode = 'value'">
              直接值
            </button>
            <button type="button" :class="{ active: inputMode === 'expression' }" @click="inputMode = 'expression'">
              表达式
            </button>
            <button type="button" :class="{ active: inputMode === 'json' }" @click="inputMode = 'json'">
              高级 JSON
            </button>
          </div>
          <div v-else-if="editor.mode !== 'batch'" class="mode-switch" role="group" aria-label="变量编辑方式">
            <button type="button" :class="{ active: inputMode === 'value' }" @click="inputMode = 'value'">
              类型表单
            </button>
            <button type="button" :class="{ active: inputMode === 'json' }" @click="inputMode = 'json'">
              高级 JSON
            </button>
          </div>

          <label v-if="inputMode === 'value'">
            <span>值类型</span>
            <select v-model="valueType" aria-label="变量值类型">
              <option value="string">字符串</option>
              <option value="number">数值</option>
              <option value="boolean">布尔值</option>
              <option value="null">null</option>
              <option value="array">数组</option>
              <option value="object">对象</option>
            </select>
          </label>
          <label v-if="inputMode === 'value' && valueType === 'boolean'">
            <span>布尔值</span>
            <select v-model="valueText" aria-label="布尔值">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label v-else-if="inputMode === 'value' && valueType !== 'null'">
            <span>{{ valueType === 'array' || valueType === 'object' ? 'JSON 值' : '变量值' }}</span>
            <textarea
              v-if="valueType === 'array' || valueType === 'object'"
              v-model="valueText"
              aria-label="变量值 JSON"
              rows="9"
              spellcheck="false"
            />
            <input v-else v-model="valueText" aria-label="变量值" />
          </label>
          <label v-if="inputMode === 'expression'">
            <span>$expr 表达式</span>
            <textarea v-model="expression" aria-label="变量表达式" rows="5" spellcheck="false" />
            <small>可使用当前变量、@快照变量及 statFunc 中的函数。</small>
          </label>
          <div v-if="editor.mode === 'batch'" class="mode-switch" role="group" aria-label="批量编辑方式">
            <button type="button" :class="{ active: batchMode === 'state' }" @click="batchMode = 'state'">
              完整状态差异
            </button>
            <button type="button" :class="{ active: batchMode === 'operations' }" @click="batchMode = 'operations'">
              有序 ERA 操作
            </button>
          </div>
          <label v-if="inputMode === 'json' || editor.mode === 'batch'">
            <span>{{
              editor.mode === 'batch'
                ? batchMode === 'state'
                  ? '完整变量 JSON'
                  : '有序 insert/edit/delete JSON 数组'
                : '选中子树 JSON'
            }}</span>
            <textarea
              v-model="jsonText"
              :aria-label="
                editor.mode === 'batch' && batchMode === 'operations' ? '有序变量操作 JSON' : '高级变量 JSON'
              "
              rows="14"
              spellcheck="false"
            />
          </label>
        </template>

        <div v-else class="delete-warning">
          将删除 <strong>{{ pathText(editor.path) }}</strong
          >。这个操作会写入当前最后一条 AI 消息。
        </div>

        <div v-if="protections.length" class="protection-box" role="alert">
          <strong>检测到 ERA 保护</strong>
          <ul>
            <li v-for="item in protections" :key="`${pathText(item.path)}:${item.field}`">
              {{ pathText(item.path) }} · {{ item.field }} = {{ JSON.stringify(item.value) }}
            </li>
          </ul>
          <label>
            <span>处理方式</span>
            <select v-model="protectionChoice" aria-label="保护处理方式">
              <option value="">请选择</option>
              <option
                v-if="editor.mode !== 'delete' && protections.every(item => item.field !== 'necessary')"
                value="temporary"
              >
                仅本次修改，完成后恢复保护
              </option>
              <option value="unlock">解除保护并继续</option>
            </select>
          </label>
        </div>

        <div v-if="preview.length" class="operation-preview">
          <strong>将提交 {{ preview.length }} 个有序操作</strong>
          <pre>{{ JSON.stringify(preview, null, 2) }}</pre>
        </div>
        <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
        <p v-if="success" class="editor-success" role="status">{{ success }}</p>
        <footer class="editor-actions">
          <button type="button" @click="closeEditor">取消</button>
          <button class="primary" type="submit" :disabled="busy">{{ busy ? '正在保存…' : '确认保存' }}</button>
        </footer>
      </form>
    </WorkbenchDrawer>
  </section>
</template>

<script setup lang="ts">
/*
 * 模块职责：提供变量树搜索、JSON 草稿、表达式试用和保护选择。
 * 模块边界：只产生有序操作，持久化由上层统一执行，不直接修改 Sidecar。
 * 编辑会话固定聊天身份、revision 和原子树，因此能拒绝陈旧草稿覆盖。
 */
import { computed, ref, watch } from 'vue';
import type { EraCommitOperation } from '../../../service/public-api';
import { waitForEraFacade } from '../../utils/facade';
import {
  jsonEqual,
  planVariableDelete,
  planVariableDiff,
  planVariableExpression,
  planVariableInsert,
  valueAtPath,
  variablePlanProtections,
  variableProtections,
  wrapVariableProtection,
  type ProtectionChoice,
  type VariableMutationKind,
  type VariableProtection,
} from '../../utils/data-workbench';
import { validateVariableExpression } from '../../utils/expression-trial';
import VariableTreeNode from './VariableTreeNode.vue';
import WorkbenchDrawer from './WorkbenchDrawer.vue';

interface EditorState {
  mode: 'add' | 'edit' | 'batch' | 'delete';
  path: readonly string[];
  initial: unknown;
  revision: number | null;
  identityKey: string;
}

const props = defineProps<{
  data: unknown;
  statFunc: Readonly<Record<string, unknown>>;
  revision: number | null;
  identityKey: string;
}>();

const root = computed<Record<string, unknown>>(() =>
  props.data !== null && typeof props.data === 'object' && !Array.isArray(props.data)
    ? (props.data as Record<string, unknown>)
    : {},
);
const rootKeys = computed(() => Object.keys(root.value));
const filter = ref('');
const editor = ref<EditorState | null>(null);
const inputMode = ref<'value' | 'json' | 'expression'>('value');
const batchMode = ref<'state' | 'operations'>('state');
const valueType = ref<'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'>('string');
const valueText = ref('');
const jsonText = ref('');
const expression = ref('');
const keyInput = ref('');
const protectionChoice = ref<'' | ProtectionChoice>('');
const busy = ref(false);
const error = ref('');
const success = ref('');

watch(
  () => props.identityKey,
  () => {
    editor.value = null;
  },
);

const editorTitle = computed(() => {
  if (editor.value?.mode === 'add') return '新增变量';
  if (editor.value?.mode === 'delete') return '删除变量';
  if (editor.value?.mode === 'batch') return '批量编辑变量';
  return '编辑变量';
});

function pathText(path: readonly string[]): string {
  return path.length ? path.join('.') : '变量根';
}

function initialType(value: unknown): typeof valueType.value {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return typeof value;
  return 'string';
}

function textForValue(value: unknown, type: typeof valueType.value): string {
  if (type === 'object' || type === 'array') return JSON.stringify(value, null, 2);
  if (type === 'null') return '';
  return String(value ?? '');
}

/** 关闭抽屉时清空类型、诊断和保护选择，避免草稿在目标间串线。 */
function resetEditor(): void {
  error.value = '';
  success.value = '';
  protectionChoice.value = '';
  expression.value = '';
  keyInput.value = '';
}

/** 打开抽屉时克隆原子树，后续表单输入不得改动当前状态引用。 */
function openEditor(mode: EditorState['mode'], path: readonly string[], initial: unknown): void {
  resetEditor();
  editor.value = {
    mode,
    path: [...path],
    initial: structuredClone(initial),
    revision: props.revision,
    identityKey: props.identityKey,
  };
  valueType.value = initialType(initial);
  valueText.value = textForValue(initial, valueType.value);
  jsonText.value = JSON.stringify(initial, null, 2);
  batchMode.value = 'state';
  inputMode.value = mode === 'batch' || valueType.value === 'object' || valueType.value === 'array' ? 'json' : 'value';
}

function openAdd(parentPath: readonly string[]): void {
  openEditor('add', parentPath, '');
}

function openEdit(path: readonly string[]): void {
  openEditor('edit', path, valueAtPath(root.value, path));
}

function openDelete(path: readonly string[]): void {
  openEditor('delete', path, valueAtPath(root.value, path));
}

function openBatch(): void {
  openEditor('batch', [], root.value);
}

function closeEditor(): void {
  if (busy.value) return;
  editor.value = null;
}

/** 按选定类型校验数组或对象，避免结构类型在保存时静默漂移。 */
function parseStructuredDraft(kind: 'array' | 'object'): unknown {
  const value = JSON.parse(valueText.value);
  const valid =
    kind === 'array' ? Array.isArray(value) : value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!valid) throw new TypeError(kind === 'array' ? '请输入 JSON 数组。' : '请输入 JSON 对象。');
  return value;
}

/** 把当前编辑控件转换为类型明确的草稿，任何非法输入都在产生操作前失败。 */
function parseDraft(): unknown {
  if (inputMode.value === 'json' || editor.value?.mode === 'batch') return JSON.parse(jsonText.value);
  if (valueType.value === 'null') return null;
  if (valueType.value === 'boolean') return valueText.value === 'true';
  if (valueType.value === 'number') {
    const value = Number(valueText.value);
    if (!Number.isFinite(value)) throw new TypeError('数值必须是有限数字。');
    return value;
  }
  if (valueType.value === 'array' || valueType.value === 'object') return parseStructuredDraft(valueType.value);
  return valueText.value;
}

/** 新键在产生 Insert 前必须检查冲突，已有键不能被静默覆盖。 */
function targetPath(): readonly string[] {
  if (editor.value?.mode !== 'add') return editor.value?.path ?? [];
  const key = keyInput.value.trim();
  if (!key) throw new TypeError('新变量名称不能为空。');
  if (Object.prototype.hasOwnProperty.call(valueAtPath(root.value, editor.value.path) ?? {}, key)) {
    throw new TypeError('该变量已经存在，Insert 不会覆盖它。请改用编辑。');
  }
  return [...editor.value.path, key];
}

function basePlan(): readonly EraCommitOperation[] {
  if (!editor.value) return [];
  if (editor.value.mode === 'batch' && batchMode.value === 'operations') {
    const parsed = JSON.parse(jsonText.value) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) throw new TypeError('有序操作必须是非空 JSON 数组。');
    return parsed.map((item, index) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError(`第 ${index + 1} 个操作必须是对象。`);
      }
      const keys = Object.keys(item);
      if (keys.length !== 1 || !['insert', 'edit', 'delete'].includes(keys[0]!)) {
        throw new TypeError(`第 ${index + 1} 个操作只能包含 insert、edit 或 delete 之一。`);
      }
      const payload = (item as Record<string, unknown>)[keys[0]!];
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`第 ${index + 1} 个操作的载荷必须是对象。`);
      }
      return structuredClone(item) as EraCommitOperation;
    });
  }
  const path = targetPath();
  if (editor.value.mode === 'delete') return planVariableDelete(path).operations;
  if (inputMode.value === 'expression') {
    const trial = validateVariableExpression(expression.value, root.value, props.statFunc, path);
    if (!trial.ok) throw new TypeError(trial.diagnostics.map(item => item.message).join('；'));
    return planVariableExpression(path, expression.value).operations;
  }
  const draft = parseDraft();
  if (editor.value.mode === 'add') return planVariableInsert(path, draft).operations;
  return planVariableDiff(editor.value.initial, draft, path).operations;
}

const mutationKind = computed<VariableMutationKind>(() => {
  if (editor.value?.mode === 'add') return 'insert';
  if (editor.value?.mode === 'delete') return 'delete';
  return 'edit';
});

/** 保护集合来自目标和祖先，不能只根据当前节点的元数据。 */
const protections = computed<readonly VariableProtection[]>(() => {
  if (!editor.value) return [];
  try {
    if (editor.value.mode === 'batch') {
      if (batchMode.value === 'operations') return [];
      const draft = parseDraft();
      return variablePlanProtections(root.value, planVariableDiff(editor.value.initial, draft));
    }
    return variableProtections(root.value, targetPath(), mutationKind.value);
  } catch {
    return [];
  }
});

/** 预览与最终提交共用同一操作计划，避免确认前后出现顺序漂移。 */
const preview = computed<readonly EraCommitOperation[]>(() => {
  try {
    const operations = basePlan();
    if (!protections.value.length || !protectionChoice.value) return operations;
    return wrapVariableProtection(operations, protections.value, protectionChoice.value);
  } catch {
    return [];
  }
});

/** 对比打开时与当前子树，同一目标外部变化后必须重载。 */
function assertFresh(): void {
  if (!editor.value) throw new Error('编辑器已经关闭。');
  if (editor.value.identityKey !== props.identityKey) throw new Error('聊天已经切换，请重新打开编辑器。');
  if (editor.value.revision === props.revision) return;
  const current = valueAtPath(root.value, editor.value.path);
  if (!jsonEqual(current, editor.value.initial)) throw new Error('该变量在编辑期间已经变化，请重新载入后再保存。');
}

/** 根据编辑模式生成差异，并在发出事件前统一处理祖先保护。 */
async function save(): Promise<void> {
  if (!editor.value || busy.value) return;
  error.value = '';
  success.value = '';
  try {
    assertFresh();
    let operations = basePlan();
    if (operations.length === 0) throw new Error('没有检测到需要保存的变化。');
    if (protections.value.length > 0) {
      if (!protectionChoice.value) throw new Error('请选择如何处理 ERA 保护。');
      if (editor.value.mode === 'delete' && protectionChoice.value === 'temporary') {
        throw new Error('删除后无法恢复实体保护，只能解除保护后删除。');
      }
      operations = wrapVariableProtection(operations, protections.value, protectionChoice.value);
    }
    busy.value = true;
    const api = await waitForEraFacade();
    const receipt = await api.commit(operations, { scope: 'always' });
    if (receipt.status !== 'committed') throw new Error('ERA 跳过了本次 UI 提交。');
    success.value = `已保存到消息 #${receipt.messageId}。`;
    window.setTimeout(() => {
      if (!busy.value) editor.value = null;
    }, 700);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped src="./VariableWorkspace.css"></style>
