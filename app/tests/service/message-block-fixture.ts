import * as source from '../../../javascript_project/service/nodes/sync/core_position_nodes.ts';
import * as author from '../../../javascript_project/service/nodes/sync/core_author_nodes.ts';
import * as operation from '../../../javascript_project/service/nodes/sync/core_operation_nodes.ts';
import { routeAuthorLifecycle } from '../../../javascript_project/service/base_lib/sync/position_author';
import {
  completeOperations,
  settleOperation,
  skipOperation,
} from '../../../javascript_project/service/base_lib/domain/commands/operation_traversal';

/** 生命周期测试使用正式业务动作；正式 Config 的数据连线另由 AOT 探针和真实回归验证。 */
export async function run(inputs: any, _params: any, context: any): Promise<any> {
  const selected = source.ChooseMessageActionNode(inputs);
  let position = selected.message_position;
  const positionInput = () => ({ 'era.sync.position.state': { value: position } });
  const authorInput = () => ({ 'era.sync.author.state': { value: position } });
  if (selected.message_action === 'author') {
    const lifecycle = routeAuthorLifecycle(position).route;
    if (lifecycle === 'terminal')
      position = author.FinishAuthorCallNode(
        { ...authorInput(), 'era.sync.author.lifecycle.route': { value: lifecycle } },
        {},
        context,
      ).finish_author_call_author_state;
    else if (lifecycle === 'start')
      position = author.BeginAuthorCallNode(authorInput(), {}, context).begin_author_call_author_state;
    else {
      const received = await author.ReceiveAuthorEventNode(authorInput(), {}, context);
      position = received.receive_author_event_author_state;
      if (received.author_event === 'commit')
        position = author.PrepareAuthorCommitNode(authorInput(), {}, context).prepare_author_commit_author_state;
      else if (received.author_event === 'unsupported')
        position = author.AnswerAuthorSyncNode(authorInput(), {}, context).answer_author_sync_author_state;
      else if (received.author_event !== 'complete')
        position = author.FinishAuthorCallNode(
          { ...authorInput(), 'era.sync.author.event.action': { value: received.author_event } },
          {},
          context,
        ).finish_author_call_author_state;
    }
  } else if (selected.message_action === 'operations') {
    const seeded = source.PrepareMessageOperationsNode(positionInput());
    position = seeded.seed_command_operations_position_state;
    let state = seeded.seed_command_operations_operation_state;
    while (!state.done) {
      const next = operation.SelectBusinessOperationNode({ 'era.command.operation.state': { value: state } });
      state = next.take_next_operation_operation_state;
      const input = { 'era.command.operation.state': { value: state } };
      switch (next.take_next_operation_operation_route) {
        case 'insert':
          state = operation.ApplyInsertActionNode(input).apply_insert_action_operation_state;
          break;
        case 'edit':
          state = operation.ApplyEditActionNode(input).apply_edit_action_operation_state;
          break;
        case 'delete':
          state = operation.ApplyDeleteActionNode(input).apply_delete_action_operation_state;
          break;
        case 'function-group':
          state = (await operation.ApplyFunctionGroupActionNode(input, {}, context))
            .apply_function_group_action_operation_state;
          break;
        case 'stage-call':
          state = operation.ApplyStageCallActionNode(input).apply_stage_call_action_operation_state;
          break;
        case 'skip':
          state = skipOperation(state);
          break;
        case 'done':
          state = completeOperations(state);
          break;
        default:
          throw new Error('未知业务操作 ' + next.take_next_operation_operation_route);
      }
      if (!state.done) state = settleOperation(state);
    }
    position = source.AcceptMessageOperationsNode({
      ...positionInput(),
      'era.command.operation.result': { value: state },
    }).operations_position;
  } else if (selected.message_action === 'author-call') position = source.installAuthorFrame(position);
  else if (selected.message_action === 'skip') position = source.SkipMessageCallNode(positionInput()).skipped_position;
  else if (selected.message_action === 'message-end')
    position = source.FinishMessageNode(positionInput()).finished_position;
  return { block_step_pending: source.finishPositionStep(position) };
}
