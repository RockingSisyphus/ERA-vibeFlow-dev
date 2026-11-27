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
  // vue-style-loader 为本 bundle 的 Vue 样式写入 data-vue-ssr-id。仅将这些
  // script iframe 内由 ERA 生成的样式内容放入自己持有的宿主 style；绝不枚举、
  // 复制或删除 Tavern/其他插件的样式节点。
  const hostHead = $('head');
  const eraStyles = $(document).find('head > style[data-vue-ssr-id]');
  // 面板与外置状态栏共享同一份本实例样式；后挂载者只更新内容，
  // 不替换先挂载者持有的节点，也不使其他实例的所有权观察发生变化。
  let ownedStyle = $(`head > style[data-era-ui-owner="${scriptId}"]`);
  if (ownedStyle.length === 0) {
    ownedStyle = $('<style>').attr('data-era-ui-owner', scriptId);
    hostHead.append(ownedStyle);
  }
  ownedStyle.text(
    eraStyles
      .toArray()
      .map(style => style.textContent)
      .join('\n'),
  );
}

export function deteleportStyle(): void {
  $(`head > style[data-era-ui-owner="${getScriptId()}"]`).remove();
  $(`head > div[script_id="${getScriptId()}"]`).remove();
}
