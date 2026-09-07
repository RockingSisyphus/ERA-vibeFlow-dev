import { createExternalStatusbarSave } from './external-statusbar-save';

type SaveStatus = 'saving' | 'saved' | 'failed';
type Listener = (status: SaveStatus, error?: unknown) => void;

/** 为避免切聊天丢失失败草稿或产生并行写入者，页面内复用未落盘的角色会话。 */
export function createExternalDraftStore(write: (characterId: string, html: string) => Promise<void>) {
  const entries = new Map<
    string,
    {
      save: ReturnType<typeof createExternalStatusbarSave>;
      listeners: Set<Listener>;
      status: SaveStatus;
      error?: unknown;
    }
  >();
  return {
    acquire(characterId: string, initial: string, listener: Listener) {
      let entry = entries.get(characterId);
      if (!entry) {
        const listeners = new Set<Listener>();
        const created = {
          save: createExternalStatusbarSave(initial, html => write(characterId, html), notify),
          listeners,
          status: 'saved' as SaveStatus,
          error: undefined as unknown,
        };
        /** 失败草稿不能随旧面板消失；下次打开恢复原内容和真实保存状态。 */
        function notify(status: SaveStatus, error?: unknown) {
          created.status = status;
          created.error = error;
          for (const notifyListener of listeners) notifyListener(status, error);
          if (status === 'saved' && listeners.size === 0) entries.delete(characterId);
        }
        entry = created;
        entries.set(characterId, entry);
      }
      const current = entry;
      current.listeners.add(listener);
      listener(current.status, current.error);
      return {
        save: current.save,
        release() {
          current.listeners.delete(listener);
          // flush 不关闭保存器：快速切回同一卡时继续共用正在排队的写入。
          void current.save.flush().catch(() => undefined);
          if (!current.save.dirty && current.listeners.size === 0) entries.delete(characterId);
        },
      };
    },
  };
}
