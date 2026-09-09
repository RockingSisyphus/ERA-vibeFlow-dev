/** 为了让 Helper 自己清理实例，只通过公开设置控件接入，不访问内部组件/store。 */
export function createSingleFloorHelper(document: Document) {
  // Helper 会保存公开控件的修改；页面内存不足以在 reload 后恢复原设置。
  // 只记录待恢复的偏好，不记录消息或维护第二份 Helper runtime。
  const storage = document.defaultView!.localStorage;
  const restoreKey = 'era.single-floor.helper-original-depth';
  function findDepthInput(): HTMLInputElement | null {
    const root = document.querySelector('#tavern_helper');
    const title = [...(root?.querySelectorAll('.TH-Item--title') ?? [])].find(element =>
      /^(渲染深度|Render depth|Rendering depth)$/i.test(element.textContent?.trim() ?? ''),
    );
    const input = title?.parentElement?.parentElement?.querySelector<HTMLInputElement>('input[type="number"]');
    return input ?? null;
  }
  function depthInput(): HTMLInputElement {
    const input = findDepthInput();
    if (!input) throw new Error('未找到 Helper 渲染深度控件，请打开酒馆助手的渲染页后重试。');
    return input;
  }
  let original: string | null = storage.getItem(restoreKey);
  let changedByUser = false;
  function observe(event: Event) {
    if (event.isTrusted && event.target instanceof document.defaultView!.HTMLInputElement) {
      if (event.target === findDepthInput()) {
        changedByUser = true;
        original = null;
        storage.removeItem(restoreKey);
      }
    }
  }
  function write(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
  }
  return {
    acquire() {
      const input = depthInput();
      if (input.value !== '0' || original === null) original = input.value;
      storage.setItem(restoreKey, original);
      changedByUser = false;
      if (input.value !== '0') write(input, '0');
      document.addEventListener('input', observe, true);
    },
    release(unloading = false) {
      document.removeEventListener('input', observe, true);
      if (original !== null && !changedByUser) {
        const input = depthInput();
        if (input.value === '0' && input.value !== original) write(input, original);
      }
      // 页面退出时 Helper 的延迟保存可能尚未落盘，保留恢复值给下一页面。
      if (!unloading) storage.removeItem(restoreKey);
      original = null;
    },
  };
}
