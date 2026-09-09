type Handler = (...args: unknown[]) => void | Promise<void>;

/** 同一宿主订阅周期的监听所有权；登记失败与正常卸载使用同一释放路径。 */
export class TavernListeners {
  private readonly registrations = new Map<string, Handler>();

  get count(): number {
    return this.registrations.size;
  }

  /** 先登记所有权再调用宿主，确保宿主登记抛错时也能由统一路径释放。 */
  register(eventType: string, handler: Handler, order: 'first' | 'normal' | 'last'): void {
    if (this.registrations.has(eventType)) throw new Error(`ERA 生产监听事件重复：${eventType}`);
    this.registrations.set(eventType, handler);
    if (order === 'first') eventMakeFirst(eventType, handler);
    else if (order === 'last') eventMakeLast(eventType, handler);
    else eventOn(eventType, handler);
  }

  /** 必须释放已登记的全部句柄，避免热重载累积业务事件。 */
  release(): void {
    for (const [type, handler] of this.registrations) eventRemoveListener(type, handler);
    this.registrations.clear();
  }
}
