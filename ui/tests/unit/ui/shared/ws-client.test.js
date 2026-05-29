import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryWSClient, BrowserWSClient, SharedWorkerWSClient, createRuntimeWSClient, } from "@aa/shared-api-client";
class FakeSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    sent = [];
    readyState = FakeSocket.OPEN;
    onopen = null;
    onmessage = null;
    onclose = null;
    onerror = null;
    constructor(_url, _protocols) {
        setTimeout(() => {
            this.onopen?.();
        }, 0);
    }
    send(message) {
        this.sent.push(message);
    }
    close() {
        this.readyState = FakeSocket.CLOSED;
        this.onclose?.();
    }
}
describe("InMemoryWSClient", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
    it("connect does not throw and sets connected status", () => {
        const client = new InMemoryWSClient();
        let statusChanged = false;
        client.onStatusChange(() => {
            statusChanged = true;
        });
        client.connect("ws://example.com/ws", "test-token");
        expect(statusChanged).toBe(true);
    });
    it("subscribe adds handler and returns unsubscribe function", () => {
        const client = new InMemoryWSClient();
        const events = [];
        const unsubscribe = client.subscribe("test-channel", (event) => {
            events.push(event);
        });
        client.publish({ channel: "test-channel", type: "test.event", payload: { key: "value" } });
        expect(events.length).toBe(1);
        expect(events[0].type).toBe("test.event");
        unsubscribe();
        client.publish({ channel: "test-channel", type: "another.event", payload: {} });
        expect(events.length).toBe(1);
    });
    it("disconnect resets status to disconnected", () => {
        const client = new InMemoryWSClient();
        const statuses = [];
        client.onStatusChange((status) => {
            statuses.push(status);
        });
        client.connect("ws://example.com/ws", "token");
        client.disconnect();
        expect(statuses).toContain("connected");
        expect(statuses).toContain("disconnected");
    });
    it("useSseFallback sets status to sse-fallback", () => {
        const client = new InMemoryWSClient();
        let finalStatus = "";
        client.onStatusChange((status) => {
            finalStatus = status;
        });
        client.connect("ws://example.com/ws", "token");
        client.useSseFallback();
        expect(finalStatus).toBe("sse-fallback");
    });
});
describe("BrowserWSClient", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
    it("connect does NOT put token in URL - uses subprotocol instead (Issue #2070)", () => {
        const client = new BrowserWSClient(FakeSocket, new InMemoryWSClient());
        client.connect("ws://example.com/ws?important=param", "my-secret-token");
        const debugState = client;
        expect(debugState.currentUrl).toBe("ws://example.com/ws?important=param");
        expect(debugState.currentToken).toBe("my-secret-token");
    });
    it("sends auth token in first message after connection, not in URL (Issue #2070)", async () => {
        vi.useFakeTimers();
        let capturedUrl = "";
        let capturedProtocols;
        const sentMessages = [];
        class TestSocket {
            static OPEN = 1;
            readyState = TestSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(url, protocols) {
                capturedUrl = url;
                capturedProtocols = protocols;
                setTimeout(() => this.onopen?.(), 0);
            }
            send(message) {
                sentMessages.push(message);
            }
            close() {
                this.onclose?.();
            }
        }
        const client = new BrowserWSClient(TestSocket, new InMemoryWSClient());
        client.connect("ws://secure.example.com/events", "token-should-not-be-in-url");
        await vi.advanceTimersByTimeAsync(10);
        expect(capturedUrl).not.toContain("token-should-not-be-in-url");
        expect(capturedProtocols?.toString()).toContain("v1.auth.token");
        const authMessage = sentMessages.find((m) => m.includes("auth"));
        expect(authMessage).toBeDefined();
        expect(authMessage).toContain("token-should-not-be-in-url");
    });
    it("resets fallback client state before reconnecting", () => {
        vi.useFakeTimers();
        const fallback = new InMemoryWSClient();
        const disconnectSpy = vi.spyOn(fallback, "disconnect");
        const connectSpy = vi.spyOn(fallback, "connect");
        class SilentSocket {
            static CONNECTING = 0;
            static OPEN = 1;
            readyState = SilentSocket.CONNECTING;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) { }
            send(_message) { }
            close() { }
        }
        const client = new BrowserWSClient(SilentSocket, fallback);
        client.currentUrl = "ws://example.test/ws";
        client.currentToken = "token-1";
        client.handleReconnect("ws://example.test/ws", "token-1");
        expect(disconnectSpy).toHaveBeenCalledTimes(1);
        expect(connectSpy).toHaveBeenCalledWith("ws://example.test/ws", "token-1");
    });
    it("subscribe returns unsubscribe that removes handler", () => {
        class TestSocket {
            static OPEN = 1;
            readyState = TestSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) {
                setTimeout(() => this.onopen?.(), 0);
            }
            send(_message) { }
            close() { }
        }
        const client = new BrowserWSClient(TestSocket, new InMemoryWSClient());
        const events = [];
        const unsubscribe = client.subscribe("channel1", (event) => {
            events.push(event);
        });
        client.publish({ channel: "channel1", type: "event.1", payload: {} });
        expect(events.length).toBe(1);
        unsubscribe();
        client.publish({ channel: "channel1", type: "event.2", payload: {} });
        expect(events.length).toBe(1);
    });
    it("disconnect clears all state and closes socket", async () => {
        vi.useFakeTimers();
        class TestSocket {
            static OPEN = 1;
            readyState = TestSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) {
                setTimeout(() => this.onopen?.(), 0);
            }
            send(_message) { }
            close() {
                this.onclose?.();
            }
        }
        const client = new BrowserWSClient(TestSocket, new InMemoryWSClient());
        await vi.advanceTimersByTimeAsync(10);
        client.disconnect();
        const debugState = client;
        expect(debugState.currentUrl).toBeNull();
        expect(debugState.currentToken).toBeNull();
    });
    it("sends heartbeat ping frames and reconnects when pong is missing", async () => {
        vi.useFakeTimers();
        const sockets = [];
        class HeartbeatSocket {
            static OPEN = 1;
            readyState = HeartbeatSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            sent = [];
            constructor(_url, _protocols) {
                sockets.push(this);
                queueMicrotask(() => this.onopen?.());
            }
            send(message) {
                this.sent.push(message);
            }
            close() {
                this.readyState = 3;
                this.onclose?.();
            }
        }
        const client = new BrowserWSClient(HeartbeatSocket, new InMemoryWSClient(), { heartbeatIntervalMs: 50, heartbeatTimeoutMs: 25, random: () => 0.5 });
        client.connect("ws://example.com/ws", "heartbeat-token");
        await vi.runAllTicks();
        await vi.advanceTimersByTimeAsync(55);
        const firstSocket = sockets[0];
        expect(firstSocket.sent.some((message) => message.includes('"action":"ping"'))).toBe(true);
        await vi.advanceTimersByTimeAsync(1200);
        await vi.runAllTicks();
        expect(sockets.length).toBeGreaterThan(1);
    });
    it("clears the heartbeat deadline when a pong frame arrives", async () => {
        vi.useFakeTimers();
        class PongSocket {
            static OPEN = 1;
            readyState = PongSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) {
                queueMicrotask(() => this.onopen?.());
            }
            send(_message) { }
            close() {
                this.readyState = 3;
                this.onclose?.();
            }
        }
        const client = new BrowserWSClient(PongSocket, new InMemoryWSClient(), { heartbeatIntervalMs: 50, heartbeatTimeoutMs: 25 });
        const statuses = [];
        client.onStatusChange((status) => statuses.push(status));
        client.connect("ws://example.com/ws", "heartbeat-token");
        await vi.runAllTicks();
        await vi.advanceTimersByTimeAsync(55);
        client.socket?.onmessage?.({
            data: JSON.stringify({ action: "pong" }),
        });
        await vi.advanceTimersByTimeAsync(30);
        expect(statuses.includes("reconnecting")).toBe(false);
    });
    it("does not reconnect after an authentication close code", async () => {
        vi.useFakeTimers();
        const sockets = [];
        class AuthCloseSocket {
            static OPEN = 1;
            readyState = AuthCloseSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) {
                sockets.push(this);
                queueMicrotask(() => this.onopen?.());
            }
            send(_message) { }
            close() {
                this.onclose?.({ code: 4001 });
            }
        }
        const client = new BrowserWSClient(AuthCloseSocket, new InMemoryWSClient());
        client.connect("ws://example.com/ws", "token");
        await vi.runAllTicks();
        sockets[0]?.onclose?.({ code: 4001 });
        await vi.advanceTimersByTimeAsync(2_000);
        expect(sockets).toHaveLength(1);
    });
    it("ignores stale close events after a manual disconnect and later reconnect", async () => {
        vi.useFakeTimers();
        const sockets = [];
        class ReconnectSocket {
            static OPEN = 1;
            static CONNECTING = 0;
            static CLOSED = 3;
            readyState = ReconnectSocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            constructor(_url, _protocols) {
                sockets.push(this);
                queueMicrotask(() => this.onopen?.());
            }
            send(_message) { }
            close() {
                this.readyState = ReconnectSocket.CLOSED;
            }
        }
        const client = new BrowserWSClient(ReconnectSocket, new InMemoryWSClient());
        client.connect("ws://example.com/ws", "first-token");
        await vi.runAllTicks();
        const firstSocket = sockets[0];
        client.disconnect();
        client.connect("ws://example.com/ws", "second-token");
        await vi.runAllTicks();
        firstSocket.onclose?.({ code: 1006 });
        await vi.advanceTimersByTimeAsync(2_000);
        expect(sockets).toHaveLength(2);
    });
    it("ignores inbound events that carry untrusted replay ids", async () => {
        vi.useFakeTimers();
        class InvalidReplaySocket {
            static OPEN = 1;
            static lastInstance = null;
            readyState = InvalidReplaySocket.OPEN;
            onopen = null;
            onmessage = null;
            onclose = null;
            onerror = null;
            sent = [];
            constructor(_url, _protocols) {
                InvalidReplaySocket.lastInstance = this;
                queueMicrotask(() => this.onopen?.());
            }
            send(message) {
                this.sent.push(message);
            }
            close() { }
        }
        const client = new BrowserWSClient(InvalidReplaySocket, new InMemoryWSClient());
        const seen = [];
        client.subscribe("updates", (event) => seen.push(event));
        client.connect("ws://example.com/ws", "token");
        await vi.runAllTicks();
        expect(InvalidReplaySocket.lastInstance).not.toBeNull();
        const socket = InvalidReplaySocket.lastInstance;
        socket.onmessage?.({
            data: JSON.stringify({
                channel: "updates",
                type: "task.update",
                eventId: "injected-id",
                payload: { status: "ok" },
            }),
        });
        await vi.runAllTicks();
        expect(seen).toHaveLength(0);
        const subscribeMessage = socket.sent.find((message) => message.includes('"action":"subscribe"'));
        expect(subscribeMessage).toBeDefined();
        expect(subscribeMessage).not.toContain("injected-id");
    });
});
describe("createRuntimeWSClient", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("returns a valid WSClient implementation", () => {
        const client = createRuntimeWSClient();
        expect(client).toBeDefined();
        expect(typeof client.connect).toBe("function");
        expect(typeof client.disconnect).toBe("function");
        expect(typeof client.subscribe).toBe("function");
    });
    it("uses SharedWorker-based multiplexing when the browser exposes SharedWorker", () => {
        class FakePort {
            sent = [];
            listeners = new Set();
            postMessage(message) {
                this.sent.push(message);
            }
            addEventListener(_type, listener) {
                this.listeners.add(listener);
            }
            removeEventListener(_type, listener) {
                this.listeners.delete(listener);
            }
            start() {
                return;
            }
            close() {
                return;
            }
            emit(data) {
                for (const listener of this.listeners) {
                    listener({ data });
                }
            }
        }
        const port = new FakePort();
        vi.stubGlobal("SharedWorker", class {
        });
        const client = createRuntimeWSClient(undefined, () => ({ port: port }));
        expect(client).toBeInstanceOf(SharedWorkerWSClient);
        const statuses = [];
        const events = [];
        client.onStatusChange((status) => statuses.push(status));
        client.subscribe("dashboard", (event) => events.push(event));
        client.connect("wss://example.test/realtime", "shared-worker-token");
        expect(port.sent).toContainEqual({ action: "connect", url: "wss://example.test/realtime", token: "shared-worker-token" });
        expect(port.sent).toContainEqual({ action: "subscribe", channel: "dashboard" });
        port.emit({ type: "status", status: "connected" });
        port.emit({ type: "event", event: { channel: "dashboard", type: "dashboard.metric_updated", payload: { value: 1 } } });
        expect(statuses).toContain("connected");
        expect(events).toEqual([{ channel: "dashboard", type: "dashboard.metric_updated", payload: { value: 1 } }]);
    });
});
