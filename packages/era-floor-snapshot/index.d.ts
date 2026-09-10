// Generated from Service base_lib/domain/floor_snapshot.ts; do not edit.
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
