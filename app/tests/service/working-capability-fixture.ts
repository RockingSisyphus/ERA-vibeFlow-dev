/** Mechanical test double for the page-local store; starts without a loaded chat. */
export function workingCapabilityFixture() {
  let working: any = null;
  return {
    read_working: () => ({ working: structuredClone(working) }),
    write_working: (input: Readonly<Record<string, unknown>>) => {
      if (input.expectedVersion !== undefined && input.expectedVersion !== (working?.version ?? 0)) {
        throw new Error('ERA_WORKING_STATE_CHANGED');
      }
      working = { ...structuredClone(input), version: (working?.version ?? 0) + 1 };
      return { working: structuredClone(working) };
    },
  };
}
