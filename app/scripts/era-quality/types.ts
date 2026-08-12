export type Severity = 'error' | 'warning' | 'info';
export type QualityStatus = 'PASS' | 'CONCERNS' | 'FAIL' | 'ERROR';
export type BaselineDisposition = 'none' | 'known' | 'new' | 'worsened' | 'improved' | 'resolved' | 'waived';

export interface SourceLocation {
  path: string;
  line: number;
  column: number;
}

export interface CommentFact {
  id: string;
  kind: 'line' | 'block' | 'jsdoc' | 'html' | 'css';
  section: 'script' | 'template' | 'style';
  text: string;
  raw: string;
  range: [number, number];
  lineStart: number;
  lineEnd: number;
  column: number;
  attachedObjectId?: string;
  precedingCode?: string;
  followingCode?: string;
}

export interface FunctionFact {
  objectId: string;
  name: string;
  qualifiedName: string;
  kind: 'function' | 'method' | 'arrow' | 'callback';
  exported: boolean;
  async: boolean;
  range: [number, number];
  bodyRange: [number, number];
  lineStart: number;
  lineEnd: number;
  /** 非空且去除注释后的代码行，用于所有规模阈值。 */
  codeLines: number;
  /** 物理跨度，仅用于源码定位；不得用于质量阈值。 */
  lines: number;
  branches: number;
  maxNestingDepth: number;
  requiredParams: number;
  parameterNames: string[];
  astFingerprint: string;
  leadingCommentId?: string;
}

export interface TypeFact {
  objectId: string;
  name: string;
  kind: 'interface' | 'type';
  exported: boolean;
  memberCount: number;
  range: [number, number];
  lineStart: number;
  leadingCommentId?: string;
}

export interface ImportFact {
  rawSpecifier: string;
  sourceModule: string;
  localNames: string[];
  targetModule?: string;
  targetPath?: string;
  external: boolean;
  typeOnly: boolean;
  dynamic: boolean;
  sideEffectOnly: boolean;
  resource: boolean;
  line: number;
  column: number;
}

export interface IdentifierUse {
  name: string;
  qualifiedName: string;
  kind: 'call' | 'member' | 'identifier';
  bindingKind: 'ambient' | 'import' | 'local';
  importSource?: string;
  line: number;
  column: number;
  objectId?: string;
  locallyBound: boolean;
}

export interface ParsedFile {
  path: string;
  absolutePath: string;
  moduleName: string;
  kind: 'ts' | 'vue';
  text: string;
  bytes: number;
  /** 全文件非空且去除注释后的代码行，Vue 包含 template/script/style。 */
  codeLines: number;
  /** 文件物理行数，仅供定位和诊断。 */
  lines: number;
  scriptCodeLines: number;
  functionCount: number;
  classCount: number;
  exportCount: number;
  branchCount: number;
  maxNestingDepth: number;
  comments: CommentFact[];
  functions: FunctionFact[];
  types: TypeFact[];
  imports: ImportFact[];
  identifierUses: IdentifierUse[];
  declaredNames: string[];
  internal: {
    ast: any;
    visitorKeys?: Record<string, string[]>;
    scriptRanges: Array<[number, number]>;
  };
}

export interface FindingSeed {
  ruleId: string;
  severity: Severity;
  category: 'structure' | 'dependency' | 'architecture' | 'side-effect' | 'comment' | 'tool';
  objectType: string;
  objectId: string;
  path: string;
  line: number;
  column: number;
  observed: number | string | boolean | null;
  limit: number | string | boolean | null;
  debt: number;
  message: string;
  suggestedFix: string;
  evidenceKey?: string;
  details?: Record<string, unknown>;
}

export interface Finding extends FindingSeed {
  fingerprint: string;
  baselineDisposition: BaselineDisposition;
}

export interface Waiver {
  ruleId: string;
  path: string;
  objectId: string;
  reason: string;
  expires: string;
}

export interface QualityPolicy {
  schemaVersion: 1;
  include: string[];
  thresholds: {
    warnFileLines: number;
    maxFileLines: number;
    maxFileBytes: number;
    maxFunctionsPerFile: number;
    maxClassesPerFile: number;
    maxExportsPerFile: number;
    maxFileBranches: number;
    maxDirectoryFanout: number;
    maxDirectoryFanin: number;
    maxFunctionLines: number;
    maxFunctionBranches: number;
    maxFunctionNesting: number;
    maxFunctionParams: number;
    warnDependencyChain: number;
    maxDependencyChain: number;
    minDuplicateFunctionLines: number;
  };
  comments: {
    minimumHanForUseful: number;
    largeFileCodeLines: number;
    minimumUsefulRatio: number;
    highUsefulRatio: number;
    moduleDocCodeLines: number;
    moduleDocExports: number;
    minimumModuleDocHan: number;
    minimumCriticalDocHan: number;
    minimumTypeDocHan: number;
    exportedFunctionLines: number;
    exportedFunctionBranches: number;
    criticalFunctionLines: number;
    criticalFunctionBranches: number;
    criticalFunctionNesting: number;
    criticalFunctionParams: number;
    disabledBlockLines: number;
    disabledBlockCodeRatio: number;
    duplicateProseHan: number;
    rationaleWords: string[];
    historyWords: string[];
  };
  architecture: {
    forbiddenImports: Array<{ from: string; to: string[] }>;
    purePaths: string[];
    schedulerPath: string;
    schedulerClockObject: string;
  };
  capabilities: {
    domUi: string[];
    storage: string[];
    network: string[];
    clockRandom: string[];
    allowedGlobals: string[];
  };
  waivers: Waiver[];
}

export interface DependencyGraph {
  runtime: Record<string, string[]>;
  typeOnly: Record<string, string[]>;
  longestRuntimeChain: string[];
  cycles: string[][];
  directoryFanIn: Record<string, number>;
  directoryFanOut: Record<string, number>;
}

export interface CommentMetrics {
  total: number;
  naturalLanguage: number;
  chinese: number;
  usefulChineseLines: number;
  scriptCodeLines: number;
}

export interface QualityMetrics {
  files: number;
  comments: CommentMetrics;
  dependencyGraph: DependencyGraph;
}

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  objectId: string;
  severity: Exclude<Severity, 'info'>;
  debt: number;
}

export interface QualityBaseline {
  schemaVersion: 1;
  toolVersion: string;
  policyDigest: string;
  findings: BaselineEntry[];
}

export interface BaselineDiff {
  known: number;
  new: number;
  worsened: number;
  improved: number;
  resolved: number;
  waived: number;
  resolvedEntries: BaselineEntry[];
}

export interface QualityReport {
  schemaVersion: 1;
  tool: {
    name: 'era-quality';
    version: string;
    policyDigest: string;
  };
  status: QualityStatus;
  root: string;
  summary: {
    files: number;
    errors: number;
    warnings: number;
    infos: number;
    baselineKnown: number;
    newFindings: number;
    worsenedFindings: number;
    improvedFindings: number;
    resolvedFindings: number;
  };
  metrics: QualityMetrics;
  findings: Finding[];
  baselineDiff: BaselineDiff;
}
