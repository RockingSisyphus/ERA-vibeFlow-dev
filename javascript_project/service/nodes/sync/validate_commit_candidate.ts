import { validateSyncCommitEnvelope } from "../../base_lib/sync_commit_policy.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.tavern.commit.request": Envelope<unknown> }>
): any {
  const candidate = inputs["era.tavern.commit.request"].value;
  const validated = validateSyncCommitEnvelope(candidate);
  return validated.route === "valid"
    ? {
        commit_validation_route: "valid",
        validated_commit_request: validated.envelope,
        sync_contract_failure: null
      }
    : {
        commit_validation_route: "failed",
        validated_commit_request: candidate,
        sync_contract_failure: validated.failure
      };
}
