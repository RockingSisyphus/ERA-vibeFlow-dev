declare module '@era/vibeflow-macro' {
  export interface WorkflowInputs {
    readonly substring: string;
    readonly storedStat: { readonly kind: 'present'; readonly value: unknown } | { readonly kind: 'missing' };
  }

  export interface WorkflowOutputs {
    readonly replacement: string;
  }

  export function runWorkflow(inputs: WorkflowInputs): WorkflowOutputs;
}
