import { blockWorkResult } from '../../../javascript_project/service/nodes/sync/core_position_nodes';
export function run(inputs: any, _params?: any, _context?: any): any {
  return { expression_command_result: blockWorkResult(inputs['era.sync.block.step.pending'].value) };
}
