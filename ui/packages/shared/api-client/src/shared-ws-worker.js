const ports = new Set();
const subscribedChannels = new Set();
let socket = null;
let currentUrl = null;
let currentToken = null;
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
    for (const port of ports) {
        port.postMessage(message);
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
            const data = JSON.parse(String(event.data));
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
    if (currentUrl == null || currentToken == null || ports.size === 0) {
        return;
    }
    if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
    }
    const delay = calculateBackoffDelay();
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (currentUrl != null && currentToken != null && ports.size > 0) {
            connectSocket(currentUrl, currentToken);
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
    currentUrl = null;
    currentToken = null;
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
        ports.add(port);
        port.start();
        port.postMessage({ type: "status", status: socket?.readyState === WebSocket.OPEN ? "connected" : "disconnected" });
        port.onmessage = (event) => {
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
                    port.postMessage({ type: "event", event: replayEvent });
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
