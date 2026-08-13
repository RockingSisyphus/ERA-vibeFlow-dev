export function createMountPoint(): JQuery<HTMLDivElement> {
  return $('<div>').attr('id', `era-ui-mount-point-${getScriptId()}`).css({
    position: 'fixed',
    inset: 0,
    width: '100svw',
    height: '100svh',
    'z-index': 2147483647,
    'pointer-events': 'none',
  }) as JQuery<HTMLDivElement>;
}

export function destroyMountPoint(): void {
  $(`div#era-ui-mount-point-${getScriptId()}`).remove();
}

export function teleportStyle(): void {
  const scriptId = getScriptId();
  // 先移除旧的，确保样式是最新的
  $(`head > div[script_id="${scriptId}"]`).remove();

  const $div = $('<div>').attr('script_id', scriptId).append($(document).find('head > style').clone());
  $('head').append($div);
}

export function deteleportStyle(): void {
  $(`head > div[script_id="${getScriptId()}"]`).remove();
}
