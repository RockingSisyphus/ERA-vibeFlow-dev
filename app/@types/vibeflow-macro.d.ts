declare module '@era/vibeflow-macro' {
  // 与 AOT 生成声明逐字同步；保留生成布局供现有合同检查读取。
  // prettier-ignore
  export interface WorkflowInputs {
    readonly "substring": string;
    readonly "storedStat": { readonly "kind": "present"; readonly "value": unknown } | { readonly "kind": "missing" } | { readonly "kind": "view"; readonly "mode": "raw" | "lazy" | "prompt"; readonly "statWithMeta": unknown; readonly "statWithoutMeta": unknown } | { readonly "kind": "projection-only" };
  }

  export interface WorkflowOutputs {
    readonly replacement: string;
  }

  export function runWorkflow(inputs: WorkflowInputs): WorkflowOutputs;
}
