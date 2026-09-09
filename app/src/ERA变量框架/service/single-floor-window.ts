/** 为了保留真实楼层身份，只卸载呈现节点，不修改业务数组或重新编号。 */
export function reconcileSingleFloor(
  document: Document,
  messages: readonly { is_user?: boolean; is_system?: boolean }[],
) {
  const messageId = messages.findLastIndex(message => !message.is_user && !message.is_system);
  let removed = false;
  for (const element of document.querySelectorAll('#chat > .mes')) {
    if (Number(element.getAttribute('mesid')) !== messageId) {
      element.remove();
      removed = true;
    }
  }
  return { messageId, removed, mounted: !!document.querySelector(`#chat > .mes[mesid="${messageId}"]`) };
}
