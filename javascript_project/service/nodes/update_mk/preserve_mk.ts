import type { PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: "input" | "domain" | "tavern" | "cancelled";
  readonly retryable: false;
}

interface Candidate {
  readonly step: PlannedStepV1;
  readonly disposition: "ready" | "failed";
  readonly mk: string | null;
  readonly failure: MkFailure | null;
}

export function run(
  inputs: Readonly<{ "era.mk.candidate.routed": Envelope<unknown> }>,
): any {
  const candidate = inputs["era.mk.candidate.routed"].value as Candidate;
  return {
    mk_noop_outcome: {
      schemaVersion: 1,
      step: candidate.step,
      status: candidate.disposition === "failed" ? "failed" : "no-op",
      mk: candidate.mk,
      messageChanged: false,
      variablesChanged: false,
      failure: candidate.failure,
    },
  };
}
