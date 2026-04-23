/**
 * Fluentd Log Transport
 *
 * Sends structured log entries to Fluentd using the forward protocol
 * over TCP. Supports reconnection and buffering.
 */
import { createConnection } from "node:net";
import { StructuredLogger } from "../structured-logger.js";
export class FluentdTransport {
    config;
    name = "fluentd";
    logger = new StructuredLogger({ retentionLimit: 100 });
    socket = null;
    tag;
    reconnectIntervalMs;
    bufferLimit;
    buffer = [];
    connecting = false;
    reconnectTimer = null;
    constructor(config) {
        this.config = config;
        this.tag = config.tag;
        this.reconnectIntervalMs = config.reconnectIntervalMs ?? 5000;
        this.bufferLimit = config.bufferLimit ?? 10000;
    }
    connect() {
        if (this.connecting || (this.socket && !this.socket.destroyed)) {
            return;
        }
        this.connecting = true;
        this.socket = createConnection(this.config.port, this.config.host);
        if (typeof this.socket.unref === "function") {
            this.socket.unref();
        }
        this.socket.on("connect", () => {
            this.handleConnected();
        });
        this.socket.on("error", () => {
            this.handleDisconnected();
        });
        this.socket.on("close", () => {
            this.handleDisconnected();
        });
    }
    handleConnected() {
        this.connecting = false;
        if (this.reconnectTimer != null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
        for (const buffered of this.buffer) {
            this.socket?.write(buffered);
        }
        this.buffer = [];
    }
    handleDisconnected() {
        this.socket = null;
        this.connecting = false;
        this.handleReconnect();
    }
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    handleReconnect() {
        if (this.reconnectTimer != null) {
            return;
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error("fluentd.reconnect_exhausted", {
                attempts: this.reconnectAttempts,
                host: this.config.host,
                port: this.config.port,
            });
            return;
        }
        this.reconnectAttempts++;
        // Exponential backoff: base * 2^(attempts-1), capped at 30 seconds
        const backoffMs = Math.min(this.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1), 30000);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, backoffMs);
        this.reconnectTimer.unref();
    }
    write(entry) {
        const msg = JSON.stringify([this.tag, Math.floor(Date.now() / 1000), entry]);
        if (this.socket?.writable) {
            this.socket.write(msg + "\n");
        }
        else {
            if (this.buffer.length < this.bufferLimit) {
                this.buffer.push(msg + "\n");
            }
            this.connect();
        }
    }
    async flush() {
        return new Promise((resolve) => {
            if (this.socket?.writable) {
                this.socket.once("drain", resolve);
            }
            else {
                resolve();
            }
        });
    }
    async close() {
        if (this.reconnectTimer != null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (typeof this.socket?.end === "function") {
            this.socket.end();
        }
        if (typeof this.socket?.destroy === "function") {
            this.socket.destroy();
        }
        this.socket = null;
    }
}
//# sourceMappingURL=fluentd-transport.js.map