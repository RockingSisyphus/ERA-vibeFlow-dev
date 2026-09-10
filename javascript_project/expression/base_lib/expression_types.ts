export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly position?: number;
}

export type Ast =
  | { readonly kind: "literal"; readonly value: number }
  | {
      readonly kind: "ref";
      readonly path: readonly string[];
      readonly snapshot: boolean;
    }
  | { readonly kind: "unary"; readonly op: "+" | "-"; readonly value: Ast }
  | {
      readonly kind: "binary";
      readonly op: "+" | "-" | "*" | "/" | "%" | "^";
      readonly left: Ast;
      readonly right: Ast;
    }
  | {
      readonly kind: "call";
      readonly name: string;
      readonly args: readonly Ast[];
      /** `@f(...)` binds this whole custom-call closure to the layer snapshot. */
      readonly snapshot?: boolean;
    };

export interface ParsedFunction {
  readonly name: string;
  readonly params: readonly string[];
  readonly expr: string;
  readonly ast: Ast | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CompiledLibrary {
  readonly functions: Readonly<Record<string, ParsedFunction>>;
  /** Custom functions that directly or transitively contain any random call. */
  readonly randomFunctions: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  readonly valid: boolean;
}

export interface RandomContext {
  /** Stable message identity. ERA Service passes the message MK. */
  readonly sourceKey: string;
  /** First automatic draw index available to this request. */
  readonly drawOffset: number;
}

export interface ParsedOperation {
  readonly index: number;
  readonly path: readonly string[];
  readonly expr: string;
  readonly ast: Ast | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface NormalizedRequest {
  readonly initialState: JsonValue;
  readonly snapshotState: JsonValue | null;
  readonly functionLibrary: Readonly<Record<string, unknown>>;
  readonly snapshotFunctionLibrary: Readonly<Record<string, unknown>> | null;
  readonly allowSnapshots: boolean;
  readonly randomContext: RandomContext | null;
  readonly operations: readonly {
    readonly path: string;
    readonly expr: string;
  }[];
  readonly diagnostics: readonly Diagnostic[];
  readonly valid: boolean;
}

export interface SequenceState {
  readonly startState: JsonValue;
  readonly currentState: JsonValue;
  readonly compiled: CompiledLibrary;
  readonly snapshotCompiled: CompiledLibrary;
  readonly operations: readonly ParsedOperation[];
  readonly cursor: number;
  readonly randomContext: RandomContext | null;
  /** Statically reserved automatic draws, including failed runtime operations. */
  readonly randomDrawsConsumed: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ExpressionResponse {
  readonly status: "ok" | "invalid" | "partial";
  readonly finalState: JsonValue;
  readonly diagnostics: readonly Diagnostic[];
  readonly compressed: Readonly<Record<string, { readonly $expr: string }>>;
  readonly compactedOperations: readonly {
    readonly path: string;
    readonly value: { readonly $expr: string };
  }[];
  readonly randomDrawsConsumed: number;
  readonly nextDrawOffset: number;
  readonly containsAutomaticRandom: boolean;
}

export interface EvalFrame {
  readonly kind: "eval";
  readonly ast: Ast;
  readonly env: Readonly<Record<string, number>>;
  readonly allowState: boolean;
  readonly library: CompiledLibrary;
}

export interface UnaryFrame {
  readonly kind: "unary";
  readonly op: "+" | "-";
}

export interface BinaryFrame {
  readonly kind: "binary";
  readonly op: "+" | "-" | "*" | "/" | "%" | "^";
}

export interface BuiltinFrame {
  readonly kind: "builtin";
  readonly name: string;
  readonly count: number;
}

export interface RandomFrame {
  readonly kind: "random";
  readonly count: number;
}

export interface CustomFrame {
  readonly kind: "custom";
  readonly name: string;
  readonly count: number;
  readonly library: CompiledLibrary;
}

export interface CalculusFrame {
  readonly kind: "calculus";
  readonly name: "derivative" | "integral";
  readonly target: string;
  readonly count: number;
  readonly library: CompiledLibrary;
}

export type EvalFrameEntry =
  | EvalFrame
  | UnaryFrame
  | BinaryFrame
  | BuiltinFrame
  | RandomFrame
  | CustomFrame
  | CalculusFrame;

export interface AstFrameState {
  readonly sequence: SequenceState;
  readonly stack: readonly EvalFrameEntry[];
  readonly values: readonly number[];
  readonly automaticRandomDrawCursor: number;
  readonly done: boolean;
  readonly result: number | null;
  readonly diagnostics: readonly Diagnostic[];
}
