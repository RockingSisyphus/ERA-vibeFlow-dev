/**
 * 判断值是否为可移植 JSON 值。
 *
 * 该 codec 只做结构判断，不克隆、不修改输入，也不访问任何宿主资源。
 */
export function isJsonValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

/** 判断宏输入是否携带一份存在的已存 ERA 状态。 */
export function isPresentMacroStoredStat(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    value.kind === "present" &&
    Object.prototype.hasOwnProperty.call(value, "value") &&
    isJsonValue(value.value)
  );
}

/** 构造显式的状态缺失标记。 */
export function missingMacroStoredStat() {
  return Object.freeze({ kind: "missing" });
}

/** ERA Host 合成的收集定时器事件类型。 */
export const ERA_COLLECTION_TIMER_EVENT_TYPE = "era.service.collection_timer";

/** 首版 Service 的锁定资源上限。 */
export const DEFAULT_ERA_SERVICE_CONFIG_V1 = Object.freeze({
  max_event_bytes: 262144,
  max_fifo_events: 256,
  max_fifo_bytes: 8388608,
  max_collection_events: 128,
  max_collection_bytes: 2097152,
  max_batch_steps: 128,
  barrier_watchdog_ms: 5000,
  max_host_refs_per_event: 32,
});

function isRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, requiredKeys, optionalKeys = []) {
  if (!isRecord(value)) {
    return false;
  }
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  return (
    requiredKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ) && Object.keys(value).every((key) => allowed.has(key))
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isSafeIntegerAtLeast(value, minimum) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/** 判断消息是否为严格的 ERA 当前激活文本投影。 */
export function isEraTavernMessageV1(value) {
  return (
    hasOnlyKeys(value, [
      "schemaVersion",
      "messageId",
      "role",
      "activeText",
      "swipeIndex",
    ]) &&
    value.schemaVersion === 1 &&
    isSafeIntegerAtLeast(value.messageId, 0) &&
    isNonEmptyString(value.role) &&
    typeof value.activeText === "string" &&
    (value.swipeIndex === null || isSafeIntegerAtLeast(value.swipeIndex, 0))
  );
}

/** 判断值是否为不含宿主对象的第二版消息上下文。 */
export function isEraTavernMessageContextV2(value) {
  return (
    hasOnlyKeys(value, ["schemaVersion", "messages"]) &&
    value.schemaVersion === 2 &&
    Array.isArray(value.messages) &&
    value.messages.every(isEraTavernMessageV1)
  );
}

/** 判断值是否为把消息快照与不可变任务身份分离的第二版派发上下文。 */
export function isEraDispatchContextV2(value) {
  if (
    !hasOnlyKeys(value, [
      "schemaVersion",
      "status",
      "dispatchClass",
      "requirement",
      "messages",
      "processingMessage",
      "processingMk",
      "messageChanged",
      "variablesChanged",
      "failure",
    ]) ||
    value.schemaVersion !== 2 ||
    !["ready", "failed"].includes(value.status) ||
    !["initialize", "sync", "api", "update-mk", "ignore"].includes(
      value.dispatchClass,
    ) ||
    !["none", "latest-message", "latest-message-with-mk"].includes(
      value.requirement,
    ) ||
    !Array.isArray(value.messages) ||
    !value.messages.every(isEraTavernMessageV1) ||
    !(
      value.processingMessage === null ||
      isEraTavernMessageV1(value.processingMessage)
    ) ||
    !(value.processingMk === null || isNonEmptyString(value.processingMk)) ||
    typeof value.messageChanged !== "boolean" ||
    typeof value.variablesChanged !== "boolean" ||
    !(value.failure === null || isEraFailureV1(value.failure))
  )
    return false;
  if (value.status === "ready" && value.failure !== null) return false;
  if (value.status === "failed" && value.failure === null) return false;
  if (value.requirement === "none") {
    return value.processingMessage === null && value.processingMk === null;
  }
  // 删除最后一条消息后的同步仍需形成一个明确的空聊天提交。此时没有可声称的
  // processing message/MK。Facade 同步保留 api 类别；是否为 state-sync 由准备阶段
  // 根据任务意图决定，结构校验不把 api 一律误判为消息写入。
  if (
    value.status === "ready" &&
    (value.dispatchClass === "sync" || value.dispatchClass === "api") &&
    value.messages.length === 0
  ) {
    return value.processingMessage === null && value.processingMk === null;
  }
  if (value.status === "ready" && value.processingMessage === null)
    return false;
  return !(
    value.status === "ready" &&
    value.requirement === "latest-message-with-mk" &&
    !isNonEmptyString(value.processingMk)
  );
}

function isGenerationCycleIdentityV1(value) {
  return (
    hasOnlyKeys(value, ["chatId", "eventId", "sourceKey"]) &&
    isNonEmptyString(value.chatId) &&
    isNonEmptyString(value.eventId) &&
    isNonEmptyString(value.sourceKey)
  );
}

function isEraFloorIdentityV1(value) {
  return (
    hasOnlyKeys(value, ["chatId", "messageId", "swipeId", "mk"]) &&
    isNonEmptyString(value.chatId) &&
    isSafeIntegerAtLeast(value.messageId, 0) &&
    isSafeIntegerAtLeast(value.swipeId, 0) &&
    isNonEmptyString(value.mk)
  );
}

function isStagedMessageUpdateV1(value) {
  return (
    hasOnlyKeys(value, ["messageId", "content"]) &&
    isSafeIntegerAtLeast(value.messageId, 0) &&
    typeof value.content === "string"
  );
}

function isAgentFloorCandidateV1(value) {
  return (
    hasOnlyKeys(value, [
      "messageId",
      "swipeId",
      "mk",
      "content",
      "extra",
      "terminalStatus",
      "requiresInitialPresentation",
    ]) &&
    isSafeIntegerAtLeast(value.messageId, 0) &&
    isSafeIntegerAtLeast(value.swipeId, 0) &&
    isNonEmptyString(value.mk) &&
    typeof value.content === "string" &&
    isRecord(value.extra) &&
    isJsonValue(value.extra) &&
    ["settled", "story-complete", "unsettled"].includes(value.terminalStatus) &&
    typeof value.requiresInitialPresentation === "boolean"
  );
}

/** 判断值是否为携带暂存消息与稳定楼层身份的第三版派发上下文。 */
export function isEraDispatchContextV3(value) {
  if (
    !hasOnlyKeys(value, [
      "schemaVersion",
      "status",
      "dispatchClass",
      "requirement",
      "messages",
      "processingMessage",
      "processingMk",
      "messageChanged",
      "variablesChanged",
      "failure",
      "generationCycleIdentity",
      "floorIdentity",
      "stagedMessageUpdates",
      "agentFloorCandidate",
    ], ["sourceBasis"]) ||
    value.schemaVersion !== 3 ||
    !["ready", "failed"].includes(value.status) ||
    !["initialize", "sync", "api", "update-mk", "ignore"].includes(value.dispatchClass) ||
    !["none", "latest-message", "latest-message-with-mk"].includes(value.requirement) ||
    !Array.isArray(value.messages) ||
    !value.messages.every(isEraTavernMessageV1) ||
    !(value.processingMessage === null || isEraTavernMessageV1(value.processingMessage)) ||
    !(value.processingMk === null || isNonEmptyString(value.processingMk)) ||
    typeof value.messageChanged !== "boolean" ||
    typeof value.variablesChanged !== "boolean" ||
    !(value.failure === null || isEraFailureV1(value.failure)) ||
    !(value.generationCycleIdentity === null || isGenerationCycleIdentityV1(value.generationCycleIdentity)) ||
    !(value.floorIdentity === null || isEraFloorIdentityV1(value.floorIdentity)) ||
    !Array.isArray(value.stagedMessageUpdates) ||
    !value.stagedMessageUpdates.every(isStagedMessageUpdateV1) ||
    !(value.agentFloorCandidate === null || isAgentFloorCandidateV1(value.agentFloorCandidate)) ||
    !(value.sourceBasis === undefined || (
      hasOnlyKeys(value.sourceBasis, ["identity", "messages"]) &&
      hasOnlyKeys(value.sourceBasis.identity, ["characterId", "chatId", "groupId"]) &&
      (value.sourceBasis.identity.characterId === null || typeof value.sourceBasis.identity.characterId === "string") &&
      typeof value.sourceBasis.identity.chatId === "string" &&
      (value.sourceBasis.identity.groupId === null || typeof value.sourceBasis.identity.groupId === "string") &&
      Array.isArray(value.sourceBasis.messages) && value.sourceBasis.messages.every(isEraTavernMessageV1)
    ))
  ) return false;
  if (value.status === "ready" && value.failure !== null) return false;
  if (value.status === "failed" && value.failure === null) return false;
  if (value.requirement === "none") {
    return value.processingMessage === null && value.processingMk === null && value.floorIdentity === null;
  }
  if (value.status === "ready" && (value.dispatchClass === "sync" || value.dispatchClass === "api") && value.messages.length === 0) {
    return value.processingMessage === null && value.processingMk === null && value.floorIdentity === null;
  }
  if (value.status === "ready" && value.processingMessage === null) return false;
  if (value.status === "ready" && value.requirement === "latest-message-with-mk") {
    if (!isNonEmptyString(value.processingMk) || value.floorIdentity === null) return false;
    if (value.floorIdentity.messageId !== value.processingMessage.messageId || value.floorIdentity.mk !== value.processingMk) return false;
  }
  if (value.agentFloorCandidate !== null) {
    if (value.floorIdentity === null) return false;
    if (
      value.agentFloorCandidate.messageId !== value.floorIdentity.messageId ||
      value.agentFloorCandidate.swipeId !== value.floorIdentity.swipeId ||
      value.agentFloorCandidate.mk !== value.floorIdentity.mk
    ) return false;
  }
  return true;
}

function definePortableOwn(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function clonePortable(value, options) {
  const active = new Set();
  const visit = (candidate, path, depth) => {
    if (depth > 128) throw new TypeError(`${path} 的 JSON 嵌套过深。`);
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean"
    )
      return candidate;
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate))
        throw new TypeError(`${path} 包含非有限数值。`);
      return candidate;
    }
    if (typeof candidate !== "object") {
      throw new TypeError(`${path} 包含不可移植值：${typeof candidate}。`);
    }
    if (active.has(candidate)) throw new TypeError(`${path} 包含循环引用。`);
    active.add(candidate);
    try {
      if (Array.isArray(candidate)) {
        if (Object.getOwnPropertySymbols(candidate).length > 0) {
          throw new TypeError(`${path} 不允许 Symbol 键。`);
        }
        const result = new Array(candidate.length);
        for (let index = 0; index < candidate.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(
            candidate,
            String(index),
          );
          if (!descriptor) {
            result[index] = null;
            continue;
          }
          if (!("value" in descriptor))
            throw new TypeError(`${path}[${index}] 不允许访问器。`);
          result[index] =
            descriptor.value === undefined
              ? null
              : visit(descriptor.value, `${path}[${index}]`, depth + 1);
        }
        return result;
      }
      const prototype = Object.getPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`${path} 不是普通对象。`);
      }
      if (Object.getOwnPropertySymbols(candidate).length > 0) {
        throw new TypeError(`${path} 不允许 Symbol 键。`);
      }
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      const explicitKeys = Object.keys(descriptors).filter(
        (key) => key !== "__proto__",
      );
      const result = Object.create(null);
      const protoDescriptor = descriptors.__proto__;
      if (protoDescriptor?.enumerable) {
        if (!("value" in protoDescriptor))
          throw new TypeError(`${path}.__proto__ 不允许访问器。`);
        const promoted = visit(
          protoDescriptor.value,
          `${path}.__proto__`,
          depth + 1,
        );
        if (
          promoted === null ||
          typeof promoted !== "object" ||
          Array.isArray(promoted)
        ) {
          throw new TypeError(`${path}.__proto__ 必须是对象。`);
        }
        for (const key of Object.keys(promoted)) {
          if (!explicitKeys.includes(key))
            definePortableOwn(result, key, promoted[key]);
        }
      }
      for (const key of explicitKeys) {
        const descriptor = descriptors[key];
        if (!descriptor?.enumerable) continue;
        if (!("value" in descriptor))
          throw new TypeError(`${path}.${key} 不允许访问器。`);
        if (descriptor.value === undefined) {
          if (options.rejectObjectUndefined) {
            throw new TypeError(`${path}.${key} 不允许 undefined。`);
          }
          continue;
        }
        definePortableOwn(
          result,
          key,
          visit(descriptor.value, `${path}.${key}`, depth + 1),
        );
      }
      return result;
    } finally {
      active.delete(candidate);
    }
  };
  return visit(value, options.path, 0);
}

