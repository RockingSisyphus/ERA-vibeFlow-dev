<template>
  <section class="function-workspace" aria-label="当前函数">
    <div class="function-toolbar">
      <label>
        <span>搜索函数</span>
        <input v-model="filter" type="search" placeholder="函数名、参数或表达式" />
      </label>
      <button type="button" @click="openAdd">新增函数</button>
      <button type="button" @click="openBatch">批量/高级</button>
    </div>
    <div v-if="filteredFunctions.length" class="function-grid">
      <article v-for="item in filteredFunctions" :key="item.name" class="function-card">
        <header>
          <strong>{{ item.name }}({{ item.params.join(', ') }})</strong>
          <span v-if="item.locked" class="lock-chip">{{ item.locked }}</span>
        </header>
        <code class="function-expression">{{ item.expr }}</code>
        <div class="function-actions">
          <button type="button" :aria-label="`编辑函数 ${item.name}`" @click="openEdit(item.name)">编辑</button>
          <button type="button" :aria-label="`试算函数 ${item.name}`" @click="openTrial(item.name)">试算</button>
          <button type="button" :aria-label="`将函数 ${item.name} 另存为`" @click="openSaveAs(item.name)">
            另存为
          </button>
          <button class="danger" type="button" :aria-label="`删除函数 ${item.name}`" @click="openDelete(item.name)">
            删除
          </button>
        </div>
      </article>
    </div>
    <div v-else class="function-empty">当前没有自定义函数。</div>

    <WorkbenchDrawer v-if="editor" :title="editorTitle" :subtitle="editor.name || '函数库'" @close="closeEditor">
      <form class="function-form" @submit.prevent="save">
        <label v-if="editor.mode === 'add' || editor.mode === 'save-as'">
          <span>函数名</span>
          <input v-model="nameInput" aria-label="函数名" autocomplete="off" />
        </label>
        <label v-else-if="editor.mode !== 'batch' && editor.mode !== 'delete' && editor.mode !== 'trial'">
          <span>函数名（编辑时不可改名）</span>
          <input :value="editor.name" aria-label="函数名" disabled />
        </label>

        <template v-if="editor.mode === 'add' || editor.mode === 'edit' || editor.mode === 'save-as'">
          <div class="mode-switch" role="group" aria-label="函数编辑方式">
            <button type="button" :class="{ active: !advanced }" @click="advanced = false">类型表单</button>
            <button type="button" :class="{ active: advanced }" @click="advanced = true">高级 JSON</button>
          </div>
          <template v-if="!advanced">
            <label>
              <span>形参（逗号分隔，可拖动前先在这里调整顺序）</span>
              <input v-model="paramsInput" aria-label="函数形参" placeholder="x, y" />
            </label>
            <label>
              <span>函数表达式</span>
              <textarea v-model="exprInput" aria-label="函数表达式" rows="6" spellcheck="false" />
            </label>
            <label>
              <span>$meta JSON（可留空）</span>
              <textarea v-model="metaInput" aria-label="函数元数据 JSON" rows="5" spellcheck="false" />
            </label>
          </template>
          <label v-else>
            <span>完整函数定义 JSON</span>
            <textarea v-model="definitionInput" aria-label="高级函数 JSON" rows="13" spellcheck="false" />
          </label>
        </template>

        <label v-if="editor.mode === 'batch'">
          <span>完整 statFunc JSON</span>
          <textarea v-model="libraryInput" aria-label="完整函数库 JSON" rows="16" spellcheck="false" />
        </label>

        <template v-if="editor.mode === 'trial'">
          <label>
            <span>试算参数（逗号分隔有限数值）</span>
            <input v-model="trialArgsInput" aria-label="函数试算参数" placeholder="1, 2" />
          </label>
          <button class="trial-button" type="button" @click="trial">运行试算</button>
          <output v-if="trialOutput" class="trial-output" aria-live="polite">{{ trialOutput }}</output>
        </template>

        <div v-if="editor.mode === 'delete'" class="delete-warning">
          将删除函数 <strong>{{ editor.name }}</strong
          >。引用该函数的其他定义必须仍能通过完整函数库校验。
        </div>

        <div v-if="protections.length" class="protection-box" role="alert">
          <strong>检测到函数保护</strong>
          <p>{{ protections.map(item => `${item.field}=${JSON.stringify(item.value)}`).join('，') }}</p>
          <label>
            <span>处理方式</span>
            <select v-model="protectionChoice" aria-label="函数保护处理方式">
              <option value="">请选择</option>
              <option v-if="editor.mode !== 'delete'" value="temporary">仅本次修改，完成后恢复保护</option>
              <option value="unlock">解除保护并继续</option>
            </select>
          </label>
        </div>

        <div v-if="preview.length && editor.mode !== 'trial'" class="operation-preview">
          <strong>将提交 {{ preview.length }} 个有序操作</strong>
          <pre>{{ JSON.stringify(preview, null, 2) }}</pre>
        </div>
        <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
        <p v-if="success" class="editor-success" role="status">{{ success }}</p>
        <footer class="function-footer">
          <button type="button" @click="closeEditor">取消</button>
          <button v-if="editor.mode !== 'trial'" class="primary" type="submit" :disabled="busy">
            {{ busy ? '正在保存…' : '确认保存' }}
          </button>
        </footer>
      </form>
    </WorkbenchDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { EraCommitOperation } from '../../../service/public-api';
