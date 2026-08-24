import { createPinia } from 'pinia';
import { createApp, type App as VueApp } from 'vue';
import { createEraFacade, type EraPublicState } from '../service/public-api';
import { settings } from '../utils/era_data';
import { Logger } from '../utils/log';
import App from './App.vue';
import { useUiStore } from './store';
import { createMountPoint, destroyMountPoint, deteleportStyle, teleportStyle } from './utils/dom';

const logger = new Logger();
let activeUiStop: (() => void) | null = null;

export interface EraUiHandle {
  readonly mounted: boolean;
  stop(): void;
}

/**
 * 显式挂载 ERA Vue/Pinia UI。为了确保 pagehide 和热重载能完全清理，
 * 页面生命周期由生产入口统一管理，本模块只保存自己创建的资源。
 */
export function startEraUi(): EraUiHandle {
  // 同一 script ID 的新实例必须先完整释放旧实例，避免热重载遗留 Vue、监听器、
  // 宿主样式或全局调试入口。
  activeUiStop?.();
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
  let active = true;
  const switchView = (viewName: 'FloatingBall' | 'ExpandedView') => uiStore.switchView(viewName);
  const facade = createEraFacade();
  const stateHandler = (data: EraPublicState) => {
    if (!active) return;
    uiStore.setEventData(data.status === 'ready' ? data : null);
  };

  const eraWindow = window as Window & {
    eraUiStore?: typeof uiStore;
    eraUiSwitchView?: typeof switchView;
  };
  eraWindow.eraUiStore = uiStore;
  eraWindow.eraUiSwitchView = switchView;
  teleportStyle();
  const unsubscribeState = facade.subscribe(stateHandler);

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    active = false;
    unsubscribeState();
    vueApp.unmount();

    // 旧 handle 在新实例已接管后只能清理它自己的 Vue/监听器，不能误删新实例的
    // mount/style/global 资源。
    if (activeUiStop === stop) {
      activeUiStop = null;
      deteleportStyle();
      destroyMountPoint();
      if (eraWindow.eraUiStore === uiStore) delete eraWindow.eraUiStore;
      if (eraWindow.eraUiSwitchView === switchView) delete eraWindow.eraUiSwitchView;
    }
    logger.log('stopEraUi', 'ERA UI 已完整卸载。');
  };
  activeUiStop = stop;
  return Object.freeze({
    mounted: true,
    stop,
  });
}