/**
 * 把宿主或领域值收敛为统一可移植 JSON：对象使用 null prototype 与
 * defineProperty，数组空洞/undefined 固定为 null，对象 undefined 省略。
 */
export function cloneEraPortableJsonV1(value) {
  return clonePortable(value, { path: "$ERA", rejectObjectUndefined: false });
}

/**
 * 把公开对象 API payload 收敛为无原型 JSON。自有 __proto__ 对象的字段安全
 * 提升到同层；同层显式字段优先。对象属性中的 undefined 继续严格拒绝。
 */
export function normalizeLegacySafeObjectV1(value) {
  const normalized = clonePortable(value, {
    path: "$API",
    rejectObjectUndefined: true,
  });
  if (
    normalized === null ||
    typeof normalized !== "object" ||
    Array.isArray(normalized)
  ) {
    throw new TypeError("ERA 公开对象 API 需要对象 payload。");
  }
  return normalized;
}

/** 判断一个值是否为无损传输参数标签。 */
export function isEraTransportArg(value) {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind === "json") {
    return hasOnlyKeys(value, ["kind", "value"]) && isJsonValue(value.value);
  }
  if (value.kind === "undefined") {
    return hasOnlyKeys(value, ["kind"]);
  }
  if (value.kind === "host-ref") {
    return (
      hasOnlyKeys(value, ["kind", "token", "refKind"]) &&
      isNonEmptyString(value.token) &&
      isNonEmptyString(value.refKind)
    );
  }
  return false;
}

