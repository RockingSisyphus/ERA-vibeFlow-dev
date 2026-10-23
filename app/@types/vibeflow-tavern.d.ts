declare module '@era/vibeflow-tavern' {
  /** 参数接线由登记的bindings声明生成；运行与清理由原生workflow拥有。 */
  export function runEra(
    entries: Readonly<Record<string, unknown>>,
    options?: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<{ status: string }>>;
}
declare module '@era/vibeflow-tavern-sync' {
  export function runWorkflow(inputs: Readonly<{ request: unknown }>): Readonly<{ result: unknown }>;
}
declare module '@era/vibeflow-tavern-async' {
  export function runWorkflowAsync(
    inputs: Readonly<{ request: unknown }>,
    options: Readonly<{ entry: 'operation' | 'runtime'; signal?: AbortSignal }>,
  ): Promise<Readonly<{ result: unknown }>>;
}
