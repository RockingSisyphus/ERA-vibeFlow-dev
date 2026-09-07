/** 为避免旧请求覆盖新输入，单角色会话串行合并保存；绝不驱动 iframe 执行。 */
export function createExternalStatusbarSave(
  initial: string,
  write: (html: string) => Promise<void>,
  changed: (status: 'saving' | 'saved' | 'failed', error?: unknown) => void,
  delay = 300,
) {
  let draft = initial;
  let saved = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;

  async function drain(): Promise<void> {
    try {
      while (draft !== saved) {
        const next = draft;
        changed('saving');
        await write(next);
        saved = next;
      }
      changed('saved');
    } catch (error) {
      changed('failed', error);
      throw error;
    }
  }

  function flush(): Promise<void> {
    clearTimeout(timer);
    if (running) return running;
    running = drain().finally(() => {
      running = undefined;
    });
    return running;
  }

  return {
    get value() {
      return draft;
    },
    get dirty() {
      return draft !== saved;
    },
    edit(html: string) {
      if (stopped) return;
      draft = html;
      changed(draft === saved ? 'saved' : 'saving');
      clearTimeout(timer);
      timer = setTimeout(() => {
        void flush().catch(() => undefined);
      }, delay);
    },
    flush,
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