/** 判断一个值是否为首版 ERA 传输事件。 */
export function isEraTransportEventV1(value) {
  if (
    !hasOnlyKeys(value, [
      "schemaVersion",
      "eventId",
      "sequence",
      "type",
      "occurredAt",
      "source",
      "args",
      "encodedBytes",
    ])
  ) {
    return false;
  }

  const sourceIsValid = ["tavern", "ui", "era-api", "timer"].includes(
    value.source,
  );
  return (
    value.schemaVersion === 1 &&
    isNonEmptyString(value.eventId) &&
    isSafeIntegerAtLeast(value.sequence, 1) &&
    isNonEmptyString(value.type) &&
    isFiniteNumber(value.occurredAt) &&
    sourceIsValid &&
    (value.source !== "timer" ||
      value.type === ERA_COLLECTION_TIMER_EVENT_TYPE) &&
    Array.isArray(value.args) &&
    value.args.every(isEraTransportArg) &&
    isSafeIntegerAtLeast(value.encodedBytes, 0) &&
    value.encodedBytes <= DEFAULT_ERA_SERVICE_CONFIG_V1.max_event_bytes
  );
}

/** 统计单事件中的宿主引用；32 个上限由 Host 接受事件前应用。 */
export function countEraHostRefs(event) {
  return event.args.reduce(
    (count, arg) => count + (arg.kind === "host-ref" ? 1 : 0),
    0,
  );
}

