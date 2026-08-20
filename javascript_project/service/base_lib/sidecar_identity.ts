import type { EraTransportEventV1 } from "./service_types.ts";

export type EraSidecarStatusV1 =
  | "matched"
  | "rebind-approved"
  | "conflict"
  | "unbound"
  | "invalid"
  | "not-applicable";

export interface EraSidecarIdentityV1 {
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
  readonly scriptId: string;
}

export interface EraSidecarReportV1 {
  readonly schemaVersion: "1";
  readonly status: EraSidecarStatusV1;
  readonly currentIdentity: EraSidecarIdentityV1 | null;
  readonly markerOwner: EraSidecarIdentityV1 | null;
  readonly reason: string;
  readonly event: Readonly<{ readonly type: string; readonly sequence: number }>;
}

interface SidecarMarkerV1 {
  readonly schemaVersion: 1;
  readonly portable: boolean;
  readonly owner: EraSidecarIdentityV1;
}

interface SidecarFixtureV1 {
  readonly schemaVersion: "1";
  readonly enabled: true;
  readonly retiredOwnerKeys: readonly string[];
}

interface SidecarContextV1 {
  readonly identity?: unknown;
  readonly marker?: unknown;
  readonly fixture?: unknown;
  readonly technicalError?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function identity(value: unknown): EraSidecarIdentityV1 | null {
  if (!isRecord(value)) return null;
  if (
    !nullableString(value.characterId) ||
    !nullableString(value.groupId) ||
    typeof value.chatId !== "string" ||
    value.chatId.length === 0 ||
    typeof value.scriptId !== "string" ||
    value.scriptId.length === 0
  ) {
    return null;
  }
  return {
    characterId: value.characterId,
    groupId: value.groupId,
    chatId: value.chatId,
    scriptId: value.scriptId,
  };
}

function marker(value: unknown): SidecarMarkerV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.portable !== "boolean") {
    return null;
  }
  const owner = identity(value.owner);
  return owner === null ? null : { schemaVersion: 1, portable: value.portable, owner };
}

function fixture(value: unknown): SidecarFixtureV1 | null {
  if (!isRecord(value) || value.schemaVersion !== "1" || value.enabled !== true || !Array.isArray(value.retiredOwnerKeys)) {
    return null;
  }
  if (value.retiredOwnerKeys.length > 64 || !value.retiredOwnerKeys.every((item) => typeof item === "string" && item.length > 0)) {
    return null;
  }
  return {
    schemaVersion: "1",
    enabled: true,
    retiredOwnerKeys: [...value.retiredOwnerKeys],
  };
}

export function sidecarOwnerKey(value: EraSidecarIdentityV1): string {
  const scope = value.groupId !== null ? `group:${value.groupId}` : `character:${value.characterId ?? ""}`;
  return `${scope}|chat:${value.chatId}|script:${value.scriptId}`;
}

function sameIdentity(left: EraSidecarIdentityV1, right: EraSidecarIdentityV1): boolean {
  return (
    left.characterId === right.characterId &&
    left.groupId === right.groupId &&
    left.chatId === right.chatId &&
    left.scriptId === right.scriptId
  );
}

function sameOwnerScope(left: EraSidecarIdentityV1, right: EraSidecarIdentityV1): boolean {
  return left.characterId === right.characterId && left.groupId === right.groupId;
}

function report(
  status: EraSidecarStatusV1,
  currentIdentity: EraSidecarIdentityV1 | null,
  markerOwner: EraSidecarIdentityV1 | null,
  reason: string,
  event: EraTransportEventV1,
): EraSidecarReportV1 {
  return {
    schemaVersion: "1",
    status,
    currentIdentity,
    markerOwner,
    reason,
    event: { type: event.type, sequence: event.sequence },
  };
}

/**
 * Pure Sidecar test classifier. It neither persists a binding nor mutates Tavern
 * state: a future persistence feature may consume this decision separately.
 */
export function observeSidecarTestIdentity(
  context: unknown,
  event: EraTransportEventV1,
): EraSidecarReportV1 | null {
  /*
   * app_ready is emitted before the plugin's asynchronous service Host has
   * finished subscribing.  A later, already-listened generation_started is
   * therefore the first reliable real Host event after a page reload.  This
   * remains a read-only test probe: without the session fixture it returns
   * before identity or chat variables are read.
   */
  if (
    event.type !== "app_ready" &&
    event.type !== "chat_id_changed" &&
    event.type !== "generation_started"
  ) {
    return null;
  }
  const raw = isRecord(context) ? (context as SidecarContextV1) : {};
  const configured = fixture(raw.fixture);
  if (configured === null) return null;

  if (raw.technicalError === true) {
    return report("invalid", null, null, "technical-context-read-failed", event);
  }

  const current = identity(raw.identity);
  if (current === null) return report("invalid", null, null, "current-identity-invalid", event);
  if (raw.marker === undefined || raw.marker === null) {
    return report("not-applicable", current, null, "marker-absent", event);
  }
  const parsedMarker = marker(raw.marker);
  if (parsedMarker === null) return report("invalid", current, null, "marker-invalid", event);
  if (sameIdentity(current, parsedMarker.owner)) {
    return report("matched", current, parsedMarker.owner, "exact-owner-match", event);
  }
  if (sameOwnerScope(current, parsedMarker.owner)) {
    return report("unbound", current, parsedMarker.owner, "owner-chat-or-script-mismatch", event);
  }
  if (parsedMarker.portable && configured.retiredOwnerKeys.includes(sidecarOwnerKey(parsedMarker.owner))) {
    return report("rebind-approved", current, parsedMarker.owner, "portable-marker-owner-retired", event);
  }
  return report("conflict", current, parsedMarker.owner, "marker-owner-still-active", event);
}
