import { createPinia } from 'pinia';
import { createApp, type App as VueApp } from 'vue';
import { ERA_EVENT_EMITTER, type WriteDonePayload } from '../utils/constants';
import { settings } from '../utils/era_data';
import { Logger } from '../utils/log';
import App from './App.vue';
import { useUiStore } from './store';
import { createMountPoint, destroyMountPoint, deteleportStyle, teleportStyle } from './utils/dom';

const logger = new Logger();

export interface EraUiHandle {
  readonly mounted: boolean;
  stop(): void;
}

/**
 * 显式挂载 ERA Vue/Pinia UI。为了确保 pagehide 和热重载能完全清理，
 * 页面生命周期由生产入口统一管理，本模块只保存自己创建的资源。
 */
export function startEraUi(): EraUiHandle {
  if (settings.value['开启悬浮球'] === false) {
    logger.log('startEraUi', '悬浮球设置为关闭，本次不挂载 UI。');
    return Object.freeze({ mounted: false, stop: () => undefined });
  }

  destroyMountPoint();
  deteleportStyle();

  const mountPoint = createMountPoint();
  $('body').append(mountPoint);

  const vueApp: VueApp = createApp(App);
  const pinia = createPinia();
  vueApp.use(pinia);
  vueApp.mount(mountPoint[0]);

  const uiStore = useUiStore(pinia);
  const switchView = (viewName: 'FloatingBall' | 'ExpandedView') => uiStore.switchView(viewName);
  const writeDoneHandler = (data: WriteDonePayload) => {
    logger.log(ERA_EVENT_EMITTER.WRITE_DONE, '接收到 writeDone，更新 UI store。', data);
    uiStore.setEventData(data);
  };

  const eraWindow = window as Window & {
    eraUiStore?: typeof uiStore;
    eraUiSwitchView?: typeof switchView;
  };
  eraWindow.eraUiStore = uiStore;
  eraWindow.eraUiSwitchView = switchView;
  teleportStyle();
  eventOn(ERA_EVENT_EMITTER.WRITE_DONE, writeDoneHandler);

  let stopped = false;
  return Object.freeze({
    mounted: true,
    stop(): void {
      if (stopped) return;
      stopped = true;
      eventRemoveListener(ERA_EVENT_EMITTER.WRITE_DONE, writeDoneHandler);
      vueApp.unmount();
      deteleportStyle();
      destroyMountPoint();
      delete eraWindow.eraUiStore;
      delete eraWindow.eraUiSwitchView;
      logger.log('stopEraUi', 'ERA UI 已完整卸载。');
    },
  });
}
