declare module '@era/vibeflow-tavern' {
  export interface WorkflowPacket {
    readonly encoding: 'era-values-v1';
    readonly payload: string;
  }
  export interface NativeWorkflowDescriptor {
    readonly workflow: Readonly<{ root: string; path: string }>;
    readonly entry_mode: 'sync' | 'async';
    readonly entries: Readonly<Record<string, unknown>>;
    readonly default_entry: string;
    readonly calls: readonly unknown[];
  }
  export interface NativeRunOptions {
    readonly workflowInstanceId?: string;
    readonly workflowSession?: import('../../kernel/javascript/workflow_contracts').WorkflowSession;
    readonly signal?: AbortSignal;
    readonly trace?: 'off' | 'boundary' | 'full';
    readonly onTrace?: (event: Readonly<Record<string, unknown>>) => void;
  }
  /** 输入提供实际descriptor和runner模块；同页资源及官方协调作用域随运行结束释放。 */
  export function runEra(
    entries: Readonly<Record<string, unknown>>,
    options?: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<{ status: string }>>;
}
declare module '@era/vibeflow-tavern-sync' {
  export const workflowDescriptor: import('@era/vibeflow-tavern').NativeWorkflowDescriptor;
  export function runWorkflow(
    inputs: Readonly<{ request: unknown }>,
    options?: import('@era/vibeflow-tavern').NativeRunOptions & { readonly entry?: 'main' },
  ): Readonly<{ result: unknown }>;
  export function runWorkflow(
    inputs: Readonly<{ wire_request: import('@era/vibeflow-tavern').WorkflowPacket; host_resources: object }>,
    options: import('@era/vibeflow-tavern').NativeRunOptions & { readonly entry: 'protocol' },
  ): Readonly<{ wireResponse: import('@era/vibeflow-tavern').WorkflowPacket }>;
}
declare module '@era/vibeflow-tavern-operation' {
  export const workflowDescriptor: import('@era/vibeflow-tavern').NativeWorkflowDescriptor;
  export function runWorkflowAsync(
    inputs: Readonly<{ request: unknown }>,
    options: import('@era/vibeflow-tavern').NativeRunOptions & { readonly entry: 'operation' },
  ): Promise<Readonly<{ result: unknown }>>;
  export function runWorkflowAsync(
    inputs: Readonly<{ wire_request: import('@era/vibeflow-tavern').WorkflowPacket; host_resources: object }>,
    options: import('@era/vibeflow-tavern').NativeRunOptions & {
      readonly entry: 'protocol_operation';
    },
  ): Promise<Readonly<{ wireResponse: import('@era/vibeflow-tavern').WorkflowPacket }>>;
}
declare module '@era/vibeflow-tavern-runtime' {
  export const workflowDescriptor: import('@era/vibeflow-tavern').NativeWorkflowDescriptor;
  export function runWorkflowAsync(
    inputs: Readonly<{ request: unknown; host_resources: object }>,
    options: import('@era/vibeflow-tavern').NativeRunOptions & { readonly entry: 'runtime' },
  ): Promise<Readonly<{ result: unknown }>>;
  export function runWorkflowAsync(
    inputs: Readonly<{ wire_request: import('@era/vibeflow-tavern').WorkflowPacket; host_resources: object }>,
    options: import('@era/vibeflow-tavern').NativeRunOptions & {
      readonly entry: 'protocol_runtime';
    },
  ): Promise<Readonly<{ wireResponse: import('@era/vibeflow-tavern').WorkflowPacket }>>;
}
declare module '@era/vibeflow-tavern-parallel-reads' {
  export const workflowDescriptor: import('@era/vibeflow-tavern').NativeWorkflowDescriptor;
  export function runWorkflowAsync(
    inputs: Readonly<{ wire_request: import('@era/vibeflow-tavern').WorkflowPacket; host_resources: object }>,
    options: import('@era/vibeflow-tavern').NativeRunOptions & {
      readonly entry: 'protocol_parallel_reads';
    },
  ): Promise<Readonly<{ wireResponse: import('@era/vibeflow-tavern').WorkflowPacket }>>;
}
