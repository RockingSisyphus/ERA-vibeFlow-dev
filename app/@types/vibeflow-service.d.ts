declare module '@era/vibeflow-service' {
  export type VibeFlowAbortSignal = AbortSignal;

  export type WorkflowInputs = Record<string, never>;
  export type WorkflowOutputs = Record<string, never>;
  export interface WorkflowRunOptions {
    readonly signal?: VibeFlowAbortSignal;
    readonly trace?: 'off' | 'boundary' | 'full';
    readonly onTrace?: (event: Readonly<Record<string, unknown>>) => void;
  }
  export interface WorkflowHost {
    readonly signal: VibeFlowAbortSignal;
    readonly started: boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    runWorkflowAsync(inputs: WorkflowInputs, options?: WorkflowRunOptions): Promise<WorkflowOutputs>;
  }
  export function createWorkflowHost(): WorkflowHost;
}
