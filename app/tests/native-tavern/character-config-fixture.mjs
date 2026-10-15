import { fixture } from './native-fixture.mjs';
/** 只绑定原测试的Tavern数据和展示回调；实际写入经过原生能力。 */
export async function patchCharacter(input, context, host, operation, refresh) {
  const owner = await fixture(undefined, {
    api: {
      ...globalThis,
      location: { origin: 'http://tavern.test' },
      SillyTavern: { ...host, getCurrentChatId: () => SillyTavern.getCurrentChatId() },
    },
    refreshSingleFloor: refresh,
    refreshExternalStatusbar: refresh,
  });
  try {
    return await owner.caps['era.tavern.character'][operation](input, context);
  } catch (error) {
    let cause = error;
    while (cause?.code === 'VF_NODE_FAILED' && cause.cause) cause = cause.cause;
    throw cause;
  } finally {
    owner.page.dispatchEvent(new Event('pagehide'));
    await owner.work;
  }
}
