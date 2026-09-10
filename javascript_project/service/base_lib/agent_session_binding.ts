/** 同一次同步写入中，根据宿主事实决定会话字段及观察/等待意图。 */
export interface SessionBindingFacts {
  readonly active: boolean;
  readonly previous: Readonly<Record<string, unknown>> | null;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function planSessionBinding(value: unknown, opening: boolean, facts: SessionBindingFacts) {
  if (!record(value)) return { session: value ?? null, startStoryObservation: false, nativeExecutionId: null };
  let session = value;
  const startStoryObservation = value.status === "opened";
  const previous = facts.previous;
  if (!startStoryObservation && typeof value.storyRequestId !== "string" && previous && typeof previous.storyRequestId === "string") {
    session = { ...session, storyRequestId: previous.storyRequestId };
  }
  let nativeExecutionId: string | null = null;
  if (opening) {
    if (facts.active && record(session.execution) && typeof session.execution.id === "string") nativeExecutionId = session.execution.id;
    session = { ...session, nativeGeneration: facts.active };
  } else {
    const sameExecution = previous && record(previous.execution) && record(session.execution) && previous.execution.id === session.execution.id;
    if (sameExecution && typeof previous.nativeGeneration === "boolean") session = { ...session, nativeGeneration: previous.nativeGeneration };
  }
  return { session, startStoryObservation, nativeExecutionId };
}
