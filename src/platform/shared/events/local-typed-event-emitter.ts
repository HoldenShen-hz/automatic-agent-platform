export type LocalEventListener<TPayload = unknown> = (payload: TPayload) => void;

export class LocalTypedEventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listenerMap = new Map<keyof TEvents, Set<LocalEventListener>>();
  private maxListeners = 0;

  public on<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: LocalEventListener<TEvents[TEvent]>,
  ): this {
    const listeners = this.getListeners(event);
    if (
      this.maxListeners > 0
      && !listeners.has(listener as LocalEventListener)
      && listeners.size >= this.maxListeners
    ) {
      throw new Error(`local_typed_event_emitter.max_listeners_exceeded:${String(event)}`);
    }
    listeners.add(listener as LocalEventListener);
    return this;
  }

  public setMaxListeners(maxListeners: number): this {
    if (!Number.isInteger(maxListeners) || maxListeners < 0) {
      throw new Error("local_typed_event_emitter.invalid_max_listeners");
    }
    this.maxListeners = maxListeners;
    return this;
  }

  public getMaxListeners(): number {
    return this.maxListeners;
  }

  public once<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: LocalEventListener<TEvents[TEvent]>,
  ): this {
    const wrapped: LocalEventListener<TEvents[TEvent]> = (payload) => {
      this.off(event, wrapped);
      listener(payload as TEvents[TEvent]);
    };
    return this.on(event, wrapped);
  }

  public off<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: LocalEventListener<TEvents[TEvent]>,
  ): this {
    this.listenerMap.get(event)?.delete(listener as LocalEventListener);
    return this;
  }

  public removeListener<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: LocalEventListener<TEvents[TEvent]>,
  ): this {
    return this.off(event, listener);
  }

  public listeners<TEvent extends keyof TEvents>(event: TEvent): LocalEventListener<TEvents[TEvent]>[] {
    return [...(this.listenerMap.get(event) ?? [])] as LocalEventListener<TEvents[TEvent]>[];
  }

  public listenerCount<TEvent extends keyof TEvents>(event: TEvent): number {
    return this.listenerMap.get(event)?.size ?? 0;
  }

  public emit<TEvent extends keyof TEvents>(event: TEvent, payload?: TEvents[TEvent]): boolean {
    const listeners = this.listenerMap.get(event);
    if (listeners == null || listeners.size === 0) {
      return false;
    }
    for (const listener of [...listeners]) {
      listener(payload);
    }
    return true;
  }

  public removeAllListeners<TEvent extends keyof TEvents>(event?: TEvent): this {
    if (event == null) {
      this.listenerMap.clear();
    } else {
      this.listenerMap.delete(event);
    }
    return this;
  }

  private getListeners<TEvent extends keyof TEvents>(event: TEvent): Set<LocalEventListener> {
    let listeners = this.listenerMap.get(event);
    if (listeners == null) {
      listeners = new Set();
      this.listenerMap.set(event, listeners);
    }
    return listeners;
  }
}