/** 判断一个值是否为首版 Service 资源上限配置。 */
export function isEraServiceConfigV1(value) {
  if (
    !hasOnlyKeys(value, [
      "max_event_bytes",
      "max_fifo_events",
      "max_fifo_bytes",
      "max_collection_events",
      "max_collection_bytes",
      "max_batch_steps",
      "barrier_watchdog_ms",
      "max_host_refs_per_event",
    ])
  ) {
    return false;
  }
  return (
    isSafeIntegerAtLeast(value.max_event_bytes, 1) &&
    isSafeIntegerAtLeast(value.max_fifo_events, 1) &&
    isSafeIntegerAtLeast(value.max_fifo_bytes, 1) &&
    isSafeIntegerAtLeast(value.max_collection_events, 1) &&
    value.max_collection_events <= 128 &&
    isSafeIntegerAtLeast(value.max_collection_bytes, 1) &&
    isSafeIntegerAtLeast(value.max_batch_steps, 1) &&
    value.max_batch_steps <= 128 &&
    isSafeIntegerAtLeast(value.barrier_watchdog_ms, 0) &&
    isSafeIntegerAtLeast(value.max_host_refs_per_event, 0)
  );
}

/** 判断一个值是否为永久循环携带的有界 Service 状态。 */
export function isEraServiceStateV1(value) {
  if (
    !hasOnlyKeys(value, [
      "schemaVersion",
      "collection",
      "collectionBytes",
      "iteration",
      "consecutiveProcessingCount",
      "consecutiveMk",
      "syncCursor",
      "timerToken",
      "scopeWindow",
    ])
  ) {
    return false;
  }
  return (
    value.schemaVersion === 1 &&
    Array.isArray(value.collection) &&
    value.collection.length <= 128 &&
    value.collection.every(isEraTransportEventV1) &&
    isSafeIntegerAtLeast(value.collectionBytes, 0) &&
    value.collectionBytes <=
      DEFAULT_ERA_SERVICE_CONFIG_V1.max_collection_bytes &&
    isSafeIntegerAtLeast(value.iteration, 0) &&
    isSafeIntegerAtLeast(value.consecutiveProcessingCount, 0) &&
    (value.consecutiveMk === null || isNonEmptyString(value.consecutiveMk)) &&
    (value.timerToken === null || isNonEmptyString(value.timerToken)) &&
    isEraScopeWindowStateV1(value.scopeWindow)
  );
}

