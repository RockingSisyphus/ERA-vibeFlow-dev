import { inspectSidecar, variablesForState } from "../../base_lib/sidecar_binding.ts";

interface Envelope<T> {
  readonly value: T;
}

type Context = any;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function eventTypeOf(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return "unknown";
  const task = (value as Readonly<Record<string, unknown>>).task;
  if (task === null || typeof task !== "object" || Array.isArray(task))
    return "unknown";
  return String(
    (task as Readonly<Record<string, unknown>>).eventType ?? "unknown",
  );
}

export async function run(
  inputs: Readonly<{ "era.api.query.request": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  try {
    const current = await context.capabilities["era.tavern.sidecar"].read_current({});
    const meta = current !== null && typeof current === "object" ? (current as Record<string, unknown>).meta : null;
    const sidecarId = meta !== null && typeof meta === "object" ? (meta as Record<string, unknown>).SidecarId : null;
    if (typeof sidecarId !== "string") throw new TypeError("ERA 当前聊天没有已加载的 SidecarId。");
    const stored = await context.capabilities["era.tavern.sidecar"].read_record({ sidecarId });
    const facts = inspectSidecar(current, stored);
    if (facts.record === null || facts.status !== "matched") throw new TypeError("ERA Sidecar 状态不可用。");
    const value = { variables: variablesForState(facts.record.state, facts.record.sidecarId) };
    return { query_variables_raw: { ok: true, value } };
  } catch (error) {
    return {
      query_variables_raw: {
        ok: false,
        error: {
          code: "ERA_QUERY_VARIABLES_READ_FAILED",
          message: errorMessage(error),
        },
        requestEventType: eventTypeOf(inputs["era.api.query.request"].value),
      },
    };
  }
}
