import {
  cloneSyncJson,
  errorMessage,
  isCancellation,
  observeWrite,
  syncFailure,
  verifyCommittedVariables,
  type SyncCommitRequestV1,
  type SyncCommitResultV1,
  type SyncFailureV1,
  type SyncWorkV1,
} from "../../base_lib/sync_transaction.ts";

interface Envelope<T> {
  readonly value: T;
}

type CommitEnvelope =
  | { readonly mode: "non-commit"; readonly work: SyncWorkV1 }
  | { readonly mode: "commit"; readonly request: SyncCommitRequestV1 };

interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      readonly update_content: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
    };
    readonly "era.tavern.variables": {
      readonly commit: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
    };
  };
}

function result(
  request: SyncCommitRequestV1,
  status: "committed" | "failed" | "fatal",
  confirmedMessageWrites: number,
  variablesCommitted: boolean,
  failure: SyncFailureV1 | null,
): SyncCommitResultV1 {
  return {
    ...request,
    status,
    confirmedMessageWrites,
    variablesCommitted,
    failure,
  };
}

function failureFor(error: unknown, code: string): SyncFailureV1 {
  const cancelled = isCancellation(error);
  return syncFailure(
    cancelled ? `${code}_CANCELLED` : code,
    errorMessage(error),
    cancelled ? "cancelled" : "tavern",
  );
}

export async function run(
  inputs: Readonly<{ "era.tavern.commit.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const envelope = inputs["era.tavern.commit.request"].value as CommitEnvelope;
  if (envelope.mode === "non-commit") {
    return {
      sync_commit_result: envelope as unknown as Readonly<Record<string, unknown>>,
    };
  }

  const request = envelope.request;
  let confirmedMessageWrites = 0;
  for (const write of request.messageWrites) {
    let response: unknown;
    try {
      response = await context.capabilities["era.tavern.messages"].update_content({
        messageId: write.messageId,
        content: write.content,
        purpose: "era-sync",
      });
    } catch (error) {
      return {
        sync_commit_result: result(
          request,
          confirmedMessageWrites === 0 ? "failed" : "fatal",
          confirmedMessageWrites,
          false,
          failureFor(error, "ERA_SYNC_MESSAGE_COMMIT_FAILED"),
        ) as unknown as Readonly<Record<string, unknown>>,
      };
    }
    const observation = observeWrite(response);
    if (observation.kind !== "confirmed") {
      const isSafeFailure =
        observation.kind === "not-written" && confirmedMessageWrites === 0;
      return {
        sync_commit_result: result(
          request,
          isSafeFailure ? "failed" : "fatal",
          confirmedMessageWrites,
          false,
          syncFailure(
            isSafeFailure
              ? "ERA_SYNC_MESSAGE_NOT_WRITTEN"
              : "ERA_SYNC_MESSAGE_COMMIT_UNKNOWN",
            observation.message,
            "tavern",
          ),
        ) as unknown as Readonly<Record<string, unknown>>,
      };
    }
    confirmedMessageWrites += 1;
  }

  let variablesResponse: unknown;
  try {
    variablesResponse = await context.capabilities["era.tavern.variables"].commit({
      scope: { type: "chat" },
      stat: cloneSyncJson(request.stat),
      meta: cloneSyncJson(request.meta),
      purpose: "era-sync",
    });
  } catch (error) {
    return {
      sync_commit_result: result(
        request,
        confirmedMessageWrites === 0 ? "failed" : "fatal",
        confirmedMessageWrites,
        false,
        failureFor(error, "ERA_SYNC_VARIABLES_COMMIT_FAILED"),
      ) as unknown as Readonly<Record<string, unknown>>,
    };
  }
  const observation = observeWrite(variablesResponse);
  if (observation.kind !== "confirmed") {
    const isSafeFailure =
      observation.kind === "not-written" && confirmedMessageWrites === 0;
    return {
      sync_commit_result: result(
        request,
        isSafeFailure ? "failed" : "fatal",
        confirmedMessageWrites,
        false,
        syncFailure(
          isSafeFailure
            ? "ERA_SYNC_VARIABLES_NOT_WRITTEN"
            : "ERA_SYNC_VARIABLES_COMMIT_UNKNOWN",
          observation.message,
          "tavern",
        ),
      ) as unknown as Readonly<Record<string, unknown>>,
    };
  }
  if (!verifyCommittedVariables(variablesResponse, request)) {
    return {
      sync_commit_result: result(
        request,
        "fatal",
        confirmedMessageWrites,
        true,
        syncFailure(
          "ERA_SYNC_VARIABLES_CONFIRM_MISMATCH",
          "变量提交回读与逻辑提交候选不一致。",
          "tavern",
        ),
      ) as unknown as Readonly<Record<string, unknown>>,
    };
  }
  return {
    sync_commit_result: result(
      request,
      "committed",
      confirmedMessageWrites,
      true,
      null,
    ) as unknown as Readonly<Record<string, unknown>>,
  };
}