export function isEraScopeWindowStateV1(value) {
  return (
    hasOnlyKeys(value, [
      "token",
      "messageId",
      "messageAdmission",
      "branchAdmission",
    ]) &&
    (value.token === null || isSafeIntegerAtLeast(value.token, 1)) &&
    (value.messageId === null || isSafeIntegerAtLeast(value.messageId, 0)) &&
    (value.messageAdmission === null ||
      typeof value.messageAdmission === "boolean") &&
    (value.branchAdmission === null ||
      typeof value.branchAdmission === "boolean")
  );
}

const ERA_EXECUTABLE_TASK_ROUTES = [
  "initialize",
  "sync",
  "api",
  "update-mk",
  "agent-generation-session",
];
const ERA_EVENT_RELATIONS = ["primary", "combined", "coalesced"];
const ERA_TASK_CONTEXTS = ["none", "latest-message", "latest-message-with-mk"];
const ERA_SYNC_REASONS = [
  "history-changed",
  "edited",
  "swipe-regeneration",
  "manual",
  "facade-commit",
];

function sameEventIdentity(left, right) {
  return left.eventId === right.eventId && left.sequence === right.sequence;
}

function isBoundedEventArray(value) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 128 &&
    value.every(isEraTransportEventV1)
  );
}

function hasValidDomainTaskBase(value) {
  return (
    isNonEmptyString(value.id) &&
    isBoundedEventArray(value.sourceEvents) &&
    isEraTransportEventV1(value.primaryEvent) &&
    value.sourceEvents.some((event) =>
      sameEventIdentity(event, value.primaryEvent),
    ) &&
    ERA_TASK_CONTEXTS.includes(value.context)
  );
}

function isEraSyncTargetV1(value) {
  if (!isRecord(value)) return false;
  if (value.kind === "auto") return hasOnlyKeys(value, ["kind"]);
  if (value.kind === "message") {
    return (
      hasOnlyKeys(value, ["kind", "messageId", "stopAfterTarget"]) &&
      isSafeIntegerAtLeast(value.messageId, 0) &&
      typeof value.stopAfterTarget === "boolean"
    );
  }
  return (
    value.kind === "previous-of-latest" &&
    hasOnlyKeys(value, ["kind", "stopAfterTarget"]) &&
    value.stopAfterTarget === true
  );
}

/** 判断一个值是否完整携带候选基线领域任务语义。 */
export function isEraDomainTaskV1(value) {
  if (!isRecord(value) || !hasValidDomainTaskBase(value)) return false;
  const baseKeys = ["id", "sourceEvents", "primaryEvent", "context", "kind"];
  if (value.kind === "initialize") {
    return (
      hasOnlyKeys(value, [...baseKeys, "operation", "args"]) &&
      ["startup", "resources", "settings-update"].includes(value.operation) &&
      Array.isArray(value.args) &&
      value.args.every(isEraTransportArg)
    );
  }
  if (value.kind === "update-mk") {
    return hasOnlyKeys(value, baseKeys);
  }
  if (value.kind === "sync") {
    return (
      hasOnlyKeys(value, [...baseKeys, "reason", "target", "fullRebuild"]) &&
      ERA_SYNC_REASONS.includes(value.reason) &&
      isEraSyncTargetV1(value.target) &&
      typeof value.fullRebuild === "boolean"
    );
  }
  if (value.kind === "api") {
    return (
      hasOnlyKeys(value, [...baseKeys, "intent", "eventType", "args"]) &&
      ["query", "message-write", "state-sync"].includes(value.intent) &&
      isNonEmptyString(value.eventType) &&
      Array.isArray(value.args) &&
      value.args.every(isEraTransportArg)
    );
  }
  return false;
}

