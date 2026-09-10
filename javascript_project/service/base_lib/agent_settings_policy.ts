import { normalizeAgentConfiguration } from "./agent_generation_session.ts";
type MutableAgentProfile = {
  preset: unknown;
  modelSource: {
    kind: "tavern-current" | "custom-profile";
    profileId?: string;
    profileNameHint?: string;
    model?: string;
  };
};

type MutableAgentConfiguration = {
  schemaVersion: "2";
  planning: {
    enabled: boolean;
    retryCount: number;
    attempts: MutableAgentProfile[];
  };
  settlement: {
    enabled: boolean;
    retryCount: number;
    attempts: MutableAgentProfile[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function configurationWithPendingConnections(
  value: unknown,
): MutableAgentConfiguration {
  const configuration = structuredClone(
    normalizeAgentConfiguration(value),
  ) as MutableAgentConfiguration;
  if (!isRecord(value)) return configuration;

  for (const stageName of ["planning", "settlement"] as const) {
    const rawStage = isRecord(value[stageName]) ? value[stageName] : null;
    const rawAttempts = Array.isArray(rawStage?.attempts)
      ? rawStage.attempts
      : [];
    rawAttempts
      .slice(0, configuration[stageName].attempts.length)
      .forEach((rawAttempt, index) => {
        if (!isRecord(rawAttempt) || !isRecord(rawAttempt.modelSource)) return;
        const rawSource = rawAttempt.modelSource;
        if (rawSource.kind !== "custom-profile") return;
        const profileId =
          typeof rawSource.profileId === "string"
            ? rawSource.profileId.trim().slice(0, 256)
            : "";
        const profileNameHint =
          typeof rawSource.profileNameHint === "string"
            ? rawSource.profileNameHint.trim().slice(0, 256)
            : "";
        const model =
          typeof rawSource.model === "string"
            ? rawSource.model.trim().slice(0, 512)
            : "";
        configuration[stageName].attempts[index]!.modelSource = {
          kind: "custom-profile",
          profileId,
          ...(profileNameHint ? { profileNameHint } : {}),
          ...(model ? { model } : {}),
        };
      });
  }
  return configuration;
}
