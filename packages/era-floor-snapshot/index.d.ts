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

export function projectFloorSnapshot(
  input: EraFloorProjectionInput & { readonly messageId: number },
): EraFloorSnapshot;

export function projectFloorSnapshots(
  input: EraFloorProjectionInput & { readonly messageIds: readonly number[] },
): readonly EraFloorSnapshot[];
