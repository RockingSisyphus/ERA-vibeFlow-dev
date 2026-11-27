declare module '@era/vibeflow-service' {
  export const workflowDescriptor: Readonly<Record<string, unknown>>;
  export type VibeFlowAbortSignal = AbortSignal;

  export type WorkflowInputs = Readonly<{ host_resources: object }>;
  export type WorkflowOutputs = Record<string, never>;
  export interface WorkflowRunOptions {
    readonly workflowInstanceId?: string;
    readonly workflowSession?: import('../../kernel/javascript/workflow_contracts').WorkflowSession;
    readonly signal?: VibeFlowAbortSignal;
    readonly trace?: 'off' | 'boundary' | 'full';
    readonly onTrace?: (event: Readonly<Record<string, unknown>>) => void;
  }
}

declare module '@era/vibeflow-service' {
  export function runWorkflowAsync(
    inputs: WorkflowInputs,
    options?: WorkflowRunOptions,
  ): Promise<WorkflowOutputs>;
}
