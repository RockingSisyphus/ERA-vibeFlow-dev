import { createApp } from 'vue';
import ExternalStatusbar from './components/ExternalStatusbar.vue';
import {
  refreshExternalStatusbarSelection,
  externalStatusbarSelection,
} from '../service/external-statusbar-configuration';
import { teleportStyle, deteleportStyle } from './utils/dom';

/** 为避免关闭悬浮球连带隐藏内容，独立管理正常布局节点与卸载。 */
export function startExternalStatusbar(): () => void {
  const form = $('#form_sheld')[0];
  if (!form) throw new Error('未找到酒馆输入区，无法挂载外置状态栏');
  const element = form.ownerDocument.createElement('div');
  element.id = `era-external-statusbar-${getScriptId()}`;
  element.style.cssText = 'flex:0 0 auto;min-width:0';
  form.before(element);
  const app = createApp(ExternalStatusbar);
  refreshExternalStatusbarSelection();
  app.mount(element);
  teleportStyle();
  const listener = eventOn(tavern_events.CHAT_CHANGED, refreshExternalStatusbarSelection);
  return () => {
    listener.stop();
    app.unmount();
    element.remove();
    externalStatusbarSelection.value = null;
    deteleportStyle();
  };
}
