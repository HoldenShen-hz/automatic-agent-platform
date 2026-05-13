export type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";

export interface WSEventEnvelope {
  readonly channel: string;
  readonly type: string;
  readonly payload: unknown;
  readonly eventId?: string;
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

export interface WebSocketFactory {
  new(url: string, protocols?: string | string[]): WebSocket;
}

export interface SharedWorkerLike {
  readonly port: MessagePort;
}

export type SharedWorkerFactory = () => SharedWorkerLike;

export interface BrowserWSClientOptions {
  readonly heartbeatIntervalMs?: number;
  readonly heartbeatTimeoutMs?: number;
  readonly replayBufferSize?: number;
}

type WorkerMessage =
  | { readonly type: "status"; readonly status: WSStatus }
  | { readonly type: "event"; readonly event: WSEventEnvelope };

function detachTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
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

export class BrowserWSClient implements WSClient {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly statusHandlers = new Set<(status: WSStatus) => void>();
  private socket: WebSocket | null = null;
  private status: WSStatus = "disconnected";
  private subscribedChannels = new Set<string>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelayMs = 1000;
  private readonly maxReconnectDelayMs = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly replayBufferByChannel = new Map<string, WSEventEnvelope[]>();
  private readonly lastEventIdByChannel = new Map<string, string>();
  private lastEventId: string | null = null;
  private currentUrl: string | null = null;
  private currentToken: string | null = null;

  public constructor(
    private readonly websocketFactory: WebSocketFactory = WebSocket,
    private readonly fallbackClient: InMemoryWSClient | null = null,
    private readonly options: BrowserWSClientOptions = {},
  ) {}

  public connect(url: string, token: string): void {
    this.currentUrl = url;
    this.currentToken = token;
    this.reconnectAttempts = 0;
    this.establishConnection(url, token);
  }

  public disconnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.socket?.close();
    this.socket = null;
    this.currentUrl = null;
    this.currentToken = null;
    this.fallbackClient?.disconnect();
    this.setStatus("disconnected");
  }

  public subscribe(channel: string, handler: EventHandler): () => void {
    const channelHandlers = this.handlers.get(channel) ?? new Set<EventHandler>();
    channelHandlers.add(handler);
    this.handlers.set(channel, channelHandlers);
    this.subscribedChannels.add(channel);
    if (this.socket != null && this.socket.readyState === this.getOpenState()) {
      this.socket.send(JSON.stringify({
        action: "subscribe",
        channel,
        ...(this.lastEventIdByChannel.get(channel) == null
          ? {}
          : { lastEventId: this.lastEventIdByChannel.get(channel) }),
      }));
    }
    this.replayBufferedEvents(channel, handler);
    const fallbackUnsubscribe = this.fallbackClient?.subscribe(channel, handler);
    return () => {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
        this.subscribedChannels.delete(channel);
      }
      fallbackUnsubscribe?.();
    };
  }

  public onStatusChange(handler: (status: WSStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    const fallbackUnsubscribe = this.fallbackClient?.onStatusChange(handler);
    return () => {
      this.statusHandlers.delete(handler);
      fallbackUnsubscribe?.();
    };
  }

  public publish(event: WSEventEnvelope): void {
    this.rememberEvent(event);
    for (const handler of this.handlers.get(event.channel) ?? []) {
      handler(event);
    }
  }

  public useSseFallback(): void {
    this.setStatus("sse-fallback");
    this.fallbackClient?.useSseFallback();
  }

  private establishConnection(url: string, token: string): void {
    this.setStatus("connecting");
    this.clearReconnectTimer();
    this.stopHeartbeat();
    try {
      const socket = new this.websocketFactory(url, "v1.auth.token");
      this.socket = socket;
      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        socket.send(JSON.stringify({
          action: "auth",
          token,
          ...(this.lastEventId == null ? {} : { lastEventId: this.lastEventId }),
        }));
        for (const channel of this.subscribedChannels) {
          socket.send(JSON.stringify({
            action: "subscribe",
            channel,
            ...(this.lastEventIdByChannel.get(channel) == null
              ? {}
              : { lastEventId: this.lastEventIdByChannel.get(channel) }),
          }));
        }
        this.startHeartbeat();
      };
      socket.onmessage = (event) => {
        const data = JSON.parse(String(event.data)) as WSEventEnvelope & { action?: string };
        if (data.action === "pong" || data.type === "pong") {
          this.clearHeartbeatDeadline();
          return;
        }
        this.publish(data);
      };
      socket.onclose = () => {
        this.handleReconnect(url, token);
      };
      socket.onerror = () => {
        this.handleReconnect(url, token);
      };
    } catch {
      this.handleReconnect(url, token);
    }
  }

  private handleReconnect(url: string, token: string): void {
    this.stopHeartbeat();
    this.setStatus("reconnecting");
    if (this.fallbackClient != null) {
      this.fallbackClient.connect(url, token);
    }
    this.scheduleReconnect();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const intervalMs = this.options.heartbeatIntervalMs ?? 15000;
    const timeoutMs = this.options.heartbeatTimeoutMs ?? 5000;
    this.heartbeatTimer = setInterval(() => {
      if (this.socket == null || this.socket.readyState !== this.getOpenState()) {
        return;
      }
      this.socket.send(JSON.stringify({ action: "ping" }));
      this.clearHeartbeatDeadline();
      this.heartbeatDeadlineTimer = setTimeout(() => {
        this.socket?.close();
      }, timeoutMs);
      detachTimer(this.heartbeatDeadlineTimer);
    }, intervalMs);
    detachTimer(this.heartbeatTimer);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatDeadline();
  }

  private clearHeartbeatDeadline(): void {
    if (this.heartbeatDeadlineTimer != null) {
      clearTimeout(this.heartbeatDeadlineTimer);
      this.heartbeatDeadlineTimer = null;
    }
  }

  private calculateReconnectDelay(): number {
    const exponentialDelay = Math.min(
      this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs,
    );
    const jitter = exponentialDelay * (Math.random() * 0.3 - 0.15);
    return Math.floor(exponentialDelay + jitter);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("disconnected");
      return;
    }
    const delay = this.calculateReconnectDelay();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts += 1;
      if (this.currentUrl != null && this.currentToken != null) {
        this.establishConnection(this.currentUrl, this.currentToken);
      }
    }, delay);
    detachTimer(this.reconnectTimer);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getOpenState(): number {
    return typeof WebSocket !== "undefined" ? WebSocket.OPEN : 1;
  }

  private replayBufferedEvents(channel: string, handler: EventHandler): void {
    for (const event of this.replayBufferByChannel.get(channel) ?? []) {
      queueMicrotask(() => {
        handler(event);
      });
    }
  }

  private rememberEvent(event: WSEventEnvelope): void {
    const eventId = this.resolveEventId(event);
    if (eventId != null) {
      this.lastEventId = eventId;
      this.lastEventIdByChannel.set(event.channel, eventId);
    }
    const replayBufferSize = this.options.replayBufferSize ?? 25;
    const nextBuffer = [...(this.replayBufferByChannel.get(event.channel) ?? []), event].slice(-replayBufferSize);
    this.replayBufferByChannel.set(event.channel, nextBuffer);
  }

  private resolveEventId(event: WSEventEnvelope): string | null {
    if (typeof event.eventId === "string" && event.eventId.length > 0) {
      return event.eventId;
    }
    if (event.payload != null && typeof event.payload === "object") {
      const payload = event.payload as Record<string, unknown>;
      const candidate = payload.eventId ?? payload.id;
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }
    return null;
  }

  private setStatus(status: WSStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}

