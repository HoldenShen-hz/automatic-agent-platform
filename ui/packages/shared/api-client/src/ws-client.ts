export type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";

export interface WSEventEnvelope {
  readonly channel: string;
  readonly type: string;
  readonly payload: unknown;
}

export type EventHandler = (event: WSEventEnvelope) => void;

export interface WSClient {
  connect(url: string, token: string): void;
  disconnect(): void;
  subscribe(channel: string, handler: EventHandler): () => void;
  onStatusChange(handler: (status: WSStatus) => void): () => void;
  publish(event: WSEventEnvelope): void;
  useSseFallback(): void;
}

export class InMemoryWSClient implements WSClient {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly statusHandlers = new Set<(status: WSStatus) => void>();
  private status: WSStatus = "disconnected";

  public connect(_url: string, _token: string): void {
    this.setStatus("connected");
  }

  public disconnect(): void {
    this.setStatus("disconnected");
  }

  public subscribe(channel: string, handler: EventHandler): () => void {
    const channelHandlers = this.handlers.get(channel) ?? new Set<EventHandler>();
    channelHandlers.add(handler);
    this.handlers.set(channel, channelHandlers);
    return () => {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
      }
    };
  }

  public onStatusChange(handler: (status: WSStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  public publish(event: WSEventEnvelope): void {
    for (const handler of this.handlers.get(event.channel) ?? []) {
      handler(event);
    }
  }

  public useSseFallback(): void {
    this.setStatus("sse-fallback");
  }

  private setStatus(status: WSStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}
