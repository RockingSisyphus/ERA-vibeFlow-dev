import { type StageHandoff, type stageHandoff } from "./agent_stage_handoff.ts";
import { type PlannedStepV1 } from "../service_types.ts";
import { type EraAgentConfigurationV2 } from "./agent_configuration.ts";
import {
  type EraAgentFloorCandidateV1,
  type EraFloorIdentityV1,
} from "@era/vibeflow-contracts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：base_lib/agent/agent_flow_types.ts。 */
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

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：base_lib/agent/agent_call_table.ts。 */
export interface EraAgentExecutedCallV1 {
  readonly index: number;
  readonly function: string;
  readonly args: readonly number[];
  readonly result: number;
  readonly drawOffsetStart: number;
  readonly drawOffsetEnd: number;
}
export class AgentFunctionCallFailure extends TypeError {
  constructor(
    message: string,
    readonly functionResults: readonly Record<string, unknown>[],
  ) {
    super(message);
  }
}
/** 阶段调用表的只读分类事实；实际求值由共享操作循环执行。 */
export function unknownStageFunction(
  calls: readonly any[],
  library: Record<string, unknown>,
): number {
  const known = new Set([
    ...Object.keys(library),
    "abs",
    "ceil",
    "clamp",
    "cos",
    "exp",
    "floor",
    "log",
    "max",
    "min",
    "pow",
    "random",
    "round",
    "sin",
    "sqrt",
    "tan",
  ]);
  return calls.findIndex((call) => !known.has(call.function));
}
export function failedCallTable(
  calls: readonly any[],
  completed: readonly any[],
  failedIndex: number,
  diagnostic: string,
): any[] {
  return calls.map((call, index) => {
    const executed = completed.find((result) => result.index === index);
    return executed
      ? {
          ...executed,
          ...(call.purpose !== undefined ? { purpose: call.purpose } : {}),
          status: "passed",
        }
      : {
          index,
          function: call.function,
          args: [...call.args],
          ...(call.purpose !== undefined ? { purpose: call.purpose } : {}),
          status: index === failedIndex ? "failed" : "not-executed",
          ...(index === failedIndex ? { diagnostic } : {}),
        };
  });
}
