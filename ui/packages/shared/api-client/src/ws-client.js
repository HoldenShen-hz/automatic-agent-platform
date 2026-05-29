function detachTimer(timer) {
    if (typeof timer === "object" && timer !== null && "unref" in timer && typeof timer.unref === "function") {
        timer.unref();
    }
}
function isTrustedReplayEventId(value) {
    return typeof value === "string" && /^evt[-_][A-Za-z0-9:_-]{1,}$/.test(value);
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
export class InMemoryWSClient {
    handlers = new Map();
    statusHandlers = new Set();
    status = "disconnected";
    connect(_url, _token) {
        this.setStatus("connected");
    }
    disconnect() {
        this.setStatus("disconnected");
    }
    subscribe(channel, handler) {
        const channelHandlers = this.handlers.get(channel) ?? new Set();
        channelHandlers.add(handler);
        this.handlers.set(channel, channelHandlers);
        return () => {
            channelHandlers.delete(handler);
            if (channelHandlers.size === 0) {
                this.handlers.delete(channel);
            }
        };
    }
    onStatusChange(handler) {
        this.statusHandlers.add(handler);
        handler(this.status);
        return () => this.statusHandlers.delete(handler);
    }
    publish(event) {
        for (const handler of this.handlers.get(event.channel) ?? []) {
            handler(event);
        }
    }
    useSseFallback() {
        this.setStatus("sse-fallback");
    }
    setStatus(status) {
        this.status = status;
        for (const handler of this.statusHandlers) {
            handler(status);
        }
    }
}
export class BrowserWSClient {
    websocketFactory;
    fallbackClient;
    options;
    handlers = new Map();
    statusHandlers = new Set();
    socket = null;
    status = "disconnected";
    subscribedChannels = new Set();
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    baseReconnectDelayMs = 1000;
    maxReconnectDelayMs = 30000;
    reconnectTimer = null;
    heartbeatTimer = null;
    heartbeatDeadlineTimer = null;
    replayBufferByChannel = new Map();
    lastEventIdByChannel = new Map();
    lastEventId = null;
    currentUrl = null;
    currentToken = null;
    activeSocketNonce = 0;
    manualDisconnect = false;
    constructor(websocketFactory = WebSocket, fallbackClient = null, options = {}) {
        this.websocketFactory = websocketFactory;
        this.fallbackClient = fallbackClient;
        this.options = options;
    }
    connect(url, token) {
        this.manualDisconnect = false;
        this.currentUrl = url;
        this.currentToken = token;
        this.reconnectAttempts = 0;
        this.establishConnection(url, token);
    }
    disconnect() {
        this.manualDisconnect = true;
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this.reconnectAttempts = this.maxReconnectAttempts;
        const socket = this.socket;
        this.socket = null;
        this.currentUrl = null;
        this.currentToken = null;
        socket?.close();
        this.fallbackClient?.disconnect();
        this.setStatus("disconnected");
    }
    subscribe(channel, handler) {
        const channelHandlers = this.handlers.get(channel) ?? new Set();
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
    onStatusChange(handler) {
        this.statusHandlers.add(handler);
        handler(this.status);
        const fallbackUnsubscribe = this.fallbackClient?.onStatusChange(handler);
        return () => {
            this.statusHandlers.delete(handler);
            fallbackUnsubscribe?.();
        };
    }
    publish(event) {
        this.rememberEvent(event);
        for (const handler of this.handlers.get(event.channel) ?? []) {
            handler(event);
        }
    }
    useSseFallback() {
        this.setStatus("sse-fallback");
        this.fallbackClient?.useSseFallback();
    }
    establishConnection(url, token) {
        this.setStatus("connecting");
        this.clearReconnectTimer();
        this.stopHeartbeat();
        try {
            const socket = new this.websocketFactory(url, "v1.auth.token");
            const socketNonce = ++this.activeSocketNonce;
            this.socket = socket;
            socket.onopen = () => {
                if (!this.isActiveSocket(socket, socketNonce)) {
                    return;
                }
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
                if (!this.isActiveSocket(socket, socketNonce)) {
                    return;
                }
                const data = JSON.parse(String(event.data));
                if (data.action === "pong" || data.type === "pong") {
                    this.clearHeartbeatDeadline();
                    return;
                }
                if (resolveTrustedReplayEventId(data) == null && (data.eventId != null || (typeof data.payload === "object" && data.payload !== null && ("eventId" in data.payload || "id" in data.payload)))) {
                    return;
                }
                this.publish(data);
            };
            socket.onclose = (event) => {
                if (!this.isActiveSocket(socket, socketNonce)) {
                    return;
                }
                this.handleReconnect(url, token, event?.code);
            };
            socket.onerror = () => {
                if (!this.isActiveSocket(socket, socketNonce)) {
                    return;
                }
                if (socket.readyState === this.getConnectingState() || socket.readyState === this.getOpenState()) {
                    socket.close();
                    return;
                }
                this.handleReconnect(url, token);
            };
        }
        catch {
            this.handleReconnect(url, token);
        }
    }
    handleReconnect(url, token, closeCode) {
        if (this.manualDisconnect || this.currentUrl == null || this.currentToken == null) {
            return;
        }
        this.stopHeartbeat();
        if (closeCode === 4001 || closeCode === 4003) {
            this.setStatus("disconnected");
            return;
        }
        this.setStatus("reconnecting");
        if (this.fallbackClient != null) {
            this.fallbackClient.disconnect();
            this.fallbackClient.connect(url, token);
        }
        this.scheduleReconnect();
    }
    startHeartbeat() {
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
    stopHeartbeat() {
        if (this.heartbeatTimer != null) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.clearHeartbeatDeadline();
    }
    clearHeartbeatDeadline() {
        if (this.heartbeatDeadlineTimer != null) {
            clearTimeout(this.heartbeatDeadlineTimer);
            this.heartbeatDeadlineTimer = null;
        }
    }
    calculateReconnectDelay() {
        const exponentialDelay = Math.min(this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelayMs);
        if (this.reconnectAttempts === 0) {
            return exponentialDelay;
        }
        const jitter = exponentialDelay * (this.options.random?.() ?? Math.random()) * 0.3;
        return Math.min(this.maxReconnectDelayMs, Math.floor(exponentialDelay + jitter));
    }
    scheduleReconnect() {
        if (this.reconnectTimer != null) {
            return;
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.setStatus("disconnected");
            return;
        }
        const delay = this.calculateReconnectDelay();
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts += 1;
            if (this.currentUrl != null && this.currentToken != null) {
                this.establishConnection(this.currentUrl, this.currentToken);
            }
        }, delay);
        detachTimer(this.reconnectTimer);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer != null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    getOpenState() {
        return typeof WebSocket !== "undefined" ? WebSocket.OPEN : 1;
    }
    getConnectingState() {
        return typeof WebSocket !== "undefined" ? WebSocket.CONNECTING : 0;
    }
    replayBufferedEvents(channel, handler) {
        for (const event of this.replayBufferByChannel.get(channel) ?? []) {
            queueMicrotask(() => {
                handler(event);
            });
        }
    }
    rememberEvent(event) {
        const eventId = this.resolveEventId(event);
        if (eventId != null) {
            this.lastEventId = eventId;
            this.lastEventIdByChannel.set(event.channel, eventId);
        }
        const replayBufferSize = this.options.replayBufferSize ?? 25;
        const nextBuffer = [...(this.replayBufferByChannel.get(event.channel) ?? []), event].slice(-replayBufferSize);
        this.replayBufferByChannel.set(event.channel, nextBuffer);
    }
    resolveEventId(event) {
        return resolveTrustedReplayEventId(event);
    }
    setStatus(status) {
        this.status = status;
        for (const handler of this.statusHandlers) {
            handler(status);
        }
    }
    isActiveSocket(socket, socketNonce) {
        return this.socket === socket && this.activeSocketNonce === socketNonce;
    }
}
export class SharedWorkerWSClient {
    handlers = new Map();
    statusHandlers = new Set();
    port;
    replayBufferByChannel = new Map();
    disconnected = false;
    disconnectTimer = null;
    constructor(worker) {
        this.port = worker.port;
        this.port.addEventListener("message", this.handleMessage);
        this.port.start();
    }
    connect(url, token) {
        this.disconnected = false;
        if (this.disconnectTimer != null) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = null;
        }
        this.port.postMessage({ action: "connect", url, token });
    }
    disconnect() {
        this.disconnected = true;
        this.port.postMessage({ action: "disconnect" });
        if (this.disconnectTimer != null) {
            clearTimeout(this.disconnectTimer);
        }
        // Give the shared worker one macrotask to process queued publish/disconnect
        // messages before we detach and close the port.
        this.disconnectTimer = setTimeout(() => {
            this.port.removeEventListener("message", this.handleMessage);
            this.replayBufferByChannel.clear();
            this.handlers.clear();
            this.statusHandlers.clear();
            this.port.close();
            this.disconnectTimer = null;
        }, 0);
    }
    subscribe(channel, handler) {
        const channelHandlers = this.handlers.get(channel) ?? new Set();
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
    onStatusChange(handler) {
        this.statusHandlers.add(handler);
        return () => this.statusHandlers.delete(handler);
    }
    publish(event) {
        this.port.postMessage({ action: "publish", event });
    }
    useSseFallback() {
        this.port.postMessage({ action: "useSseFallback" });
    }
    handleMessage = (event) => {
        if (this.disconnected) {
            return;
        }
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
export function createRuntimeWSClient(socketFactory, sharedWorkerFactory) {
    if (typeof SharedWorker !== "undefined" && sharedWorkerFactory != null) {
        return new SharedWorkerWSClient(sharedWorkerFactory());
    }
    if (typeof WebSocket !== "undefined" || socketFactory != null) {
        return new BrowserWSClient(socketFactory ?? WebSocket, new InMemoryWSClient());
    }
    return new InMemoryWSClient();
}