/** 判断一个值是否为带候选关系的计划来源。 */
export function isEraPlannedSourceV1(value) {
  return (
    hasOnlyKeys(value, ["event", "relation"]) &&
    isEraTransportEventV1(value.event) &&
    ERA_EVENT_RELATIONS.includes(value.relation)
  );
}

function hasValidStepBase(value) {
  return (
    isNonEmptyString(value.stepId) &&
    isSafeIntegerAtLeast(value.index, 0) &&
    value.index <= 127 &&
    Array.isArray(value.sourceSequences) &&
    value.sourceSequences.length >= 1 &&
    value.sourceSequences.length <= 128 &&
    value.sourceSequences.every((sequence) =>
      isSafeIntegerAtLeast(sequence, 1),
    ) &&
    new Set(value.sourceSequences).size === value.sourceSequences.length &&
    isBoundedEventArray(value.events) &&
    value.events.length === value.sourceSequences.length &&
    value.events.every(
      (event, index) => event.sequence === value.sourceSequences[index],
    )
  );
}

/** 判断一个值是否为无损且有界的 execute/ignore 动态步骤。 */
export function isEraPlannedStepV1(value) {
  if (!isRecord(value) || !hasValidStepBase(value)) return false;
  const baseKeys = [
    "kind",
    "stepId",
    "index",
    "taskRoute",
    "sourceSequences",
    "events",
  ];
  if (value.kind === "ignore") {
    return (
      hasOnlyKeys(value, [...baseKeys, "reason"]) &&
      value.taskRoute === "ignore" &&
      isNonEmptyString(value.reason)
    );
  }
  if (value.kind !== "execute") return false;
  if (
    !hasOnlyKeys(value, [...baseKeys, "task", "sources"]) ||
    !ERA_EXECUTABLE_TASK_ROUTES.includes(value.taskRoute) ||
    !isEraDomainTaskV1(value.task) ||
    (value.taskRoute !== "agent-generation-session" &&
      value.task.kind !== value.taskRoute) ||
    !Array.isArray(value.sources) ||
    value.sources.length !== value.events.length ||
    !value.sources.every(isEraPlannedSourceV1) ||
    !value.sources.every((source, index) =>
      sameEventIdentity(source.event, value.events[index]),
    ) ||
    value.task.sourceEvents.length !== value.events.length ||
    !value.task.sourceEvents.every((event, index) =>
      sameEventIdentity(event, value.events[index]),
    )
  ) {
    return false;
  }
  return true;
}

/** 判断一个值是否为稳定的可恢复业务错误。 */
export function isEraFailureV1(value) {
  if (
    !hasOnlyKeys(
      value,
      ["code", "message", "category", "retryable"],
      ["details"],
    )
  ) {
    return false;
  }
  return (
    isNonEmptyString(value.code) &&
    typeof value.message === "string" &&
    ["input", "domain", "tavern", "cancelled"].includes(value.category) &&
    typeof value.retryable === "boolean" &&
    (!Object.prototype.hasOwnProperty.call(value, "details") ||
      (isRecord(value.details) && isJsonValue(value.details)))
  );
}

/** 判断一个值是否为恰好一次事件结算。 */
export function isEraSettlementV1(value) {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.eventId) ||
    !isSafeIntegerAtLeast(value.sequence, 1)
  ) {
    return false;
  }
  if (value.status === "completed") {
    return (
      hasOnlyKeys(
        value,
        ["eventId", "sequence", "status", "taskId", "relation"],
        ["value"],
      ) &&
      isNonEmptyString(value.taskId) &&
      ["primary", "combined", "coalesced"].includes(value.relation) &&
      (!Object.prototype.hasOwnProperty.call(value, "value") ||
        isJsonValue(value.value))
    );
  }
  if (value.status === "ignored" || value.status === "cancelled") {
    return (
      hasOnlyKeys(value, ["eventId", "sequence", "status", "reason"]) &&
      isNonEmptyString(value.reason)
    );
  }
  if (value.status === "failed") {
    return (
      hasOnlyKeys(value, ["eventId", "sequence", "status", "error"]) &&
      isEraFailureV1(value.error)
    );
  }
  return false;
}

