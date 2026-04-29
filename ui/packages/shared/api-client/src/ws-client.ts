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

  public constructor(
    private readonly websocketFactory: WebSocketFactory = WebSocket,
    private readonly fallbackClient: InMemoryWSClient | null = null,
  ) {}

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
      };
      socket.onmessage = (event) => {
        const data = JSON.parse(String(event.data)) as WSEventEnvelope;
        this.publish(data);
      };
      socket.onclose = () => {
        this.setStatus("reconnecting");
        this.scheduleReconnect();
      };
      socket.onerror = () => {
        this.setStatus("reconnecting");
        this.scheduleReconnect();
        if (this.fallbackClient != null) {
          this.fallbackClient.connect(url, token);
        }
      };
    } catch {
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
}

export function createRuntimeWSClient(socketFactory?: WebSocketFactory): WSClient {
  if (typeof WebSocket !== "undefined") {
    return new BrowserWSClient(socketFactory ?? WebSocket, new InMemoryWSClient());
  }
  return new InMemoryWSClient();
}
