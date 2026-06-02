const WORKER_CAPABILITY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/u;
const portStates = new Map();
const subscribedChannels = new Set();
let socket = null;
let activeSocketConfig = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let heartbeatDeadlineTimer = null;
const baseReconnectDelayMs = 1000;
const maxReconnectDelayMs = 30000;
const heartbeatIntervalMs = 15000;
const heartbeatTimeoutMs = 5000;
const replayBufferByChannel = new Map();
const lastEventIdByChannel = new Map();
let lastEventId = null;
function isValidCapability(value) {
    return typeof value === "string" && WORKER_CAPABILITY_PATTERN.test(value);
}
function getPortState(port) {
    const existing = portStates.get(port);
    if (existing != null) {
        return existing;
    }
    const created = {
        port,
        capability: null,
        desiredUrl: null,
        desiredToken: null,
        subscribedChannels: new Set(),
    };
    portStates.set(port, created);
    return created;
}
function withCapability(port, message) {
    const capability = portStates.get(port)?.capability;
    if (capability == null) {
        return null;
    }
    return { capability, ...message };
}
function isTrustedReplayEventId(value) {
    return typeof value === "string" && /^evt[-_][A-Za-z0-9:-]{3,}$/.test(value);
}
function resolveTrustedReplayEventId(event) {
    if (isTrustedReplayEventId(event.eventId)) {
        return event.eventId;
    }
    if (event.payload != null && typeof event.payload === "object") {
        const payload = event.payload;
        if (isTrustedReplayEventId(payload.eventId)) {
            return payload.eventId;
        }
        if (isTrustedReplayEventId(payload.id)) {
            return payload.id;
        }
    }
    return null;
}
function broadcast(message) {
    for (const port of portStates.keys()) {
        const scoped = withCapability(port, message);
        if (scoped != null) {
            port.postMessage(scoped);
        }
    }
}
function setStatus(status) {
    broadcast({ type: "status", status });
}
function clearHeartbeatDeadline() {
    if (heartbeatDeadlineTimer != null) {
        clearTimeout(heartbeatDeadlineTimer);
        heartbeatDeadlineTimer = null;
    }
}
function stopHeartbeat() {
    if (heartbeatTimer != null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    clearHeartbeatDeadline();
}
function startHeartbeat() {
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
function calculateBackoffDelay() {
    const exponentialDelay = Math.min(baseReconnectDelayMs * Math.pow(2, reconnectAttempt), maxReconnectDelayMs);
    const jitter = exponentialDelay * (Math.random() * 0.3 - 0.15);
    return Math.floor(exponentialDelay + jitter);
}
function connectSocket(url, token) {
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
            let data;
            try {
                data = JSON.parse(String(event.data));
            }
            catch {
                disconnectSocket();
                return;
            }
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
    }
    catch {
        setStatus("reconnecting");
        scheduleReconnect();
    }
}
function scheduleReconnect() {
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
function disconnectSocket() {
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
function rememberEvent(event) {
    const resolvedEventId = resolveTrustedReplayEventId(event);
    if (resolvedEventId != null) {
        lastEventId = resolvedEventId;
        lastEventIdByChannel.set(event.channel, resolvedEventId);
    }
    const nextBuffer = [...(replayBufferByChannel.get(event.channel) ?? []), event].slice(-25);
    replayBufferByChannel.set(event.channel, nextBuffer);
}
export function installSharedWorkerSocketRuntime(sharedWorkerGlobal = self) {
    sharedWorkerGlobal.onconnect = (connectionEvent) => {
        const port = connectionEvent.ports[0];
        if (port == null) {
            return;
        }
        const portState = getPortState(port);
        port.start();
        port.postMessage(withCapability(port, { type: "status", status: socket?.readyState === WebSocket.OPEN ? "connected" : "disconnected" }) ?? { type: "status", status: socket?.readyState === WebSocket.OPEN ? "connected" : "disconnected" });
        port.onmessage = (event) => {
            const message = event.data;
            if (typeof message !== "object" || message == null || !("action" in message) || !isValidCapability(message.capability)) {
                return;
            }
            if (portState.capability == null) {
                portState.capability = message.capability;
            }
            if (message.capability !== portState.capability) {
                return;
            }
            if (message.action === "connect") {
                portState.desiredUrl = message.url;
                portState.desiredToken = message.token;
                if (socket == null || activeSocketConfig?.url !== message.url || activeSocketConfig?.token !== message.token) {
                    connectSocket(message.url, message.token);
                }
                return;
            }
            if (message.action === "disconnect") {
                portStates.delete(port);
                if (portStates.size === 0) {
                    disconnectSocket();
                }
                return;
            }
            if (message.action === "subscribe") {
                portState.subscribedChannels.add(message.channel);
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
                    const replayMessage = withCapability(port, { type: "event", event: replayEvent });
                    if (replayMessage != null) {
                        port.postMessage(replayMessage);
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
    };
}
if ("onconnect" in self) {
    installSharedWorkerSocketRuntime();
}
