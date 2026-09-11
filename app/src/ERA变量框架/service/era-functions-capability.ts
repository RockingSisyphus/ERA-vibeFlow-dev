/**
 * @file 消息内函数调用的宿主能力装配
 * @description 把 `era.tavern.functions` 的三个操作装配成适配层可注入的能力对象，
 * 并额外提供「在调用位置驱动一次函数」的运行入口：登记 → 在位置门面下执行 →
 * 收集函数产出的操作 → 回送终态 → 释放会话。
 *
 * 为什么单独成模块：这段装配包含位置绑定 apply 的语义决定（就地记录、绝不入队），
 * 与适配器自身的生命周期、事件监听、消息写入职责无关；放在适配器里会同时推高它
 * 的函数数与行数，也会让「谁拥有位置绑定状态」变得含混。
 */

import { EraFunctionOperationsHost } from './era-function-operations-host';
import { createTavernToolInvoker } from './era-tavern-tool-invoker';
import type { EraFunctionCallOutcome } from './era-function-invocation-host';
import { activateEraPositionBinding, deactivateEraPositionBinding } from './era-position-binding';
import type { EraCapabilityContext, EraTavernAdapter } from './types';

export type EraFunctionsCapability = EraTavernAdapter['functions'];

/** 一次函数驱动的位置与状态事实；全部来自 Service 交出的调用位置。 */
export interface EraFunctionDriveInput {
  readonly invocationId: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly messageId: number;
  readonly mk: string;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
}

export interface EraFunctionDriveResult {
  readonly outcome: EraFunctionCallOutcome;
  /** 函数在本次调用中提交的操作，按提交顺序；Service 把它们写进操作区并重放。 */
  readonly operations: readonly Readonly<Record<string, unknown>>[];
}

/** 宿主侧函数执行入口：能力对象 + 在步骤之外驱动一次调用的机械实现。 */
export interface EraFunctionsRuntime {
  readonly capability: EraFunctionsCapability;
  drive(input: EraFunctionDriveInput): Promise<EraFunctionDriveResult>;
  stop(): void;
}

function unknownInvocation(name: string): EraFunctionCallOutcome {
  return {
    status: 'failed',
    name,
    result: null,
    message: 'ERA_FUNCTION_INVOCATION_UNKNOWN: 没有该调用会话。',
    unregistered: false,
  };
}

/**
 * 建立消息内函数调用的宿主能力与执行入口。
 *
 * 位置绑定的 `apply` 只做「记录 + 计数」：真正的状态推进由 Service 侧的消息函数
 * 流程按消息文本重放完成。宿主复制一套变量引擎会让两侧状态分歧，而入队则会让处理
 * 该消息的 FIFO 事件与等待函数返回的自身互等。
 *
 * `invoke` 只表示已受理，不表示函数已完成；终态由 `result` 回送，工具失败以返回值
 * 表达（酒馆的 invokeFunctionTool 失败时返回 Error 对象而不是抛异常）。
 */
export function createEraFunctionsRuntime(): EraFunctionsRuntime {
  /** 本次调用已提交的操作；一次只服务一个调用，因此用调用结束时的计数切片即可。 */
  const observed: Readonly<Record<string, unknown>>[] = [];
  const host = new EraFunctionOperationsHost(createTavernToolInvoker(), operation => {
    observed.push(operation as Readonly<Record<string, unknown>>);
    return { sequence: observed.length };
  });
  return {
    capability: {
      invoke: (input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext) =>
        host.invoke(input as never).then(() => ({ status: 'accepted' as const })),
      result: (input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext) => host.result(input as never),
      release: (input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext) => {
        host.release(input as never);
        return { released: true };
      },
    },
    async drive(input) {
      await host.invoke({
        invocationId: input.invocationId,
        name: input.name,
        args: input.args,
      });
      // 位置门面必须在函数执行期间才生效：登记完成后开启，函数返回即摘掉，
      // 否则函数外的提交会被误判成位置绑定提交。
      activateEraPositionBinding({
        invocationId: input.invocationId,
        messageId: input.messageId,
        mk: input.mk,
        stat: input.stat,
        statFunc: input.statFunc,
        commit: operations =>
          host.commit(input.invocationId, operations as readonly Readonly<Record<string, unknown>>[]),
      });
      let outcome: EraFunctionCallOutcome;
      try {
        outcome = (await host.run(input.invocationId)) ?? unknownInvocation(input.name);
      } finally {
        deactivateEraPositionBinding(input.invocationId);
      }
      const settled = await host.result({ invocationId: input.invocationId });
      const operations = observed.splice(Math.max(0, observed.length - settled.appliedCount));
      host.release({ invocationId: input.invocationId });
      return {
        outcome: { ...settled, status: outcome.status === 'cancelled' ? 'cancelled' : settled.status },
        operations,
      };
    },
    stop() {
      host.stop();
      observed.length = 0;
    },
  };
}
