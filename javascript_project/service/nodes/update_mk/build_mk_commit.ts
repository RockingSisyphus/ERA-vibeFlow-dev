import type { PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Candidate {
  readonly step: PlannedStepV1;
  readonly disposition: "ready" | "failed";
  readonly mk: string | null;
  readonly messageUpdate: null | {
    readonly messageId: number;
    readonly content: string;
  };
  readonly metaUpdate: Readonly<Record<string, unknown>> | null;
  readonly messageWriteRequired: boolean;
  readonly variableWriteRequired: boolean;
}

export function run(
  inputs: Readonly<{ "era.mk.candidate.routed": Envelope<unknown> }>,
): any {
  const candidate = inputs["era.mk.candidate.routed"].value as Candidate;
  if (
    candidate.disposition !== "ready" ||
    candidate.mk === null ||
    candidate.metaUpdate === null ||
    (!candidate.messageWriteRequired && !candidate.variableWriteRequired)
  ) {
    throw new TypeError("MK 提交分支收到不可提交候选。 ");
  }
  if (candidate.messageWriteRequired && candidate.messageUpdate === null) {
    throw new TypeError("MK 消息写入缺少明确文本请求。");
  }
  return {
    mk_commit_request: {
      schemaVersion: 1,
      step: candidate.step,
      mk: candidate.mk,
      messageUpdate: candidate.messageUpdate,
      metaUpdate: candidate.metaUpdate,
      messageWriteRequired: candidate.messageWriteRequired,
      variableWriteRequired: candidate.variableWriteRequired,
    },
  };
}
