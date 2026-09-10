// Generated from Service base_lib/domain; do not edit.
export type { EraDataTransformDirection } from './data_view.js';
export { selectedMks, transformEraData, removeMetaFields } from './data_view.js';
export { projectPublicState } from './public_state.js';
export interface EraFloorSnapshot {
    readonly messageId: number;
    readonly mk: string;
    readonly stat: unknown;
    readonly statFunc: Readonly<Record<string, unknown>>;
}
export interface EraFloorProjectionInput {
    readonly stat: unknown;
    readonly statFunc: Readonly<Record<string, unknown>>;
    readonly meta: Readonly<Record<string, unknown>>;
}
export declare function projectFloorSnapshot(input: EraFloorProjectionInput & {
    readonly messageId: number;
}): EraFloorSnapshot;
export declare function projectFloorSnapshots(input: EraFloorProjectionInput & {
    readonly messageIds: readonly number[];
}): readonly EraFloorSnapshot[];
