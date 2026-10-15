/** 测试夹具只准备实例内订阅输入，遍历、等待、取消均执行真实 AOT Nodeset。 */
import { fixture, sync, asyncEntry, deferred } from './native-fixture.mjs';
export async function subscriptionRegistry(onError) {
  const owner = await fixture(undefined, {
    log: { error: (_message, error) => onError(error) },
    api: { toastr: { error: () => {} } },
  });
  const session = owner.session,
    releases = [];
  const control = (operation, input = {}) =>
    sync({ request: { session, action: 'subscription_control', operation, input } }).result.result;
  return {
    subscribe: (listener, options) => control('register', { listener, options }),
    cancel: () => control('cancel'),
    clear: () => control('cancel', { clear: true }),
    publish: async completion => {
      const cycle = {
        owner: session,
        controller: new AbortController(),
        items: [...session.subscriptions],
        completion,
      };
      session.subscriptionCycles.add(cycle);
      return (await asyncEntry({ request: { session, action: 'subscription_publish', subscriptionCycle: cycle } }))
        .result.result;
    },
    hold: () => {
      const d = deferred();
      releases.push(d.resolve);
      return d.promise;
    },
    dispose: async () => {
      for (const release of releases) release();
      owner.page.dispatchEvent(new Event('pagehide'));
      await owner.work;
    },
  };
}
