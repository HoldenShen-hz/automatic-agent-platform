type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";

interface WorkerSocketEvent {
  readonly channel: string;
  readonly type: string;
  readonly payload: unknown;
  readonly eventId?: string;
}

type WorkerCommand =
  | { readonly action: "connect"; readonly url: string; readonly token: string }
  | { readonly action: "disconnect" }
  | { readonly action: "subscribe"; readonly channel: string }
  | { readonly action: "publish"; readonly event: WorkerSocketEvent }
  | { readonly action: "useSseFallback" };

type WorkerOutboundMessage =
  | { readonly type: "status"; readonly status: WSStatus }
  | { readonly type: "event"; readonly event: WorkerSocketEvent };

type SharedWorkerConnectEvent = MessageEvent & { readonly ports: readonly MessagePort[] };

declare const self: typeof globalThis & {
  onconnect: ((event: SharedWorkerConnectEvent) => void) | null;
};

const ports = new Set<MessagePort>();
const subscribedChannels = new Set<string>();
let socket: WebSocket | null = null;
let currentUrl: string | null = null;
let currentToken: string | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
const baseReconnectDelayMs = 1000;
const maxReconnectDelayMs = 30000;
const heartbeatIntervalMs = 15000;
const heartbeatTimeoutMs = 5000;
const replayBufferByChannel = new Map<string, WorkerSocketEvent[]>();
const lastEventIdByChannel = new Map<string, string>();
let lastEventId: string | null = null;

function isTrustedReplayEventId(value: unknown): value is string {
  return typeof value === "string" && /^evt[-_][A-Za-z0-9:-]{3,}$/.test(value);
}

function resolveTrustedReplayEventId(event: WorkerSocketEvent): string | null {
  if (isTrustedReplayEventId(event.eventId)) {
    return event.eventId;
  }
  if (event.payload != null && typeof event.payload === "object") {
    const payload = event.payload as Record<string, unknown>;
    if (isTrustedReplayEventId(payload.eventId)) {
      return payload.eventId;
    }
    if (isTrustedReplayEventId(payload.id)) {
      return payload.id;
    }
  }
  return null;
}

function broadcast(message: WorkerOutboundMessage): void {
  for (const port of ports) {
    port.postMessage(message);
  }
}

function setStatus(status: WSStatus): void {
  broadcast({ type: "status", status });
}

function clearHeartbeatDeadline(): void {
  if (heartbeatDeadlineTimer != null) {
    clearTimeout(heartbeatDeadlineTimer);
    heartbeatDeadlineTimer = null;
  }
}

function stopHeartbeat(): void {
  if (heartbeatTimer != null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  clearHeartbeatDeadline();
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket == null || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ action: "ping" }));
    clearHeartbeatDeadline();
    heartbeatDeadlineTimer = setTimeout(() => {
      socket?.close();
    }, heartbeatTimeoutMs);
  }, heartbeatIntervalMs);
}

function calculateBackoffDelay(): number {
  const exponentialDelay = Math.min(
    baseReconnectDelayMs * Math.pow(2, reconnectAttempt),
    maxReconnectDelayMs,
  );
  const jitter = exponentialDelay * (Math.random() * 0.3 - 0.15);
  return Math.floor(exponentialDelay + jitter);
}

function connectSocket(url: string, token: string): void {
  currentUrl = url;
  currentToken = token;
  setStatus("connecting");
  stopHeartbeat();

  try {
    socket = new WebSocket(url, "v1.auth.token");
    socket.onopen = () => {
      reconnectAttempt = 0;
      setStatus("connected");
      socket?.send(JSON.stringify({
        action: "auth",
        token,
        ...(lastEventId == null ? {} : { lastEventId }),
      }));
      for (const channel of subscribedChannels) {
        socket?.send(JSON.stringify({
          action: "subscribe",
          channel,
          ...(lastEventIdByChannel.get(channel) == null
            ? {}
            : { lastEventId: lastEventIdByChannel.get(channel) }),
        }));
      }
      startHeartbeat();
    };
    socket.onmessage = (event) => {
      const data = JSON.parse(String(event.data)) as WorkerSocketEvent & { action?: string };
      if (data.action === "pong" || data.type === "pong") {
        clearHeartbeatDeadline();
        return;
      }
      if (resolveTrustedReplayEventId(data) == null && (data.eventId != null || (typeof data.payload === "object" && data.payload !== null && ("eventId" in data.payload || "id" in data.payload)))) {
        return;
      }
      rememberEvent(data);
      broadcast({ type: "event", event: data });
    };
    socket.onclose = () => {
      stopHeartbeat();
      setStatus("reconnecting");
      scheduleReconnect();
    };
    socket.onerror = () => {
      stopHeartbeat();
      setStatus("reconnecting");
      scheduleReconnect();
    };
  } catch {
    setStatus("reconnecting");
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (currentUrl == null || currentToken == null || ports.size === 0) {
    return;
  }
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer);
  }
  const delay = calculateBackoffDelay();
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    if (currentUrl != null && currentToken != null && ports.size > 0) {
      connectSocket(currentUrl, currentToken);
    }
  }, delay);
}

function disconnectSocket(): void {
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopHeartbeat();
  reconnectAttempt = 0;
  currentUrl = null;
  currentToken = null;
  socket?.close();
  socket = null;
  setStatus("disconnected");
}

function rememberEvent(event: WorkerSocketEvent): void {
  const resolvedEventId = resolveTrustedReplayEventId(event);
  if (resolvedEventId != null) {
    lastEventId = resolvedEventId;
    lastEventIdByChannel.set(event.channel, resolvedEventId);
  }
  const nextBuffer = [...(replayBufferByChannel.get(event.channel) ?? []), event].slice(-25);
  replayBufferByChannel.set(event.channel, nextBuffer);
}

self.onconnect = (connectionEvent: SharedWorkerConnectEvent) => {
  const port = connectionEvent.ports[0];
  if (port == null) {
    return;
  }
  ports.add(port);
  port.start();
  port.postMessage({ type: "status", status: socket?.readyState === WebSocket.OPEN ? "connected" : "disconnected" } satisfies WorkerOutboundMessage);

  port.onmessage = (event: MessageEvent<WorkerCommand>) => {
    const message = event.data;
    if (message.action === "connect") {
      if (socket == null || currentUrl !== message.url || currentToken !== message.token) {
        connectSocket(message.url, message.token);
      }
      return;
    }
    if (message.action === "disconnect") {
      ports.delete(port);
      if (ports.size === 0) {
        disconnectSocket();
      }
      return;
    }
    if (message.action === "subscribe") {
      subscribedChannels.add(message.channel);
      if (socket != null && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          action: "subscribe",
          channel: message.channel,
          ...(lastEventIdByChannel.get(message.channel) == null
            ? {}
            : { lastEventId: lastEventIdByChannel.get(message.channel) }),
        }));
      }
      for (const replayEvent of replayBufferByChannel.get(message.channel) ?? []) {
        port.postMessage({ type: "event", event: replayEvent } satisfies WorkerOutboundMessage);
      }
      return;
    }
    if (message.action === "publish") {
      rememberEvent(message.event);
      broadcast({ type: "event", event: message.event });
      return;
    }
    if (message.action === "useSseFallback") {
      setStatus("sse-fallback");
    }
  };
};

export {};
