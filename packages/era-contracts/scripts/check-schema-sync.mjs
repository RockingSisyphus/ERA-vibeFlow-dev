import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");
const schemasRoot = path.join(packageRoot, "schemas");

const macroDescriptors = new Map([
  ["era.macro.substring", "javascript_project/macro/manifests/data/macro-substring.jsonc"],
  [
    "era.macro.stored_stat",
    "javascript_project/macro/manifests/data/macro-stored-stat.jsonc",
  ],
  [
    "era.macro.replacement",
    "javascript_project/macro/manifests/data/macro-replacement.jsonc",
  ],
  [
    "era.macro.substring.checked",
    "javascript_project/macro/manifests/data/macro-checked-substring.jsonc",
  ],
  [
    "era.macro.stored_stat.checked",
    "javascript_project/macro/manifests/data/macro-checked-stored-stat.jsonc",
  ],
  ["era.macro.contains", "javascript_project/macro/manifests/data/macro-contains.jsonc"],
  [
    "era.macro.occurrence_plan",
    "javascript_project/macro/manifests/data/macro-occurrence-plan.jsonc",
  ],
  [
    "era.macro.replacement.candidate",
    "javascript_project/macro/manifests/data/macro-replacement-candidate.jsonc",
  ],
  [
    "era.macro.replacement.internal",
    "javascript_project/macro/manifests/data/macro-replacement-internal.jsonc",
  ],
  [
    "era.macro.resolved_occurrences",
    "javascript_project/macro/manifests/data/macro-resolved-occurrences.jsonc",
  ],
  ["era.macro.snapshot", "javascript_project/macro/manifests/data/macro-snapshot.jsonc"],
  [
    "era.macro.substring.for_replace",
    "javascript_project/macro/manifests/data/macro-substring-for-replace.jsonc",
  ],
]);

const serviceDescriptors = new Map([
  [
    "era.transport.event.raw",
    "javascript_project/service/manifests/data/era-transport-event-raw.jsonc",
  ],
  [
    "era.transport.event",
    "javascript_project/service/manifests/data/era-transport-event.jsonc",
  ],
  [
    "era.service.state",
    "javascript_project/service/manifests/data/era-service-state.jsonc",
  ],
  [
    "era.service.state.current",
    "javascript_project/service/manifests/data/era-service-state-current.jsonc",
  ],
  [
    "era.service.state.next",
    "javascript_project/service/manifests/data/era-service-state-next.jsonc",
  ],
  [
    "era.service.state.post_batch",
    "javascript_project/service/manifests/data/era-service-state-post-batch.jsonc",
  ],
  [
    "era.collection.reduction",
    "javascript_project/service/manifests/data/era-collection-reduction.jsonc",
  ],
  ["era.batch.plan", "javascript_project/service/manifests/data/era-batch-plan.jsonc"],
  [
    "era.batch.execution.state",
    "javascript_project/service/manifests/data/era-batch-execution-state.jsonc",
  ],
  [
    "era.batch.execution.state.next",
    "javascript_project/service/manifests/data/era-batch-execution-state-next.jsonc",
  ],
  [
    "era.batch.execution.state.after",
    "javascript_project/service/manifests/data/era-batch-execution-state-after.jsonc",
  ],
  ["era.step.request", "javascript_project/service/manifests/data/era-step-request.jsonc"],
  [
    "era.step.request.routed",
    "javascript_project/service/manifests/data/era-step-request-routed.jsonc",
  ],
  ["era.task.result", "javascript_project/service/manifests/data/era-task-result.jsonc"],
  [
    "era.batch.finalization",
    "javascript_project/service/manifests/data/era-batch-finalization.jsonc",
  ],
  [
    "era.collection.control",
    "javascript_project/service/manifests/data/era-collection-control.jsonc",
  ],
  ["era.batch.result", "javascript_project/service/manifests/data/era-batch-result.jsonc"],
]);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function withoutDraft(schema) {
  const { $schema: _draft, ...portableSchema } = schema;
  return portableSchema;
}

async function assertDescriptorGroup(descriptors, groupName) {
  for (const [typeKey, descriptorRelativePath] of descriptors) {
    const canonicalPath = path.join(schemasRoot, `${typeKey}.schema.json`);
    const descriptorPath = path.join(workspaceRoot, descriptorRelativePath);
    const canonical = await readJson(canonicalPath);
    const descriptor = await readJson(descriptorPath);

    assert.equal(
      descriptor.type_key,
      typeKey,
      `${descriptorRelativePath} 的 type_key 与 canonical 契约不一致`,
    );
    assert.deepEqual(
      descriptor.schema,
      canonical,
      `${descriptorRelativePath} 已偏离 canonical ${groupName} Schema`,
    );
  }
}

await assertDescriptorGroup(macroDescriptors, "Macro");
await assertDescriptorGroup(serviceDescriptors, "Service");

