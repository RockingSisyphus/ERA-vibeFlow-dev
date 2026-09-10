/**
 * 外置内容的浏览器运行壳：只提供公共接口、宏值绑定与资源清理。
 * 作者节点和脚本归浏览器所有，变量事务仍委托原 Service，不能在这里重算。
 */
import { createEraMacroRegex, createEraLazyMacroToken, resolveEraLazyMacroTokens } from '../macro/syntax';
import type { EraFacade, EraPublicState } from './public-api';

/** 宿主注入的公共能力；不依赖 Helper 私有运行器。 */
export interface ExternalFrameHost {
  readonly era: EraFacade;
  readonly helper: Readonly<Record<string, unknown>>;
  readonly getContext: () => unknown;
  readonly macros: (text: string) => string;
}

/** 为避免脚本自激，只绑定 ERA 文本/属性值，不替换作者节点。 */
export function bindExternalMacros(document: Document, read: () => EraPublicState): () => void {
  const bindings: Array<{ source: string; put: (value: string) => void }> = [];
  const mountBindings: typeof bindings = [];
  // 样式宏仅在首个就绪状态求值；修改 CSS 文本不会将变量重新解析为 HTML。
  for (const style of document.querySelectorAll('style')) {
    if (style.textContent?.includes('__ERA_LAZY_MACRO_V2_'))
      mountBindings.push({
        source: style.textContent,
        put: value => {
          style.textContent = value;
        },
      });
  }
  const walker = document.createTreeWalker(document.body, 4);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('script,style')) continue;
    const text = node;
    if (text.nodeValue?.includes('__ERA_LAZY_MACRO_V2_')) {
      bindings.push({
        source: text.nodeValue,
        put: value => {
          text.nodeValue = value;
        },
      });
    }
  }
  for (const element of document.body.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      // 可执行属性不是数据绑定；作者在事件脚本中使用 ERA API。
      if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc') continue;
      if (attribute.value.includes('__ERA_LAZY_MACRO_V2_')) {
        (attribute.name === 'style' ? mountBindings : bindings).push({
          source: attribute.value,
          put: value => element.setAttribute(attribute.name, value),
        });
      }
    }
  }
  return () => {
    const state = read();
    if (state.status !== 'ready') return;
    for (const binding of [...mountBindings.splice(0), ...bindings])
      binding.put(
        resolveEraLazyMacroTokens(binding.source, {
          statWithMeta: state.statData,
          statWithoutMeta: state.statWithoutMeta,
        }),
      );
  };
}

/** 阶段等待属于外置页面实例，普通注销和实例销毁具有不同的续体语义。 */
function externalGeneration(era: EraFacade, subscriptions: Set<() => void>, assertActive: () => void) {
  return Object.freeze({
    /** 作者注销仅退出回调；页面销毁必须取消阶段等待，避免旧页面任务恢复后启动后续生成。 */
    subscribe: (...args: Parameters<EraFacade['generation']['subscribe']>) => {
      assertActive();
      const stop = era.generation.subscribe(...args) as import('./generation-subscriptions').GenerationSubscriptionStop;
      const dispose = () => {
        (stop.cancelPending ?? stop)();
        subscriptions.delete(dispose);
      };
      subscriptions.add(dispose);
      return () => {
        stop();
        subscriptions.delete(dispose);
      };
    },
  });
}

/**
 * about:blank 的原生 document.write 保持 HTML parser 脚本顺序；接口在首个作者
 * 字节写入前安装，否则首个脚本可能读到错误的顶层对象。
 * 不是 load 后补接口，也不遍历脚本重新执行。
 */
