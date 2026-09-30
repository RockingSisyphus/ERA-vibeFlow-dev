/** 旧只读接口适配：业务准备和重放分别复用正式图的输入及纯操作语义。 */
export * from "./sync_work_preparation.ts";
export { planEraSync } from "../domain/sync/sync_block.ts";
import { planSyncWork as prepareWork } from "./sync_work_preparation.ts";
import { prepareEraSync } from "../domain/sync/sync_prepare.ts";
import { planEraSync } from "../domain/sync/sync_block.ts";
import type { SyncPlanningInput } from "./sync_contracts.ts";
export function planSyncWork(context: SyncPlanningInput, prepareOnly = false) {
  return prepareWork(context, prepareOnly ? prepareEraSync : planEraSync);
}
