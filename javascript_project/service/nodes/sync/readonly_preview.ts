import {
  selectPreviewPosition,
  previewOperations,
  acceptPreviewOperations,
  advancePreviewPosition,
} from "../../base_lib/sync/readonly_preview.ts";
export function selectPosition(inputs: any) {
  const position = selectPreviewPosition(
    inputs["era.sync.preview.state"].value,
  );
  return {
    position: { ...position },
    route:
      position.route === "command"
        ? ("command" as const)
        : ("advance" as const),
  };
}
export function prepareOperations(inputs: any) {
  return {
    operations: {
      ...previewOperations(inputs["era.sync.preview.state"].value),
    },
  };
}
export function acceptOperations(inputs: any) {
  const state = acceptPreviewOperations(
    inputs["era.sync.preview.state"].value,
    inputs["era.command.operation.result"].value,
  );
  return { accepted_state: { ...state }, accepted_done: state.done };
}
export function advancePosition(inputs: any) {
  const state = advancePreviewPosition(inputs["era.sync.preview.state"].value);
  return { advanced_state: { ...state }, advanced_done: state.done };
}
