type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";

interface WorkerSocketEvent {
  readonly channel: string;
  readonly type: string;
  readonly payload: unknown;
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

declare const self: SharedWorkerGlobalScope & typeof globalThis;

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
      socket?.send(JSON.stringify({ action: "auth", token }));
      for (const channel of subscribedChannels) {
        socket?.send(JSON.stringify({ action: "subscribe", channel }));
      }
      startHeartbeat();
    };
    socket.onmessage = (event) => {
      const data = JSON.parse(String(event.data)) as WorkerSocketEvent & { action?: string };
      if (data.action === "pong" || data.type === "pong") {
        clearHeartbeatDeadline();
        return;
      }
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

self.onconnect = (connectionEvent) => {
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
        socket.send(JSON.stringify({ action: "subscribe", channel: message.channel }));
      }
      return;
    }
    if (message.action === "publish") {
      broadcast({ type: "event", event: message.event });
      return;
    }
    if (message.action === "useSseFallback") {
      setStatus("sse-fallback");
    }
  };
};

export {};