export class SharedWorkerWSClient implements WSClient {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly statusHandlers = new Set<(status: WSStatus) => void>();
  private readonly port: MessagePort;
  private readonly replayBufferByChannel = new Map<string, WSEventEnvelope[]>();

  public constructor(worker: SharedWorkerLike) {
    this.port = worker.port;
    this.port.addEventListener("message", this.handleMessage);
    this.port.start();
  }

  public connect(url: string, token: string): void {
    this.port.postMessage({ action: "connect", url, token });
  }

  public disconnect(): void {
    this.port.postMessage({ action: "disconnect" });
  }

  public subscribe(channel: string, handler: EventHandler): () => void {
    const channelHandlers = this.handlers.get(channel) ?? new Set<EventHandler>();
    const wasEmpty = channelHandlers.size === 0;
    channelHandlers.add(handler);
    this.handlers.set(channel, channelHandlers);
    if (wasEmpty) {
      this.port.postMessage({ action: "subscribe", channel });
    }
    for (const event of this.replayBufferByChannel.get(channel) ?? []) {
      queueMicrotask(() => {
        handler(event);
      });
    }
    return () => {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
      }
    };
  }

  public onStatusChange(handler: (status: WSStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  public publish(event: WSEventEnvelope): void {
    this.port.postMessage({ action: "publish", event });
  }

  public useSseFallback(): void {
    this.port.postMessage({ action: "useSseFallback" });
  }

  private readonly handleMessage = (event: MessageEvent<WorkerMessage>): void => {
    const message = event.data;
    if (message.type === "status") {
      for (const handler of this.statusHandlers) {
        handler(message.status);
      }
      return;
    }
    const nextBuffer = [...(this.replayBufferByChannel.get(message.event.channel) ?? []), message.event].slice(-25);
    this.replayBufferByChannel.set(message.event.channel, nextBuffer);
    for (const handler of this.handlers.get(message.event.channel) ?? []) {
      handler(message.event);
    }
  };
}

export function createRuntimeWSClient(
  socketFactory?: WebSocketFactory,
  sharedWorkerFactory?: SharedWorkerFactory,
): WSClient {
  if (typeof SharedWorker !== "undefined" && sharedWorkerFactory != null) {
    return new SharedWorkerWSClient(sharedWorkerFactory());
  }
  if (typeof WebSocket !== "undefined" || socketFactory != null) {
    return new BrowserWSClient(socketFactory ?? WebSocket, new InMemoryWSClient());
  }
  return new InMemoryWSClient();
}
