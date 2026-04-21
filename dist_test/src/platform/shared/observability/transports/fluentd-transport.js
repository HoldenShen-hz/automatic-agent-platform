/**
 * Fluentd Log Transport
 *
 * Sends structured log entries to Fluentd using the forward protocol
 * over TCP. Supports reconnection and buffering.
 */
import { createConnection } from "node:net";
export class FluentdTransport {
    config;
    name = "fluentd";
    socket = null;
    tag;
    reconnectIntervalMs;
    bufferLimit;
    buffer = [];
    connecting = false;
    constructor(config) {
        this.config = config;
        this.tag = config.tag;
        this.reconnectIntervalMs = config.reconnectIntervalMs ?? 5000;
        this.bufferLimit = config.bufferLimit ?? 10000;
        this.connect();
    }
    connect() {
        if (this.connecting || (this.socket && !this.socket.destroyed)) {
            return;
        }
        this.connecting = true;
        this.socket = createConnection(this.config.port, this.config.host);
        this.socket.on("connect", () => {
            this.connecting = false;
            for (const buffered of this.buffer) {
                this.socket.write(buffered);
            }
            this.buffer = [];
        });
        this.socket.on("error", () => {
            this.socket = null;
            this.connecting = false;
            setTimeout(() => this.connect(), this.reconnectIntervalMs);
        });
        this.socket.on("close", () => {
            this.socket = null;
            this.connecting = false;
            setTimeout(() => this.connect(), this.reconnectIntervalMs);
        });
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
        this.socket?.end();
        this.socket = null;
    }
}
//# sourceMappingURL=fluentd-transport.js.map