import { createExternalDraftStore } from '../service/external-statusbar-drafts';
import { saveExternalStatusbar } from '../service/external-statusbar-configuration';

/** 角色切换后保留失败草稿；写入仍串行通过 Service 的角色卡提交能力。 */
export const externalDrafts = createExternalDraftStore((characterId, html) =>
  saveExternalStatusbar(characterId, { html }),
);
