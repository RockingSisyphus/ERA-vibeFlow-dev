/** 同一次同步写入中，根据宿主事实决定会话字段及观察/等待意图。 */
export interface SessionBindingFacts {
  readonly active: boolean;
  readonly previous: Readonly<Record<string, unknown>> | null;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function planSessionBinding(
  value: unknown,
  opening: boolean,
  facts: SessionBindingFacts,
) {
  if (!record(value))
    return {
      session: value ?? null,
      startStoryObservation: false,
      nativeExecutionId: null,
    };
  let session = value;
  const startStoryObservation = opening && value.status === "opened";
  const previous = facts.previous;
  if (
    !startStoryObservation &&
    typeof value.storyRequestId !== "string" &&
    previous &&
    typeof previous.storyRequestId === "string"
  ) {
    session = { ...session, storyRequestId: previous.storyRequestId };
  }
  let nativeExecutionId: string | null = null;
  if (opening) {
    if (
      facts.active &&
      record(session.execution) &&
      typeof session.execution.id === "string"
    )
      nativeExecutionId = session.execution.id;
    session = { ...session, nativeGeneration: facts.active };
  } else {
    const sameExecution =
      previous &&
      record(previous.execution) &&
      record(session.execution) &&
      previous.execution.id === session.execution.id;
    if (sameExecution && typeof previous.nativeGeneration === "boolean")
      session = { ...session, nativeGeneration: previous.nativeGeneration };
  }
  return { session, startStoryObservation, nativeExecutionId };
}

/** 历次尝试属于有界观察仓库；等待后续阶段也只保留重试身份及必要业务上下文。 */
export function compactSessionStorage(value: unknown): unknown {
  if (!record(value)) return value;
  const terminal =
    !value.pendingStage &&
    ["settled", "unsettled", "story-complete"].includes(String(value.status));
  const fields = ["planningAttempts", "settlementAttempts"];
  if (!terminal && !fields.some((field) => Array.isArray(value[field])))
    return value;
  const stored = { ...value };
  if (terminal) delete stored.preState;
  for (const field of fields) {
    if (Array.isArray(stored[field]))
      stored[field] = stored[field].map((attempt: unknown) =>
        record(attempt)
          ? {
              ...(typeof attempt.requestId === "string"
                ? { requestId: attempt.requestId }
                : {}),
              ...(typeof attempt.status === "string"
                ? { status: attempt.status }
                : {}),
            }
          : {},
      );
  }
  return stored;
}
