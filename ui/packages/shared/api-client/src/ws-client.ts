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

export interface WebSocketFactory {
  new(url: string, protocols?: string | string[]): WebSocket;
}

export interface BrowserWSClientOptions {
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}

export interface SharedWorkerLike {
  readonly port: MessagePort;
}

export type SharedWorkerFactory = () => SharedWorkerLike;

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
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentUrl: string | null = null;
  private currentToken: string | null = null;
  private readonly maxReconnectDelayMs = 30000;
  private readonly baseReconnectDelayMs = 1000;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatDeadlineTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    private readonly websocketFactory: WebSocketFactory = WebSocket,
    private readonly fallbackClient: InMemoryWSClient | null = null,
    options: BrowserWSClientOptions = {},
  ) {
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 5000;
  }

  private calculateBackoffDelay(): number {
    const exponentialDelay = Math.min(
      this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelayMs,
    );
    const jitter = exponentialDelay * (Math.random() * 0.3 - 0.15);
    return Math.floor(exponentialDelay + jitter);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
    }
    const delay = this.calculateBackoffDelay();
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      if (this.currentUrl != null && this.currentToken != null) {
        this.doConnect(this.currentUrl, this.currentToken);
      }
    }, delay);
  }

  private doConnect(url: string, token: string): void {
    this.setStatus("connecting");
    this.stopHeartbeat();
    try {
      // §6.5.4: Use WebSocket subprotocol for auth - token must not appear in URL (avoid CDN/proxy log exposure)
      const socket = new this.websocketFactory(url, "v1.auth.token");
      this.socket = socket;
      socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus("connected");
        // §6.5.4: Send auth token in first message after connection, not in URL
        socket.send(JSON.stringify({ action: "auth", token }));
        for (const channel of this.subscribedChannels) {
          socket.send(JSON.stringify({ action: "subscribe", channel }));
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
        this.stopHeartbeat();
        this.setStatus("reconnecting");
        this.scheduleReconnect();
      };
      socket.onerror = () => {
        this.stopHeartbeat();
        this.setStatus("reconnecting");
        this.scheduleReconnect();
        if (this.fallbackClient != null) {
          this.fallbackClient.connect(url, token);
        }
      };
    } catch {
      this.stopHeartbeat();
      this.setStatus("reconnecting");
      this.scheduleReconnect();
      if (this.fallbackClient != null) {
        this.fallbackClient.connect(url, token);
      }
    }
  }

  public connect(url: string, token: string): void {
    this.currentUrl = url;
    this.currentToken = token;
    this.reconnectAttempt = 0;
    this.doConnect(url, token);
  }

  public disconnect(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.reconnectAttempt = 0;
    this.currentUrl = null;
    this.currentToken = null;
    this.socket?.close();
    this.socket = null;
    this.fallbackClient?.disconnect();
    this.setStatus("disconnected");
  }

  public subscribe(channel: string, handler: EventHandler): () => void {
    const channelHandlers = this.handlers.get(channel) ?? new Set<EventHandler>();
    channelHandlers.add(handler);
    this.handlers.set(channel, channelHandlers);
    this.subscribedChannels.add(channel);
    if (this.socket != null && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action: "subscribe", channel }));
    }
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
    for (const handler of this.handlers.get(event.channel) ?? []) {
      handler(event);
    }
  }

  public useSseFallback(): void {
    this.setStatus("sse-fallback");
    this.fallbackClient?.useSseFallback();
  }

  private setStatus(status: WSStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatIntervalMs <= 0) {
      return;
    }
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket == null || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }
      this.socket.send(JSON.stringify({ action: "ping" }));
      this.clearHeartbeatDeadline();
      this.heartbeatDeadlineTimer = setTimeout(() => {
        this.socket?.close();
      }, this.heartbeatTimeoutMs);
    }, this.heartbeatIntervalMs);
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
}

type SharedWorkerInboundMessage =
  | { readonly type: "status"; readonly status: WSStatus }
  | { readonly type: "event"; readonly event: WSEventEnvelope };

type SharedWorkerOutboundMessage =
  | { readonly action: "connect"; readonly url: string; readonly token: string }
  | { readonly action: "disconnect" }
  | { readonly action: "subscribe"; readonly channel: string }
  | { readonly action: "publish"; readonly event: WSEventEnvelope }
  | { readonly action: "useSseFallback" };

export class SharedWorkerWSClient implements WSClient {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly statusHandlers = new Set<(status: WSStatus) => void>();
  private readonly subscribedChannels = new Set<string>();
  private status: WSStatus = "disconnected";
  private port: MessagePort | null = null;

  public constructor(private readonly workerFactory: SharedWorkerFactory) {}

  private ensurePort(): MessagePort {
    if (this.port != null) {
      return this.port;
    }
    const worker = this.workerFactory();
    const port = worker.port;
    port.addEventListener("message", this.handleMessage as EventListener);
    port.start?.();
    this.port = port;
    return port;
  }

  private readonly handleMessage = (event: MessageEvent<SharedWorkerInboundMessage>): void => {
    const message = event.data;
    if (message.type === "status") {
      this.setStatus(message.status);
      return;
    }
    this.publish(message.event);
  };

  public connect(url: string, token: string): void {
    const port = this.ensurePort();
    port.postMessage({ action: "connect", url, token } satisfies SharedWorkerOutboundMessage);
    for (const channel of this.subscribedChannels) {
      port.postMessage({ action: "subscribe", channel } satisfies SharedWorkerOutboundMessage);
    }
  }

  public disconnect(): void {
    if (this.port != null) {
      this.port.postMessage({ action: "disconnect" } satisfies SharedWorkerOutboundMessage);
      this.port.removeEventListener("message", this.handleMessage as EventListener);
      this.port.close?.();
      this.port = null;
    }
    this.setStatus("disconnected");
  }

  public subscribe(channel: string, handler: EventHandler): () => void {
    const channelHandlers = this.handlers.get(channel) ?? new Set<EventHandler>();
    channelHandlers.add(handler);
    this.handlers.set(channel, channelHandlers);
    this.subscribedChannels.add(channel);
    if (this.port != null) {
      this.port.postMessage({ action: "subscribe", channel } satisfies SharedWorkerOutboundMessage);
    }
    return () => {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
        this.subscribedChannels.delete(channel);
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
    if (this.port != null) {
      this.port.postMessage({ action: "publish", event } satisfies SharedWorkerOutboundMessage);
    }
  }

  public useSseFallback(): void {
    this.port?.postMessage({ action: "useSseFallback" } satisfies SharedWorkerOutboundMessage);
    this.setStatus("sse-fallback");
  }

  private setStatus(status: WSStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}

export function createRuntimeWSClient(socketFactory?: WebSocketFactory, sharedWorkerFactory?: SharedWorkerFactory): WSClient {
  if (typeof SharedWorker !== "undefined") {
    return new SharedWorkerWSClient(
      sharedWorkerFactory
      ?? (() => new SharedWorker(new URL("./shared-ws-worker.ts", import.meta.url), {
        type: "module",
        name: "aa-shared-ws-client",
      })),
    );
  }
  if (typeof WebSocket !== "undefined") {
    return new BrowserWSClient(socketFactory ?? WebSocket, new InMemoryWSClient());
  }
  return new InMemoryWSClient();
}
