import {
  cloneCrudValue,
  parseMessageCommands,
  type EraApplyMessageCommandsInput,
  type EraCrudCommand,
  type EraCrudEditLog,
  type EraFunctionEditLog,
  type EraCrudDiagnostic,
} from "./crud_parser.ts";

export type OperationAction = {
  kind: string;
  path: string;
  patch: any;
  root?: boolean;
  template?: { inheritedContent: unknown; parentPath: string | null };
  localTemplate?: unknown;
  value?: any;
  current?: any;
  name?: string;
  changeKind?: "insert" | "update" | "delete";
  skip?: boolean;
  diagnostic?: EraCrudDiagnostic;
  response?: any;
};
export type FunctionGroup = {
  type: string;
  root: Record<string, unknown>;
  names: string[];
  index: number;
  original: Record<string, unknown>;
  candidate: Record<string, unknown>;
  changes: Array<{
    kind: "insert" | "update" | "delete";
    name: string;
    value?: unknown;
  }>;
};
export type StageCallTable = {
  calls: any[];
  index: number;
  results: any[];
  validationError?: string;
  errorResults?: any[];
};
/** 每次微步骤只改变私有工作副本；消息块结束前不会发布或保存。 */
export type OperationState = {
  mode: "command" | "stage-calls";
  commands: readonly EraCrudCommand[];
  commandIndex: number;
  rootIndex: number;
  stack: OperationAction[];
  stat: any;
  statFunc: Record<string, unknown>;
  messageStartStat: any;
  messageStartStatFunc: Record<string, unknown>;
  randomCursor: { sourceKey: string; drawOffset: number } | null;
  functionGroup: FunctionGroup | null;
  stageCallTable: StageCallTable | null;
  editLog: EraCrudEditLog[];
  functionEditLog: EraFunctionEditLog[];
  diagnostics: EraCrudDiagnostic[];
  done: boolean;
  failure: { message: string } | null;
  context: {
    messageId: number;
    meta: Record<string, any>;
    exposesFunctionState: boolean;
    pendingLog?: EraCrudEditLog;
    localDelete?: { stat: any; parentAction: OperationAction };
  };
  pendingAction: OperationAction | null;
};
export interface ExpressionRequest {
  purpose: "value" | "library" | "stage-call";
  request: any;
  operationState: OperationState;
}
export interface ExpressionResponse {
  purpose: ExpressionRequest["purpose"];
  response: any;
  operationState: OperationState;
}

export function seedCommandOperations(
  input: EraApplyMessageCommandsInput,
): OperationState {
  const all = parseMessageCommands(input);
  const commands =
    input.commandRange === undefined
      ? all
      : all.slice(
          Math.max(0, input.commandRange.fromIndex),
          Math.max(0, input.commandRange.toIndex),
        );
  const library = cloneCrudValue(input.initialStatFunc ?? {}) as Record<
    string,
    unknown
  >;
  return {
    mode: "command",
    commands,
    commandIndex: 0,
    rootIndex: 0,
    stack: [],
    stat: cloneCrudValue(input.initialStat),
    statFunc: library,
    messageStartStat: cloneCrudValue(
      input.messageStartStat ?? input.initialStat,
    ),
    messageStartStatFunc: cloneCrudValue(
      input.messageStartStatFunc ?? input.initialStatFunc ?? {},
    ),
    randomCursor: input.randomSourceKey
      ? {
          sourceKey: input.randomSourceKey,
          drawOffset:
            Number.isSafeInteger(input.randomDrawOffset) &&
            Number(input.randomDrawOffset) > 0
              ? Number(input.randomDrawOffset)
              : 0,
        }
      : null,
    functionGroup: null,
    stageCallTable: null,
    editLog: [],
    functionEditLog: [],
    diagnostics: [],
    done: false,
    failure: null,
    pendingAction: null,
    context: {
      messageId: input.messageId,
      meta: input.meta,
      exposesFunctionState:
        Object.keys(library).length > 0 ||
        commands.some((c) => c.type.startsWith("function-")),
    },
  };
}

/** 分叉只复制可变的微步骤容器；原变量树在实际写入节点中再复制。 */
export function forkOperation(state: OperationState): OperationState {
  return {
    ...state,
    stack: [...state.stack],
    editLog: [...state.editLog],
    functionEditLog: [...state.functionEditLog],
    diagnostics: [...state.diagnostics],
    context: { ...state.context },
    pendingAction: state.pendingAction ? { ...state.pendingAction } : null,
  };
}
export function operationResult(state: OperationState): any {
  return {
    finalStat: state.stat,
    editLog: state.editLog,
    commands: state.commands,
    ...(state.context.exposesFunctionState
      ? {
          finalStatFunc: state.statFunc,
          functionEditLog: state.functionEditLog,
        }
      : {}),
    diagnostics: state.diagnostics,
    ...(state.randomCursor
      ? {
          randomDrawsConsumed: state.randomCursor.drawOffset,
          nextRandomDrawOffset: state.randomCursor.drawOffset,
        }
      : {}),
  };
}
