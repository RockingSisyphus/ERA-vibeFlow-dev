declare module '@era/vibeflow-service' {
  export type VibeFlowAbortSignal = AbortSignal;

  export type WorkflowInputs = Record<string, never>;
  export type WorkflowOutputs = Record<string, never>;
  export interface WorkflowRunOptions {
    readonly signal?: VibeFlowAbortSignal;
    readonly trace?: 'off' | 'boundary' | 'full';
    readonly onTrace?: (event: Readonly<Record<string, unknown>>) => void;
  }
}

declare module '@era/vibeflow-service' {
  export function runWorkflowAsync(
    inputs: WorkflowInputs,
    options?: WorkflowRunOptions & { readonly capabilities?: Readonly<Record<string, unknown>> },
  ): Promise<WorkflowOutputs>;
}