const eventSchema = await readJson(
  path.join(schemasRoot, "era.transport.event.schema.json"),
);
const stateSchema = await readJson(
  path.join(schemasRoot, "era.service.state.schema.json"),
);
const taskResultSchema = await readJson(
  path.join(schemasRoot, "era.task.result.schema.json"),
);
const collectionControlSchema = await readJson(
  path.join(schemasRoot, "era.collection.control.schema.json"),
);
const batchResultSchema = await readJson(
  path.join(schemasRoot, "era.batch.result.schema.json"),
);

const transportArgSchema = await readJson(
  path.join(schemasRoot, "era.transport.arg.v1.schema.json"),
);
const failureSchema = await readJson(
  path.join(schemasRoot, "era.failure.v1.schema.json"),
);
const settlementSchema = await readJson(
  path.join(schemasRoot, "era.settlement.v1.schema.json"),
);
const notificationSchema = await readJson(
  path.join(schemasRoot, "era.notification.v1.schema.json"),
);
const diagnosticSchema = await readJson(
  path.join(schemasRoot, "era.diagnostic.v1.schema.json"),
);
const collectionCommandSchema = await readJson(
  path.join(schemasRoot, "era.collection.command.v1.schema.json"),
);
const domainTaskSchema = await readJson(
  path.join(schemasRoot, "era.domain.task.v1.schema.json"),
);
const plannedSourceSchema = await readJson(
  path.join(schemasRoot, "era.planned.source.v1.schema.json"),
);
const plannedStepSchema = await readJson(
  path.join(schemasRoot, "era.planned.step.v1.schema.json"),
);
const taskStateUpdateSchema = await readJson(
  path.join(schemasRoot, "era.task.state_update.v1.schema.json"),
);
const batchPlanSchema = await readJson(
  path.join(schemasRoot, "era.batch.plan.schema.json"),
);
const batchExecutionStateSchema = await readJson(
  path.join(schemasRoot, "era.batch.execution.state.schema.json"),
);

assert.deepEqual(
  eventSchema.properties.args.items,
  withoutDraft(transportArgSchema),
  "传输事件内嵌参数标签已偏离 canonical Schema",
);
assert.deepEqual(
  stateSchema.properties.collection.items,
  withoutDraft(eventSchema),
  "服务状态内嵌事件已偏离 canonical Schema",
);
assert.deepEqual(
  collectionControlSchema.properties.commands.items,
  withoutDraft(collectionCommandSchema),
  "事件集控制命令已偏离 canonical Schema",
);
assert.deepEqual(
  batchResultSchema.properties.settlements.items,
  withoutDraft(settlementSchema),
  "批次结果结算已偏离 canonical Schema",
);
assert.deepEqual(
  batchResultSchema.properties.notifications.items,
  withoutDraft(notificationSchema),
  "批次结果通知已偏离 canonical Schema",
);
assert.deepEqual(
  batchResultSchema.properties.diagnostics.items,
  withoutDraft(diagnosticSchema),
  "批次结果诊断已偏离 canonical Schema",
);
assert.deepEqual(
  settlementSchema.oneOf[2].properties.error,
  withoutDraft(failureSchema),
  "失败结算已偏离 canonical 错误 Schema",
);
assert.deepEqual(
  taskResultSchema.properties.settlements.items,
  withoutDraft(settlementSchema),
  "任务结果结算已偏离 canonical Schema",
);
assert.deepEqual(
  taskResultSchema.properties.notifications.items,
  withoutDraft(notificationSchema),
  "任务结果通知已偏离 canonical Schema",
);
assert.deepEqual(
  taskResultSchema.properties.diagnostics.items,
  withoutDraft(diagnosticSchema),
  "任务结果诊断已偏离 canonical Schema",
);
assert.deepEqual(
  taskResultSchema.properties.stateUpdate,
  withoutDraft(taskStateUpdateSchema),
  "任务结果状态更新已偏离 canonical Schema",
);
assert.deepEqual(
  batchPlanSchema.properties.steps.items,
  withoutDraft(plannedStepSchema),
  "批次计划步骤已偏离 canonical Schema",
);
assert.deepEqual(
  batchExecutionStateSchema.properties.steps.items,
  withoutDraft(plannedStepSchema),
  "批次执行状态步骤已偏离 canonical Schema",
);
assert.deepEqual(
  plannedStepSchema.oneOf[0].properties.task,
  withoutDraft(domainTaskSchema),
  "execute 步骤任务已偏离 canonical Schema",
);
assert.deepEqual(
  plannedStepSchema.oneOf[0].properties.sources.items,
  withoutDraft(plannedSourceSchema),
  "execute 步骤来源已偏离 canonical Schema",
);

for (const file of await readdir(schemasRoot)) {
  if (file.endsWith(".schema.json")) {
    await readJson(path.join(schemasRoot, file));
  }
}

process.stdout.write(
  `Schema 同步检查通过：${macroDescriptors.size} 个 Macro descriptor、` +
    `${serviceDescriptors.size} 个 Service descriptor与严格计划/任务复合组件。\n`,
);