import { waitForEraFacade } from '../../utils/facade';
import {
  functionProtection,
  functionPlanProtections,
  jsonEqual,
  planFunctionLibraryDiff,
  wrapFunctionPlanProtections,
  wrapFunctionProtection,
  type ProtectionChoice,
} from '../../utils/data-workbench';
import { runFunctionTrial, validateFunctionLibrary } from '../../utils/expression-trial';
import WorkbenchDrawer from './WorkbenchDrawer.vue';

interface FunctionDefinition {
  readonly params: readonly string[];
  readonly expr: string;
  readonly $meta?: Readonly<Record<string, unknown>>;
}

interface EditorState {
  readonly mode: 'add' | 'edit' | 'save-as' | 'delete' | 'trial' | 'batch';
  readonly name: string;
  readonly initial: unknown;
  readonly revision: number | null;
  readonly identityKey: string;
}

const props = defineProps<{
  library: Readonly<Record<string, unknown>>;
  revision: number | null;
  identityKey: string;
}>();

const filter = ref('');
const editor = ref<EditorState | null>(null);
const nameInput = ref('');
const paramsInput = ref('');
const exprInput = ref('');
const metaInput = ref('');
const definitionInput = ref('');
const libraryInput = ref('');
const trialArgsInput = ref('');
const trialOutput = ref('');
const advanced = ref(false);
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

function asDefinition(value: unknown): FunctionDefinition {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { params: [], expr: '' };
  const raw = value as Record<string, unknown>;
  return {
    params: Array.isArray(raw.params) ? raw.params.filter((item): item is string => typeof item === 'string') : [],
    expr: typeof raw.expr === 'string' ? raw.expr : '',
    ...(raw.$meta !== null && typeof raw.$meta === 'object' && !Array.isArray(raw.$meta)
      ? { $meta: raw.$meta as Record<string, unknown> }
      : {}),
  };
}

const filteredFunctions = computed(() => {
  const needle = filter.value.trim().toLocaleLowerCase();
  return Object.entries(props.library)
    .map(([name, raw]) => {
      const definition = asDefinition(raw);
      const meta = definition.$meta ?? {};
      const locked =
        meta.updatable === false ? '禁改' : typeof meta.necessary === 'string' ? `必需:${meta.necessary}` : '';
      return { name, ...definition, locked };
    })
    .filter(
      item => !needle || `${item.name} ${item.params.join(' ')} ${item.expr}`.toLocaleLowerCase().includes(needle),
    );
});

const editorTitle = computed(() => {
  switch (editor.value?.mode) {
    case 'add':
      return '新增函数';
    case 'save-as':
      return '另存为新函数';
    case 'delete':
      return '删除函数';
    case 'trial':
      return '函数试算';
    case 'batch':
      return '批量编辑函数库';
    default:
      return '编辑函数';
  }
});

function reset(): void {
  nameInput.value = '';
  paramsInput.value = '';
  exprInput.value = '';
  metaInput.value = '';
  definitionInput.value = '';
  libraryInput.value = '';
  trialArgsInput.value = '';
  trialOutput.value = '';
  protectionChoice.value = '';
  advanced.value = false;
  error.value = '';
  success.value = '';
}

