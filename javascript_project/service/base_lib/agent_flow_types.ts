import type { StageHandoff, stageHandoff } from "./agent_stage_handoff.ts";
import type { PlannedStepV1 } from "./service_types.ts";
import type { EraAgentConfigurationV2 } from "./agent_generation_session.ts";
import type {
  EraAgentFloorCandidateV1,
  EraFloorIdentityV1,
} from "@era/vibeflow-contracts";
export interface AgentDiagnostic {
  readonly code: string;
  readonly message: string;
}
export interface AgentOutcome {
  readonly appliedScopeWindow?: Readonly<Record<string, unknown>>;
  readonly appliedFloor?: EraFloorIdentityV1;
  readonly handoff?: StageHandoff;
  readonly stageBoundary?: Parameters<typeof stageHandoff>[0];
  readonly mode: "legacy" | "legacy-ignore" | "execute-legacy" | "execute-only";
  readonly status: "committed" | "no-op" | "failed";
  readonly diagnostics: readonly AgentDiagnostic[];
  readonly value?: unknown;
  readonly candidate?: EraAgentFloorCandidateV1;
}
export interface SettingsRequest {
  readonly command: unknown;
  readonly arguments: readonly unknown[];
  readonly context: {
    readonly configuration: unknown;
    readonly identity: unknown;
    readonly session: unknown;
  } | null;
}
export interface GenerationTrigger {
  readonly eventId: string;
  readonly sequence: number;
  readonly cycleIdentity: unknown;
  readonly type: string;
  readonly kind: string;
  readonly dryRun: boolean;
  readonly retry: unknown;
}
export interface GenerationContext extends Readonly<Record<string, unknown>> {
  readonly identity: unknown;
  readonly state: unknown;
  readonly messages: unknown;
  readonly latestMessage: unknown;
  readonly session: unknown;
}
export interface GenerationFacts {
  readonly contextUnavailable: boolean;
  readonly trigger: GenerationTrigger;
  readonly context: GenerationContext | null;
  readonly configuration: EraAgentConfigurationV2;
  readonly diagnostics: readonly AgentDiagnostic[];
  readonly identity: EraFloorIdentityV1 | null;
  readonly identityError: AgentDiagnostic | null;
}
export interface GenerationDecision extends GenerationFacts {
  readonly phase:
    "planning" | "story" | "retry" | "resume" | "cancel" | "finish";
  readonly disposition?: AgentOutcome;
}
export interface GenerationRequest {
  readonly phase: GenerationDecision["phase"];
  readonly trigger: GenerationTrigger;
  readonly configuration: EraAgentConfigurationV2;
  readonly context: GenerationContext | null;
  readonly identity: EraFloorIdentityV1 | null;
  readonly identityError: AgentDiagnostic | null;
  readonly disposition?: AgentOutcome;
}
export interface AgentTransition extends AgentOutcome {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
}
