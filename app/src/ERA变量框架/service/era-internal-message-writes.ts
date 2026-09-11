/**
 * @file ERA 自身写回消息的簿记
 * @description 记录「这次消息更新是 ERA 自己写的」，用来把内部写回与玩家/AI 的真实
 * 消息更新区分开。
 *
 * 为什么单独成模块：这份簿记是适配器里唯一「按消息身份判断事件来源」的状态，留在
 * 适配器主体里会与监听器、生命周期清理混在一起，也让适配器继续越过维护行数上限。
 */

import { INPUT_EVENT } from '../events/catalog';
import { currentEraMessageText } from './message-writer';

/** 一次内部写回的期望文本；键为消息楼层号。 */
export class EraInternalMessageWrites {
  /** 传给 Agent 宿主与消息写入器的同一份状态；必须是同一个 Map 实例。 */
  readonly map = new Map<number, string>();

  /**
   * 判断并消费一次内部写回。
   *
   * 必须在文本与期望值一致时才消费：玩家或 AI 在 ERA 写回之后又改了这条消息时，
   * 这次更新就不再是内部写回，必须让真实业务窗口照常开启，否则会漏掉一次同步。
   */
  consume(eventType: string, args: readonly unknown[]): boolean {
    if (eventType !== INPUT_EVENT.MESSAGE_UPDATED) return false;
    const rawId = args[0];
    if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) return false;
    const id = Number(rawId);
    const expected = this.map.get(id);
    if (expected === undefined) return false;
    if (currentEraMessageText(id) !== expected) {
      this.map.delete(id);
      return false;
    }
    this.map.delete(id);
    return true;
  }

  clear(): void {
    this.map.clear();
  }
}