function open(mode: EditorState['mode'], name = ''): void {
  reset();
  const initial = name ? props.library[name] : mode === 'batch' ? props.library : null;
  editor.value = {
    mode,
    name,
    initial: structuredClone(initial),
    revision: props.revision,
    identityKey: props.identityKey,
  };
  const definition = asDefinition(initial);
  nameInput.value = mode === 'save-as' ? `${name}_copy` : name;
  paramsInput.value = definition.params.join(', ');
  exprInput.value = definition.expr;
  metaInput.value = definition.$meta ? JSON.stringify(definition.$meta, null, 2) : '';
  definitionInput.value = JSON.stringify(initial ?? { params: [], expr: '' }, null, 2);
  libraryInput.value = JSON.stringify(props.library, null, 2);
}

const openAdd = () => open('add');
const openEdit = (name: string) => open('edit', name);
const openSaveAs = (name: string) => open('save-as', name);
const openDelete = (name: string) => open('delete', name);
const openTrial = (name: string) => open('trial', name);
const openBatch = () => open('batch');

function closeEditor(): void {
  if (!busy.value) editor.value = null;
}

function parseDefinition(): FunctionDefinition {
  if (advanced.value) return JSON.parse(definitionInput.value) as FunctionDefinition;
  const params = paramsInput.value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const meta = metaInput.value.trim() ? (JSON.parse(metaInput.value) as Record<string, unknown>) : undefined;
  return { params, expr: exprInput.value, ...(meta ? { $meta: meta } : {}) };
}

function draftLibrary(): Record<string, unknown> {
  if (!editor.value) return {};
  if (editor.value.mode === 'batch') {
    const parsed = JSON.parse(libraryInput.value) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new TypeError('statFunc 必须是 JSON 对象。');
    return parsed as Record<string, unknown>;
  }
  const draft = structuredClone(props.library) as Record<string, unknown>;
  if (editor.value.mode === 'delete') {
    delete draft[editor.value.name];
    return draft;
  }
  const name = editor.value.mode === 'edit' ? editor.value.name : nameInput.value.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new TypeError('函数名必须是英文标识符。');
  if (editor.value.mode !== 'edit' && Object.prototype.hasOwnProperty.call(draft, name)) {
    throw new TypeError('目标函数已经存在；另存为不会覆盖原函数。');
  }
  draft[name] = parseDefinition();
  return draft;
}

function baseOperations(): readonly EraCommitOperation[] {
  const draft = draftLibrary();
  const diagnostics = validateFunctionLibrary(draft);
  if (diagnostics.length) throw new TypeError(diagnostics.map(item => item.message).join('；'));
  return planFunctionLibraryDiff(props.library, draft).operations;
}

const protections = computed(() => {
  if (!editor.value) return [];
  if (editor.value.mode === 'batch') {
    try {
      const plan = planFunctionLibraryDiff(props.library, draftLibrary());
      return functionPlanProtections(props.library, plan);
    } catch {
      return [];
    }
  }
  if (!editor.value.name || !['edit', 'delete'].includes(editor.value.mode)) return [];
  return functionProtection(props.library[editor.value.name], editor.value.mode as 'edit' | 'delete');
});

const preview = computed<readonly EraCommitOperation[]>(() => {
  try {
    let operations = baseOperations();
    if (protections.value.length && protectionChoice.value && editor.value) {
      operations =
        editor.value.mode === 'batch'
          ? wrapFunctionPlanProtections(operations, protections.value, protectionChoice.value)
          : wrapFunctionProtection(editor.value.name, operations, protections.value, protectionChoice.value);
    }
    return operations;
  } catch {
    return [];
  }
});

function assertFresh(): void {
  if (!editor.value) throw new Error('编辑器已经关闭。');
  if (editor.value.identityKey !== props.identityKey) throw new Error('聊天已经切换，请重新打开编辑器。');
  if (editor.value.revision === props.revision) return;
  const current = editor.value.mode === 'batch' ? props.library : props.library[editor.value.name];
  if (!jsonEqual(current, editor.value.initial)) throw new Error('该函数在编辑期间已经变化，请重新载入后再保存。');
}

