/**
 * Preserve partitioned candidates whose stable MK is consumed by the compaction base-lib as
 * `sourceKey`.  This is an explicit workflow boundary, not a second cursor implementation.
 */
export function run(inputs: any): any {
  return {
    partitioned_segments:
      inputs["era.command_compaction.partitioned"].value,
  };
}