/** 判断一个值是否为锁外通知声明。 */
export function isEraNotificationV1(value) {
  return (
    hasOnlyKeys(value, ["type", "args"]) &&
    isNonEmptyString(value.type) &&
    Array.isArray(value.args) &&
    value.args.every(isEraTransportArg)
  );
}

/** 判断一个值是否为结构化 Service 诊断。 */
export function isEraDiagnosticV1(value) {
  return (
    hasOnlyKeys(value, ["code", "message", "sequence"]) &&
    isNonEmptyString(value.code) &&
    typeof value.message === "string" &&
    (value.sequence === null || isSafeIntegerAtLeast(value.sequence, 1))
  );
}

/**
 * 判断消息内函数调用的块级续做游标。
 *
 * 只有计算中的楼层才有游标：逐块提交时把「已提交到哪一块」写进服务状态的
 * `syncCursor`，该楼层算完即置回 null（恢复点只在计算期间存在）。
 */
export function isEraSyncCursorV1(value) {
  return value === null || (
    hasOnlyKeys(value, ["messageId", "mk", "blockIndex"]) &&
    isSafeIntegerAtLeast(value.messageId, 0) && isNonEmptyString(value.mk) &&
    isSafeIntegerAtLeast(value.blockIndex, 0)
  );
}

/** 判断任务携带的易失连续处理状态更新；该值不属于持久化 Schema。 */
export function isEraTaskStateUpdateV1(value) {
  return (
    hasOnlyKeys(
      value,
      ["consecutiveMk", "consecutiveProcessingCount"],
      ["scopeWindow", "syncCursor"],
    ) &&
    (value.consecutiveMk === null || isNonEmptyString(value.consecutiveMk)) &&
    isSafeIntegerAtLeast(value.consecutiveProcessingCount, 0) &&
    (!Object.prototype.hasOwnProperty.call(value, "scopeWindow") ||
      isEraScopeWindowStateV1(value.scopeWindow)) &&
    (!Object.prototype.hasOwnProperty.call(value, "syncCursor") ||
      isEraSyncCursorV1(value.syncCursor))
  );
}

/** 判断一个值是否为固定状态的领域任务结果。 */
export function isEraTaskResultV1(value) {
  return (
    hasOnlyKeys(
      value,
      ["status", "settlements", "notifications", "diagnostics"],
      ["stateUpdate"],
    ) &&
    ["committed", "no-op", "failed", "fatal"].includes(value.status) &&
    Array.isArray(value.settlements) &&
    value.settlements.length <= 128 &&
    value.settlements.every(isEraSettlementV1) &&
    Array.isArray(value.notifications) &&
    value.notifications.every(isEraNotificationV1) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isEraDiagnosticV1) &&
    (!Object.prototype.hasOwnProperty.call(value, "stateUpdate") ||
      isEraTaskStateUpdateV1(value.stateUpdate))
  );
}

function isEraCollectionCommandV1(value) {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind === "schedule") {
    return (
      hasOnlyKeys(value, ["kind", "token", "dueAt"]) &&
      isNonEmptyString(value.token) &&
      isFiniteNumber(value.dueAt)
    );
  }
  if (value.kind === "cancel") {
    return (
      hasOnlyKeys(value, ["kind", "token"]) && isNonEmptyString(value.token)
    );
  }
  return false;
}

/** 判断一个值是否为幂等事件集控制帧。 */
export function isEraCollectionControlV1(value) {
  return (
    hasOnlyKeys(value, ["schemaVersion", "frameId", "kind", "commands"]) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.frameId) &&
    value.kind === "collection-control" &&
    Array.isArray(value.commands) &&
    value.commands.every(isEraCollectionCommandV1)
  );
}

/** 判断一个值是否为幂等批次结果帧。 */
export function isEraBatchResultV1(value) {
  return (
    hasOnlyKeys(value, [
      "schemaVersion",
      "frameId",
      "kind",
      "throughSequence",
      "settlements",
      "notifications",
      "diagnostics",
      "fatal",
    ]) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.frameId) &&
    value.kind === "batch-result" &&
    isSafeIntegerAtLeast(value.throughSequence, 1) &&
    Array.isArray(value.settlements) &&
    value.settlements.length >= 1 &&
    value.settlements.length <= 128 &&
    value.settlements.every(isEraSettlementV1) &&
    Array.isArray(value.notifications) &&
    value.notifications.every(isEraNotificationV1) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isEraDiagnosticV1) &&
    typeof value.fatal === "boolean"
  );
}