async function save(): Promise<void> {
  if (!editor.value || busy.value) return;
  error.value = '';
  success.value = '';
  try {
    assertFresh();
    let operations = baseOperations();
    if (!operations.length) throw new Error('没有检测到需要保存的变化。');
    if (protections.value.length) {
      if (!protectionChoice.value) throw new Error('请选择如何处理函数保护。');
      if (editor.value.mode === 'delete' && protectionChoice.value === 'temporary') {
        throw new Error('删除函数后无法恢复保护。');
      }
      operations =
        editor.value.mode === 'batch'
          ? wrapFunctionPlanProtections(operations, protections.value, protectionChoice.value)
          : wrapFunctionProtection(editor.value.name, operations, protections.value, protectionChoice.value);
    }
    busy.value = true;
    const receipt = await (await waitForEraFacade()).commit(operations, { scope: 'always' });
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

function trial(): void {
  error.value = '';
  trialOutput.value = '';
  if (!editor.value) return;
  try {
    const args = trialArgsInput.value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(Number);
    const result = runFunctionTrial(editor.value.name, args, props.library);
    if (!result.ok) throw new Error(result.diagnostics.map(item => item.message).join('；'));
    trialOutput.value = `${editor.value.name}(${args.join(', ')}) = ${result.value}`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}
</script>

<style scoped>
.function-workspace {
  position: relative;
  min-height: 280px;
  border: 1px solid var(--border-normal);
  border-radius: 13px;
  background: var(--bg-soft);
  overflow: hidden;
}
.function-toolbar {
  display: flex;
  align-items: end;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--border-soft);
}
.function-toolbar label,
.function-form label {
  display: grid;
  gap: 5px;
  color: var(--text-subtitle);
  font-size: 11px;
  font-weight: 700;
}
.function-toolbar label {
  min-width: 0;
  flex: 1;
}
.function-toolbar input,
.function-form input,
.function-form textarea,
.function-form select {
  width: 100%;
  border: 1px solid var(--border-normal);
  border-radius: 9px;
  background: var(--bg-solid);
  color: var(--text-title);
  padding: 9px 10px;
  font: inherit;
}
.function-toolbar button,
.function-actions button,
.function-footer button,
.mode-switch button,
.trial-button {
  border: 1px solid var(--border-normal);
  border-radius: 9px;
  background: var(--bg-solid);
  color: var(--text-subtitle);
  padding: 8px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.function-grid {
  display: grid;
  gap: 9px;
  padding: 12px;
  max-height: 440px;
  overflow: auto;
}
.function-card {
  display: grid;
  gap: 9px;
  padding: 11px;
  border: 1px solid var(--border-normal);
  border-radius: 11px;
  background: var(--bg-solid);
}
.function-card header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-title);
}
.function-expression {
  display: block;
  padding: 8px 10px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--text-title);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.lock-chip {
  border-radius: 999px;
  padding: 2px 7px;
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.72);
  font-size: 10px;
}
.function-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.function-actions .danger {
  color: #b91c1c;
}
.function-empty {
  padding: 42px 18px;
  text-align: center;
  color: var(--text-normal);
}
.function-form {
  display: grid;
  gap: 14px;
}
.function-form textarea {
  resize: vertical;
  line-height: 1.5;
}
.mode-switch {
  display: flex;
  gap: 6px;
}
.mode-switch button.active {
  border-color: #60a5fa;
  color: #2563eb;
  background: rgba(96, 165, 250, 0.12);
}
.delete-warning,
.protection-box,
.operation-preview,
.trial-output {
  border: 1px solid var(--border-normal);
  border-radius: 10px;
  padding: 11px;
  color: var(--text-subtitle);
  background: var(--bg-solid);
  font-size: 12px;
}
.protection-box {
  border-color: #f59e0b;
}
.operation-preview pre {
  max-height: 190px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 10px;
  color: var(--text-normal);
}
.editor-error,
.editor-success {
  margin: 0;
  padding: 9px 10px;
  border-radius: 9px;
}
.editor-error {
  color: #b91c1c;
  background: rgba(254, 226, 226, 0.75);
}
.editor-success {
  color: #047857;
  background: rgba(209, 250, 229, 0.72);
}
.function-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.function-footer .primary {
  border-color: #60a5fa;
  background: linear-gradient(180deg, #dbeafe, #bfdbfe);
  color: #0f172a;
}
@media (max-width: 560px) {
  .function-toolbar {
    flex-wrap: wrap;
  }
  .function-toolbar label {
    flex-basis: 100%;
  }
}
</style>
