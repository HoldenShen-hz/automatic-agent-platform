type WSStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";

interface WorkerSocketEvent {
  readonly channel: string;
  readonly type: string;
  readonly payload: unknown;
  readonly eventId?: string;
}

type WorkerCommand =
  | { readonly action: "connect"; readonly capability: string; readonly url: string; readonly token: string }
  | { readonly action: "disconnect"; readonly capability: string }
  | { readonly action: "subscribe"; readonly capability: string; readonly channel: string }
  | { readonly action: "publish"; readonly capability: string; readonly event: WorkerSocketEvent }
  | { readonly action: "useSseFallback"; readonly capability: string };

type WorkerOutboundMessage =
  | { readonly capability: string; readonly type: "status"; readonly status: WSStatus }
  | { readonly capability: string; readonly type: "event"; readonly event: WorkerSocketEvent };

type SharedWorkerConnectEvent = MessageEvent & { readonly ports: readonly MessagePort[] };

declare const self: typeof globalThis & {
  onconnect: ((event: SharedWorkerConnectEvent) => void) | null;
};

interface WorkerPortState {
  readonly port: MessagePort;
  capability: string | null;
  desiredUrl: string | null;
  desiredToken: string | null;
  subscribedChannels: Set<string>;
}

const portStates = new Map<MessagePort, WorkerPortState>();
const subscribedChannels = new Set<string>();
let socket: WebSocket | null = null;
let activeSocketConfig: { url: string; token: string } | null = null;
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
const WORKER_CAPABILITY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/u;

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

function isValidCapability(value: unknown): value is string {
  return typeof value === "string" && WORKER_CAPABILITY_PATTERN.test(value);
}

function getPortState(port: MessagePort): WorkerPortState {
  const existing = portStates.get(port);
  if (existing != null) {
    return existing;
  }
  const created: WorkerPortState = {
    port,
    capability: null,
    desiredUrl: null,
    desiredToken: null,
    subscribedChannels: new Set<string>(),
  };
  portStates.set(port, created);
  return created;
}

function withCapability(
  port: MessagePort,
  message: Omit<WorkerOutboundMessage, "capability">,
): WorkerOutboundMessage | null {
  const capability = portStates.get(port)?.capability;
  if (capability == null) {
    return null;
  }
  return { capability, ...message };
}

function broadcast(message: Omit<WorkerOutboundMessage, "capability">): void {
  for (const port of portStates.keys()) {
    const scoped = withCapability(port, message);
    if (scoped != null) {
      port.postMessage(scoped);
    }
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
  activeSocketConfig = { url, token };
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
      let data: WorkerSocketEvent & { action?: string };
      try {
        data = JSON.parse(String(event.data)) as WorkerSocketEvent & { action?: string };
      } catch {
        disconnectSocket();
        return;
      }
      if (data.action === "pong" || data.type === "pong") {
        clearHeartbeatDeadline();
        return;
      }
      if (
        resolveTrustedReplayEventId(data) == null
        && (
          data.eventId != null
          || (typeof data.payload === "object" && data.payload !== null && ("eventId" in data.payload || "id" in data.payload))
        )
      ) {
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
  if (activeSocketConfig == null || portStates.size === 0) {
    return;
  }
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer);
  }
  const delay = calculateBackoffDelay();
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (activeSocketConfig != null && portStates.size > 0) {
      connectSocket(activeSocketConfig.url, activeSocketConfig.token);
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
  activeSocketConfig = null;
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

function recomputeSubscribedChannels(): void {
  subscribedChannels.clear();
  for (const state of portStates.values()) {
    for (const channel of state.subscribedChannels) {
      subscribedChannels.add(channel);
    }
  }
}

export function installSharedWorkerSocketRuntime(
  sharedWorkerGlobal: typeof self = self,
): void {
  sharedWorkerGlobal.onconnect = (connectionEvent: SharedWorkerConnectEvent) => {
    const port = connectionEvent.ports[0];
    if (port == null) {
      return;
    }
    getPortState(port);
    port.start();

    port.onmessage = (event: MessageEvent<WorkerCommand>) => {
      const message = event.data;
      if (!isValidCapability(message.capability)) {
        return;
      }
      const state = getPortState(port);
      if (state.capability != null && state.capability !== message.capability) {
        return;
      }
      state.capability = message.capability;

      if (message.action === "connect") {
        state.desiredUrl = message.url;
        state.desiredToken = message.token;
        if (activeSocketConfig == null) {
          connectSocket(message.url, message.token);
          return;
        }
        if (activeSocketConfig.url === message.url && activeSocketConfig.token === message.token) {
          if (socket == null || socket.readyState !== WebSocket.OPEN) {
            connectSocket(message.url, message.token);
          }
        }
        return;
      }

      if (message.action === "disconnect") {
        portStates.delete(port);
        recomputeSubscribedChannels();
        if (portStates.size === 0) {
          disconnectSocket();
        }
        return;
      }

      if (message.action === "subscribe") {
        const hadChannel = subscribedChannels.has(message.channel);
        state.subscribedChannels.add(message.channel);
        recomputeSubscribedChannels();
        if (socket != null && socket.readyState === WebSocket.OPEN && !hadChannel) {
          socket.send(JSON.stringify({
            action: "subscribe",
            channel: message.channel,
            ...(lastEventIdByChannel.get(message.channel) == null
              ? {}
              : { lastEventId: lastEventIdByChannel.get(message.channel) }),
          }));
        }
        for (const replayEvent of replayBufferByChannel.get(message.channel) ?? []) {
          const outbound = withCapability(port, { type: "event", event: replayEvent });
          if (outbound != null) {
            port.postMessage(outbound);
          }
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

    const initialStatus = withCapability(port, {
      type: "status",
      status: socket?.readyState === WebSocket.OPEN ? "connected" : "disconnected",
    });
    if (initialStatus != null) {
      port.postMessage(initialStatus);
    }
  };
}

if (typeof self !== "undefined") {
  installSharedWorkerSocketRuntime();
}
