/** Progress生成器只保存业务局部变量；请求交由Config中的官方节点执行，不持有Node context。 */
// Adapters with identical declared base libraries share this source.
import { type EraTaskResultV1 } from "@era/vibeflow-contracts";
// Original node: nodes/agent/candidate_finish.ts
/** Candidate retries stay inside the workflow, without a stage handoff. */
export function CandidateFinishNode(inputs: any): any {
    const state = inputs["era.agent.candidate.state"].value;
    const { retryGeneration, ...outcome } = inputs["era.agent.generation.outcome"].value;
    return {
        candidate_state_after: retryGeneration
            ? { ...state, request: retryGeneration }
            : state,
        candidate_done: !retryGeneration,
        candidate_outcome: outcome,
    };
}
// Original node: nodes/agent/candidate_unpack.ts
/** Candidate retries stay inside the workflow, without a stage handoff. */
export function CandidateUnpackNode(inputs: any): any {
    const state = inputs["era.agent.candidate.state"].value;
    return {
        generation_request: state.request,
        routed_step: state.step,
        execution_state: state.executionState,
    };
}
// Original node: nodes/agent/route_transition.ts
interface RouteTransition_Envelope<T> {
    readonly value: T;
}
interface RouteTransition_Transition {
    readonly mode: "legacy" | "legacy-ignore" | "execute-legacy" | "execute-only";
}
export function RouteTransitionNode(inputs: Readonly<{
    "era.agent.session.transition": RouteTransition_Envelope<unknown>;
    "era.batch.execution.state": RouteTransition_Envelope<unknown>;
}>): any {
    const transition = inputs["era.agent.session.transition"].value as RouteTransition_Transition;
    const executionState = inputs["era.batch.execution.state"].value;
    const agent_route = transition.mode === "legacy" || transition.mode === "execute-legacy"
        ? "legacy"
        : "direct";
    return { agent_route, agent_transition_routed: transition, agent_execution_state_routed: executionState };
}
// Original node: nodes/initialize/adapt_startup_sync_step.ts
export function AdaptStartupSyncStepNode(inputs: any): any {
    return {
        routed_startup_sync_step: inputs["era.initialize.startup.sync.step"].value,
        routed_startup_execution_state: inputs["era.batch.execution.state"].value,
    };
}
// Original node: nodes/initialize/build_initialization_commit.ts
interface BuildInitializationCommit_Envelope<T> {
    readonly value: T;
}
export function BuildInitializationCommitNode(inputs: Readonly<{
    "era.initialize.changes": BuildInitializationCommit_Envelope<unknown>;
}>): any {
    return { resource_commit_request: inputs["era.initialize.changes"].value as Readonly<Record<string, unknown>> };
}
// Original node: nodes/initialize/carry_execution_state.ts
interface CarryExecutionState_Envelope<T> {
    readonly value: T;
}
export function CarryExecutionStateNode(inputs: Readonly<{
    "era.batch.execution.state": CarryExecutionState_Envelope<unknown>;
}>): any {
    return {
        initialize_execution_state: inputs["era.batch.execution.state"].value,
    };
}
// Original node: nodes/initialize/compute_initialization.ts
interface ComputeInitialization_Envelope<T> {
    readonly value: T;
}
export function ComputeInitializationNode(inputs: Readonly<{
    "era.initialize.plan": ComputeInitialization_Envelope<unknown>;
}>): any {
    return { computed_resource_changes: inputs["era.initialize.plan"].value as Readonly<Record<string, unknown>> };
}
// Original node: nodes/initialize/finalize_direct_initialization.ts
interface FinalizeDirectInitialization_Envelope<T> {
    readonly value: T;
}
export function FinalizeDirectInitializationNode(inputs: Readonly<{
    "era.initialize.direct.result": FinalizeDirectInitialization_Envelope<unknown>;
}>): {
    readonly initialize_direct_task_result: EraTaskResultV1 & Readonly<Record<string, unknown>>;
} {
    return {
        initialize_direct_task_result: inputs["era.initialize.direct.result"].value as EraTaskResultV1 & Readonly<Record<string, unknown>>,
    };
}
// Original node: nodes/initialize/preserve_initialization.ts
interface PreserveInitialization_Envelope<T> {
    readonly value: T;
}
export function PreserveInitializationNode(inputs: Readonly<{
    "era.initialize.plan": PreserveInitialization_Envelope<unknown>;
}>): any {
    return { preserved_resource_changes: inputs["era.initialize.plan"].value as Readonly<Record<string, unknown>> };
}
// Original node: nodes/lifecycle/activate_tavern_ingress.ts
interface ActivateTavernIngress_Ctx {
    readonly capabilities: {
        readonly 'era.tavern.startup_gate': {
            activate(input: Readonly<Record<string, unknown>>): unknown;
        };
    };
}
export function* ActivateTavernIngressProgress(inputs: Readonly<{
    'era.installation.scope.decision': {
        readonly value: unknown;
    };
}>, _params: Readonly<Record<string, unknown>>, _context: ActivateTavernIngress_Ctx): Generator<any, any, any> {
    yield { kind: "resource", capability: "era.tavern.startup_gate", operation: "activate", input: inputs['era.installation.scope.decision'].value as Record<string, unknown> };
    return {};
}
// Original node: nodes/lifecycle/classify_installation_scope.ts
type ClassifyInstallationScope_Scope = 'character' | 'global' | 'preset';
type ClassifyInstallationScope_Classification = ClassifyInstallationScope_Scope | 'ambiguous' | 'unknown';
function ClassifyInstallationScope_isScope(value: unknown): value is ClassifyInstallationScope_Scope {
    return value === 'character' || value === 'global' || value === 'preset';
}
/** 纯函数：脚本树 Host 事实 -> 唯一安装位置分类。 */
export function ClassifyInstallationScope_classify(value: unknown): Readonly<{
    status: ClassifyInstallationScope_Classification;
    reason: string;
}> {
    if (!value || typeof value !== 'object')
        return { status: 'unknown', reason: 'facts-invalid' };
    const facts = value as Record<string, unknown>;
    if (facts.readStatus !== 'complete')
        return { status: 'unknown', reason: `host-${String(facts.readStatus ?? 'unavailable')}` };
    if (typeof facts.scriptId !== 'string' || facts.scriptId.length === 0)
        return { status: 'unknown', reason: 'script-id-unavailable' };
    const scopes = Array.isArray(facts.scopes) ? [...new Set(facts.scopes.filter(ClassifyInstallationScope_isScope))] : [];
    if (scopes.length === 1)
        return { status: scopes[0], reason: `enabled-${scopes[0]}-script` };
    if (scopes.length > 1)
        return { status: 'ambiguous', reason: 'enabled-in-multiple-scopes' };
    return { status: 'unknown', reason: 'script-id-not-in-enabled-tree' };
}
// Original node: nodes/lifecycle/decide_startup_policy.ts
type DecideStartupPolicy_Classification = 'character' | 'global' | 'preset' | 'ambiguous' | 'unknown';
/** 纯策略：只允许角色卡脚本；作用域 API 不可用时兼容启动并报警。 */
export function DecideStartupPolicy_decide(value: unknown): Readonly<{
    classification: DecideStartupPolicy_Classification;
    route: 'allow' | 'dormant';
    warn: boolean;
}> {
    const status = value && typeof value === 'object' ? (value as Record<string, unknown>).status : undefined;
    const classification: DecideStartupPolicy_Classification = status === 'character' || status === 'global' || status === 'preset' || status === 'ambiguous' || status === 'unknown'
        ? status
        : 'unknown';
    if (classification === 'character')
        return { classification, route: 'allow', warn: false };
    if (classification === 'unknown')
        return { classification, route: 'allow', warn: true };
    return { classification, route: 'dormant', warn: true };
}
// Original node: nodes/lifecycle/inspect_installation_scope.ts
/** 启动期只采集 Host 原始事实；不在 Node 内推断允许/拒绝策略。 */
interface InspectInstallationScope_Ctx {
    readonly capabilities: {
        readonly "era.tavern.installation_scope": {
            read(input: Readonly<Record<string, unknown>>): unknown;
        };
    };
}
export function* InspectInstallationScopeProgress(_inputs: Readonly<Record<string, never>>, _params: Readonly<Record<string, unknown>>, _context: InspectInstallationScope_Ctx): Generator<any, any, any> {
    return {
        installation_scope_facts: yield { kind: "resource", capability: "era.tavern.installation_scope", operation: "read", input: {} },
    };
}
// Original node: nodes/lifecycle/publish_dormant_startup.ts
interface PublishDormantStartup_Ctx {
    readonly capabilities: {
        readonly 'era.tavern.startup_gate': {
            dormant(input: Readonly<Record<string, unknown>>): unknown;
        };
    };
}
export function* PublishDormantStartupProgress(inputs: Readonly<{
    'era.installation.scope.decision': {
        readonly value: unknown;
    };
}>, _params: Readonly<Record<string, unknown>>, _context: PublishDormantStartup_Ctx): Generator<any, any, any> {
    yield { kind: "resource", capability: "era.tavern.startup_gate", operation: "dormant", input: inputs['era.installation.scope.decision'].value as Record<string, unknown> };
    return {};
}
// Original node: nodes/lifecycle/terminal.ts
export function TerminalNode(): Record<string, never> {
    return {};
}
// Original node: nodes/publish/route_fatal.ts
interface RouteFatal_Envelope<T> {
    readonly value: T;
}
export function RouteFatalNode(inputs: Readonly<{
    "era.batch.fatal": RouteFatal_Envelope<boolean>;
}>): any {
    return {
        fatal_route: inputs["era.batch.fatal"].value
            ? ("fatal" as const)
            : ("continue" as const),
    };
}
/** Keep the API task result distinct inside its expanded workflow. */
export function AdaptApiTaskResultNode(inputs: any): any {
    return { api_task_result_common: inputs["era.api.task.result"].value };
}
/** 根据脚本安装事实选择启动方式，并交付启动决议。 */
export function ChooseStartupNode(inputs: any): any {
    const decision = DecideStartupPolicy_decide(ClassifyInstallationScope_classify(inputs['era.installation.scope.facts'].value));
    return { installation_scope_decision: decision, installation_scope_route: decision.route };
}
