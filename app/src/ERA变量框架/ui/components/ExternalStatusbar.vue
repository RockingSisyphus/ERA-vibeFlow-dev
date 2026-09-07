<template>
  <section v-if="selection?.config.enabled" class="era-external" aria-label="ERA 外置状态栏">
    <header>
      <strong>外置状态栏</strong>
      <button :disabled="busy" @click="toggleEditor">{{ editing ? '关闭编辑' : '编辑' }}</button>
      <button :disabled="busy" :aria-busy="busy" @click="refresh">刷新</button>
      <span role="status">{{ statusText }}</span>
    </header>
    <div v-show="editing" class="editor">
      <textarea
        v-model="draft"
        aria-label="外置状态栏 HTML"
        spellcheck="false"
        @input="save?.edit(draft)"
        @blur="flush"
      />
      <p>输入自动保存到角色卡，点击刷新查看效果。分享前确认“已保存”；外部库文件不会自动打包。</p>
      <button v-if="!draft" @click="insertExample">插入示例</button>
      <button v-if="failed" :disabled="busy" @click="flush">重试保存</button>
    </div>
    <p v-if="errorText" role="alert">{{ errorText }}</p>
    <div ref="content" class="content" />
  </section>
</template>

<script setup lang="ts">
/** 外置编辑会话只表达用户意图；保存走 Service，内容运行由独立 iframe 壳负责。 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { externalStatusbarSelection as selection } from '../../service/external-statusbar-configuration';
import { externalDrafts } from '../external-statusbar-drafts';
import { getEraExternalStatusbarHtml } from '@era/example-resources';
import { mountExternalFrame } from '../../service/external-statusbar-frame';
import { getInstalledEraPublicApi } from '../../service/public-api';

const content = ref<HTMLElement>();
const draft = ref('');
const editing = ref(false);
const busy = ref(false);
const failed = ref(false);
const statusText = ref('已保存');
const runtimeError = ref('');
const saveError = ref('');
const errorText = computed(() => saveError.value || runtimeError.value);
let lease: ReturnType<typeof externalDrafts.acquire> | undefined;
let save: NonNullable<typeof lease>['save'] | undefined;
let runtime: ReturnType<typeof mountExternalFrame> | undefined;
let epoch = 0;
// 内容自动保存不改变身份键，因此不会导致作者脚本反复运行。
const identity = computed(() =>
  JSON.stringify([selection.value?.characterId, selection.value?.chatId, selection.value?.config.enabled]),
);

function report(error: unknown) {
  runtimeError.value = error instanceof Error ? error.message : String(error);
}
function release() {
  // 销毁前提交最后草稿，写入闭包仍捕获原角色，迟到通知不改新 UI。
  epoch++;
  runtime?.stop();
  runtime = undefined;
  if (save) {
    lease?.release();
    lease = undefined;
    save = undefined;
  }
}

function render() {
  // 只有明确刷新或上下文切换才创建新 iframe；保存回执不走此入口。
  if (!content.value || !selection.value?.config.enabled) return;
  runtime?.stop();
  const parent = content.value.ownerDocument.defaultView as Window & {
    TavernHelper: Record<string, unknown>;
    SillyTavern: { getContext(): unknown };
  };
  runtime = mountExternalFrame(
    content.value,
    draft.value,
    {
      era: getInstalledEraPublicApi(),
      helper: parent.TavernHelper,
      getContext: () => parent.SillyTavern.getContext(),
      macros: text => substitudeMacros(text),
    },
    report,
  );
}

watch(
  identity,
  async () => {
    // 聊天或角色切换创建新会话，不借用上一个 iframe 的状态。
    release();
    const current = selection.value;
    const token = epoch;
    draft.value = current?.config.html ?? '';
    editing.value = false;
    failed.value = false;
    runtimeError.value = '';
    saveError.value = '';
    busy.value = false;
    statusText.value = '已保存';
    if (!current?.config.enabled) return;
    lease = externalDrafts.acquire(current.characterId, draft.value, (status, error) => {
      if (epoch !== token) return;
      failed.value = status === 'failed';
      statusText.value = { saving: '保存中', saved: '已保存', failed: '保存失败' }[status];
      saveError.value = error ? (error instanceof Error ? error.message : String(error)) : '';
    });
    save = lease.save;
    draft.value = save.value;
    await nextTick();
    if (epoch === token) {
      try {
        render();
      } catch (error) {
        report(error);
      }
    }
  },
  { immediate: true },
);

async function flush() {
  // 保存失败不关闭编辑器、不替换运行现场，用户可在原草稿上重试。
  try {
    await save?.flush();
    return true;
  } catch (error) {
    // 保存协调器已发布失败；不要把保存错误留在独立的运行错误区。
    return false;
  }
}
async function toggleEditor() {
  if (editing.value && !(await flush())) return;
  editing.value = !editing.value;
}
async function refresh() {
  // 先落盘后渲染，分享出去的内容才会与本次显式刷新一致。
  if (busy.value) return;
  busy.value = true;
  const token = epoch;
  try {
    if ((await flush()) && token === epoch) {
      runtimeError.value = '';
      render();
    }
  } catch (error) {
    report(error);
  } finally {
    if (token === epoch) busy.value = false;
  }
}
function insertExample() {
  // 插入是用户明确动作，绝不以默认示例覆盖已有作者 HTML。
  if (draft.value) return;
  draft.value = getEraExternalStatusbarHtml();
  save?.edit(draft.value);
}
onBeforeUnmount(release);
</script>

<style scoped>
.era-external {
  background: #23323c;
  color: #e5eef3;
  border-top: 1px solid #51616a;
  font: 13px system-ui;
  min-width: 0;
}
header {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 5px 10px;
  flex-wrap: wrap;
}
header strong {
  margin-right: auto;
}
button {
  border: 1px solid #607581;
  border-radius: 6px;
  padding: 4px 10px;
  background: #304651;
  color: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.editor {
  padding: 8px;
  max-height: 30dvh;
  overflow: auto;
}
textarea {
  width: 100%;
  min-height: 120px;
  font: 12px monospace;
  white-space: pre;
  background: #17242c;
  color: #edf5f8;
}
p {
  margin: 5px 8px;
  overflow-wrap: anywhere;
}
.content {
  max-height: 30dvh;
  overflow: auto;
}
</style>
