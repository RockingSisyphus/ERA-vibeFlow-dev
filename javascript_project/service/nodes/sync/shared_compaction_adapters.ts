import {
  compactEachSegment,
  identifySealedLayers,
  updateCompactionMarkers,
  writeSingleScopeSegments,
  applySealedCommandCompactionToWork,
  replayWithServiceEngine,
} from "../../base_lib/sync/command_compaction.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/shared_compaction_adapters.ts。 */
// Adapters with identical declared base libraries share this source.

// Original node: nodes/sync/command_compaction_compact.ts
export function CommandCompactionCompactNode(inputs: any): any {
  return {
    compacted: compactEachSegment(
      inputs["era.command_compaction.partitioned"].value,
    ),
  };
}

// Original node: nodes/sync/command_compaction_identify.ts
export function CommandCompactionIdentifyNode(inputs: any): any {
  return {
    identified: identifySealedLayers(
      inputs["era.expression.command.result"].value,
    ),
  };
}

// Original node: nodes/sync/command_compaction_markers.ts
export function CommandCompactionMarkersNode(inputs: any): any {
  return {
    command_compaction_result: updateCompactionMarkers(
      inputs["era.command_compaction.written"].value,
    ),
  };
}

// Original node: nodes/sync/command_compaction_random_context.ts
/**
 * Preserve identified candidates whose stable MK is consumed by the compaction base-lib as
 * `sourceKey`.  This is an explicit workflow boundary, not a second cursor implementation.
 */
export function CommandCompactionRandomContextNode(inputs: any): any {
  return {
    partitioned_segments: inputs["era.command_compaction.identified"].value,
  };
}

// Original node: nodes/sync/command_compaction_write.ts
export function CommandCompactionWriteNode(inputs: any): any {
  return {
    written: writeSingleScopeSegments(
      inputs["era.command_compaction.replayed"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/command_compaction_apply.ts。 */
/** Keep the full sealed-layer composition in Service and preserve the workflow contract. */
export function CommandCompactionApplyNode(inputs: any): any {
  return {
    command_compaction_result: applySealedCommandCompactionToWork(
      inputs["era.expression.command.result"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/command_compaction_replay.ts。 */
export function CommandCompactionReplayNode(inputs: any): any {
  return {
    replayed: replayWithServiceEngine(
      inputs["era.command_compaction.compacted"].value,
    ),
  };
}
