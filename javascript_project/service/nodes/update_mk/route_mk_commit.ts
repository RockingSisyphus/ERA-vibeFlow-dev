interface Envelope<T> {
  readonly value: T;
}

interface Candidate {
  readonly schemaVersion: 1;
  readonly step: Readonly<Record<string, unknown>>;
  readonly disposition: "ready" | "failed";
  readonly mk: string | null;
  readonly messageUpdate: Readonly<{
    messageId: number;
    content: string;
  }> | null;
  readonly metaUpdate: Readonly<Record<string, unknown>> | null;
  readonly messageWriteRequired: boolean;
  readonly variableWriteRequired: boolean;
  readonly failure: Readonly<Record<string, unknown>> | null;
}

export function run<T extends Candidate>(
  inputs: Readonly<{ "era.mk.candidate": Envelope<T> }>,
): any {
  const candidate = inputs["era.mk.candidate"].value;
  const route: "commit" | "no-op" =
    candidate.disposition === "ready" &&
    (candidate.messageWriteRequired || candidate.variableWriteRequired)
      ? "commit"
      : "no-op";
  return {
    mk_commit_route: route,
    routed_mk_candidate: candidate,
  };
}