function createExternalFacade(host: ExternalFrameHost) {
  let active = true;
  const subscriptions = new Set<() => void>();
  const pending = new Set<(error: Error) => void>();
  const assertActive = () => {
    if (!active) throw new Error('ERA_EXTERNAL_INSTANCE_DISPOSED');
  };
  const facade = Object.freeze({
    generation: externalGeneration(host.era, subscriptions, assertActive),
    get: () => {
      assertActive();
      return host.era.get();
    },
    /** 为避免切聊天后悬挂，等待归当前实例所有，并随 stop 拒绝。 */
    ready: () => {
      assertActive();
      const initial = host.era.get();
      if (initial.status === 'ready') return Promise.resolve(initial);
      return new Promise<EraPublicState>((resolve, reject) => {
        pending.add(reject);
        let stop: () => void = () => undefined;
        let settled = false;
        /** 订阅可能同步发布，因此必须兼容 release 尚未返回的时刻。 */
        const listener = (state: EraPublicState) => {
          if (state.status !== 'ready' || !active) return;
          settled = true;
          pending.delete(reject);
          stop?.();
          if (stop) subscriptions.delete(stop);
          resolve(state);
        };
        stop = host.era.subscribe(listener);
        if (settled) stop();
        else subscriptions.add(stop);
      });
    },
    /** 所有作者订阅必须随实例释放，不能污染下一聊天。 */
    subscribe(listener: (state: EraPublicState) => void) {
      assertActive();
      /** 释放后的迟到通知不能再驱动旧作者实例。 */
      const deliver = (state: EraPublicState) => {
        if (active) listener(state);
      };
      const stop = host.era.subscribe(deliver);
      const release = () => {
        stop();
        subscriptions.delete(release);
      };
      subscriptions.add(release);
      return release;
    },
    commit: (...args: Parameters<EraFacade['commit']>) => {
      assertActive();
      return host.era.commit(...args);
    },
    sync: (...args: Parameters<EraFacade['sync']>) => {
      assertActive();
      return host.era.sync(...args);
    },
    history: {
      atMessage: (id: number) => {
        assertActive();
        return host.era.history.atMessage(id);
      },
    },
  });
  return {
    facade,
    subscriptions,
    get active() {
      return active;
    },
    stop() {
      active = false;
      pending.forEach(reject => reject(new Error('ERA_EXTERNAL_INSTANCE_DISPOSED')));
      pending.clear();
      subscriptions.forEach(stop => stop());
      subscriptions.clear();
    },
  };
}

/** 必须由原生 parser 执行作者内容，避免二次组装破坏脚本顺序与作者节点身份。 */
export function mountExternalFrame(
  container: HTMLElement,
  html: string,
  host: ExternalFrameHost,
  onError: (error: unknown) => void,
) {
  const frame = container.ownerDocument.createElement('iframe');
  frame.title = 'ERA 外置状态栏内容';
  frame.style.cssText = 'display:block;width:100%;border:0;height:0;visibility:hidden';
  container.append(frame);
  const target = frame.contentWindow;
  if (!target) {
    frame.remove();
    throw new Error('无法创建外置状态栏 iframe');
  }
  const doc = target.document;
  doc.open();
  const session = createExternalFacade(host);
  const { facade, subscriptions } = session;
  Object.assign(target, {
    ERA: facade,
    TavernHelper: Object.freeze(
      Object.fromEntries(Object.entries(host.helper).filter(([key]) => !key.startsWith('_'))),
    ),
    SillyTavern: Object.freeze({ getContext: host.getContext }),
  });
  /** 原生 iframe 导航和销毁同样释放阶段等待，不依赖刷新按钮。 */
  const closed = () => session.stop();
  target.addEventListener('pagehide', closed, { once: true });
  target.addEventListener('error', onError);
  const rejection = (event: PromiseRejectionEvent) => onError(event.reason);
  target.addEventListener('unhandledrejection', rejection);
  let observer: ResizeObserver | undefined;
  const ready = () => {
    if (!session.active) return;
    const update = bindExternalMacros(doc, facade.get);
    const publish = () => {
      update();
      if (host.era.get().status === 'ready') frame.style.visibility = 'visible';
    };
    publish();
    subscriptions.add(host.era.subscribe(publish));
    const resize = () => {
      const viewport =
        container.ownerDocument.defaultView?.visualViewport?.height ??
        container.ownerDocument.documentElement.clientHeight;
      frame.style.height = `${Math.min(Math.max(doc.body.scrollHeight, 24), viewport * 0.3)}px`;
    };
    observer = new ResizeObserver(resize);
    observer.observe(doc.body);
    resize();
    const viewport = container.ownerDocument.defaultView;
    viewport?.addEventListener('resize', resize);
    viewport?.visualViewport?.addEventListener('resize', resize);
    subscriptions.add(() => {
      viewport?.removeEventListener('resize', resize);
      viewport?.visualViewport?.removeEventListener('resize', resize);
    });
  };
  doc.addEventListener('DOMContentLoaded', ready, { once: true });
  // 先把 ERA 宏变为惰性标记，避免宿主替换把变量内容拼成 HTML。
  // 结构化脚本数据使用 API；显示更新只更新已有绑定，不重新执行脚本。
  const content = host.macros(html.replace(createEraMacroRegex(), source => createEraLazyMacroToken(source)));
  doc.write(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;box-sizing:border-box;overflow:auto}</style>${content}`,
  );
  doc.close();
  return {
    frame,
    stop() {
      session.stop();
      observer?.disconnect();
      frame.remove();
    },
  };
}
