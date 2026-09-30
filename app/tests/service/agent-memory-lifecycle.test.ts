import { describe, expect, it } from 'vitest';
import { contextWith, identity, sidecarId } from './memory-lifecycle-fixture';
import { recordFor } from '../../../javascript_project/service/base_lib/sidecar_binding';
import { run as prepareStage } from '../../../javascript_project/service/nodes/agent/prepare_stage_blocks';
import { run as advance } from './message-block-fixture';
import {
  PrepareBlockWorkNode as prepareWork,
  PublishBlockApplicationNode as publish,
} from '../../../javascript_project/service/nodes/sync/shared_block_state_adapters';
import { FinishStageBlocksNode as finishStage } from '../../../javascript_project/service/nodes/agent/finish_stage_blocks.ts';
import {
  parsePlanningOutput,
  formatAgentPlanReport,
} from '../../../javascript_project/service/base_lib/agent/agent_generation_session';
import { overlayWorkingMessages } from '../../../javascript_project/service/base_lib/working_state';
import { FormSessionTransitionNode as formTransition } from '../../../javascript_project/service/nodes/agent/finish_stage_blocks.ts';
import { isEraDispatchContextV3 } from '../../../packages/era-contracts/index.js';

const edit = (value: unknown) => `<VariableEdit>${JSON.stringify({ hp: value })}</VariableEdit>`;
describe('三阶段共用内存块循环', () => {
  it('阶段已应用楼层只用于绑定候选，不泄漏到严格的转换DTO', () => {
    const context = contextWith('story');
    const floor = { chatId: identity.chatId, messageId: 1, swipeId: 0, mk: 'draft-mk' };
    const finished = finishStage(
      {
        'era.sync.block.step.state.next': {
          value: {
            stageOutcome: {
              mode: 'execute-legacy',
              status: 'committed',
              diagnostics: [],
              candidate: {
                messageId: floor.messageId,
                swipeId: floor.swipeId,
                mk: floor.mk,
                content: 'story',
                extra: {},
                terminalStatus: 'settled',
                requiresInitialPresentation: false,
              },
              stageWorkInput: { session: { stageMemory: { ...floor, content: 'stored draft' } } },
            },
          },
        },
      },
      {},
      {},
    ).applied_generation_outcome;
    const result = formTransition({
      'era.step.request.routed': { value: context.step },
      'era.batch.execution.state': { value: {} },
      'era.agent.generation.outcome': {
        value: {
          ...finished,
          mode: 'execute-legacy',
          status: 'committed',
          diagnostics: [],
          appliedFloor: finished.appliedFloor,
          candidate: {
            messageId: floor.messageId,
            swipeId: floor.swipeId,
            mk: floor.mk,
            content: 'story',
            extra: {},
            terminalStatus: 'settled',
            requiresInitialPresentation: false,
          },
        },
      },
    }).agent_transition;
    expect(result.status).toBe('committed');
    expect(result.step.dispatchContext.floorIdentity).toEqual(floor);
    expect(isEraDispatchContextV3(result.step.dispatchContext)).toBe(true);
    expect(result).not.toHaveProperty('appliedFloor');
  });
  it('规划指令和报告分开，JSON字符串里的调用不成为可执行正文', () => {
    const report = { storyPlan: { scene: '<EraFCall name="quoted"/>' }, calls: [] };
    const plan = parsePlanningOutput(`${edit(80)}${JSON.stringify(report)}<EraFCall name="real"/>`);
    expect(plan.instructionsBefore).toBe(edit(80));
    expect(plan.instructionsAfter).toContain('name="real"');
    expect(plan.storyPlan.scene).toBe(report.storyPlan.scene);
    expect(formatAgentPlanReport(plan)).not.toContain('<EraFCall');
  });
  it.each([
    [true, 'normal'],
    [false, 'normal'],
    [true, 'regenerate'],
    [false, 'regenerate'],
  ] as const)('规划有操作=%s，生成方式=%s 时建立未来楼层并连续应用正文和结算', async (hasPlanningOperation, kind) => {
    const context = contextWith('此前消息');
    // A real chat starts at floor 0; the generated floor below is floor 1.
    context.step.dispatchContext.messages[0].messageId = 0;
    context.step.dispatchContext.sourceBasis.messages[0].messageId = 0;
    let session: any = {
      baseMessage: '',
      planningDraft: hasPlanningOperation ? edit(80) : '',
      planReport: '<era_plan>{}</era_plan>',
    };
    let working: any = {
      version: 0,
      dirty: false,
      record: recordFor(
        sidecarId,
        identity,
        { statData: { hp: 100 }, statFunc: {}, eraMeta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} } },
        null,
      ),
    };
    const capabilities = {
      'era.tavern.sidecar': {
        read_working: () => ({ working }),
        write_working: (input: any) => {
          working = { ...input, version: working.version + 1 };
          return { working };
        },
      },
      'era.tavern.agent': {
        read_session_binding: () => ({ previous: session, active: false }),
        write_session: (input: any) => {
          session = input.session;
        },
      },
    };
    const executionState = {
      schemaVersion: 1,
      nextState: {
        consecutiveMk: null,
        consecutiveProcessingCount: 0,
        scopeWindow: { token: null, messageId: null, messageAdmission: null, branchAdmission: null },
      },
    };
    let step = context.step;
    for (const [stage, expected] of [
      ['planning', hasPlanningOperation ? 80 : 100],
      ['story', hasPlanningOperation ? 160 : 200],
      ['settlement', hasPlanningOperation ? 150 : 190],
    ] as const) {
      if (stage === 'story') {
        session.story = `正文${edit({ $expr: 'hp*2' })}`;
        const physical = {
          schemaVersion: 1,
          messageId: 1,
          role: 'assistant',
          swipeIndex: 0,
          activeText: session.story,
        };
        step = {
          ...step,
          dispatchContext: {
            ...step.dispatchContext,
            messages: [...context.step.dispatchContext.messages, physical],
            sourceBasis: {
              ...step.dispatchContext.sourceBasis,
              messages: [...context.step.dispatchContext.sourceBasis.messages, physical],
            },
          },
        };
      }
      if (stage === 'settlement')
        session.pendingStage = { candidate: { content: `${session.stageMemory.content}${edit({ $expr: 'hp-10' })}` } };
      const outcome = {
        stageBoundary: { stage, result: {} },
        stageWorkInput: {
          step,
          executionState,
          session,
          request: {
            trigger: { kind, type: 'generation_started', eventId: 'generation' },
            identity:
              stage === 'planning' ? null : (session.stageMemory ?? { messageId: 1, swipeId: 0, mk: 'native-mk' }),
            context: { identity },
          },
        },
      };
      let state = prepareStage(
        { 'era.agent.generation.raw': { value: outcome } },
        {},
        { capabilities },
      ).block_step_state;
      for (let count = 0; !state.done; count++) {
        if (count > 100) throw new Error('stage stalled');
        const pending = (await advance({ 'era.sync.block.step.state': { value: state } }, {}, { capabilities }))
          .block_step_pending;
        const work = prepareWork({ 'era.sync.block.step.pending': { value: pending } }).expression_command_result;
        state = publish(
          { 'era.command_compaction.result': { value: work } },
          {},
          { capabilities },
        ).block_step_state_after;
      }
      expect(state.work.disposition).toBe('commit');
      finishStage({ 'era.sync.block.step.state.next': { value: state } }, {}, { capabilities });
      expect(working.record.state.statData.hp).toBe(expected);
      expect(working.dirty).toBe(true);
      expect(session.stageMemory.content).not.toContain('<era_block');
      if (stage === 'planning') {
        const projected = overlayWorkingMessages(
          { messages: context.step.dispatchContext.sourceBasis.messages },
          working,
        );
        expect(projected.messages).toHaveLength(2);
        expect(working.stage.phase).toBe('planning');
        if (hasPlanningOperation) expect(projected.messages[1].activeText).toContain(edit(80));
      }
    }
    expect(session.pendingStage.candidate.content).toContain('hp*2');
    expect(session.pendingStage.candidate.content).toContain('hp-10');
  });
});
