import { installAuthorFrame } from '../../../javascript_project/service/nodes/sync/core_position_nodes.ts';
import { seedStageOperations } from '../../../javascript_project/service/nodes/sync/core_position_nodes.ts';
import { finishPositionStep } from '../../../javascript_project/service/nodes/sync/core_position_nodes.ts';
/** 旧生命周期测试的一轮适配器；只串联正式 Node 使用的原子步骤，不另写 CRUD 或公式语义。
 * 正式 Service 的接线与异步能力由 AOT 执行探针及真实回归测试验证。 */
import { foldOperations } from '../../../javascript_project/service/base_lib/domain/commands/operation_fold.ts';
import { routeBlockLifecycle } from '../../../javascript_project/service/base_lib/sync/position_source';
import * as source from '../../../javascript_project/service/base_lib/sync/position_source';
import * as author from '../../../javascript_project/service/base_lib/sync/position_author';

export async function run(inputs: any, _params: any, context: any): Promise<any> {
  const functions = context.capabilities['era.tavern.functions'];
  const routed = routeBlockLifecycle(inputs['era.sync.block.step.state'].value);
  let position = routed.state;
  if (routed.route !== 'source') {
    const lifecycle = author.routeAuthorLifecycle(position).route;
    if (lifecycle === 'terminal') position = author.releaseTerminalFunction(position, functions);
    else if (lifecycle === 'start') {
      const call = author.inspectAuthorCall(position);
      position = call.state;
      const effect = author.functionEffect(position, state =>
        call.route === 'valid'
          ? author.beginAuthorFunction(state, functions)
          : author.finishAuthorFunction(state, functions),
      );
      position = effect.route === 'failed' ? author.recordHostFailure(effect.state, functions) : effect.state;
    } else {
      const ack = author.functionEffect(position, state => author.acknowledgeCompletedCommit(state, functions));
      position = ack.state;
      if (ack.route === 'failed') position = author.recordHostFailure(position, functions);
      else {
        position = await author.waitFunctionEvent(position, context);
        const route = author.routeFunctionEvent(position).route;
        if (route === 'failed') position = author.recordHostFailure(position, functions);
        else {
          const effect = author.functionEffect(position, state => {
            if (route === 'done') return author.finishAuthorFunction(state, functions);
            if (route === 'unsupported') return author.rejectFunctionSync(state, functions);
            const commit = author.prepareFunctionCommit(state);
            return commit.route === 'failed'
              ? author.recordHostFailure(commit.state, functions)
              : commit.route === 'immediate'
                ? author.acknowledgeImmediateRequest(commit.state, functions)
                : commit.state;
          });
          position = effect.route === 'failed' ? author.recordHostFailure(effect.state, functions) : effect.state;
        }
      }
    }
  } else {
    const origin = source.prepareFloorOrigin(position);
    position = origin.state;
    if (origin.route === 'invalid') position = source.advanceInvalidFloor(position);
    else if (source.routeStagePosition(position).route === 'calls') {
      const seeded = seedStageOperations(position);
      position = source.acceptStageCallTable(
        source.acceptOperationResult(seeded.state, foldOperations(seeded.operations)).state,
      );
    } else {
      const classified = source.classifySourceBlock(position);
      position = classified.state;
      if (classified.route === 'command') {
        const seeded = source.seedCommandOperations(position);
        position = source.markCompletedCommand(
          source.acceptOperationResult(seeded.state, foldOperations(seeded.operations)).state,
        );
      } else if (classified.route === 'author-call') position = installAuthorFrame(position);
      else if (classified.route === 'skip') position = source.markSkippedCall(position);
      else position = source.prepareSealedCandidate(source.finalizeFloor(position));
      if (classified.route !== 'author-call') position = source.advanceSourcePosition(position);
    }
  }
  return { block_step_pending: finishPositionStep(position) };
}
