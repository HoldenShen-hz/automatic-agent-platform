/**
 * Fluentd Log Transport
 *
 * Sends structured log entries to Fluentd using the forward protocol
 * over TCP. Supports reconnection and buffering.
 */

import { createConnection, type Socket } from "node:net";
import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";
import { StructuredLogger } from "../structured-logger.js";

export interface FluentdTransportConfig {
  host: string;
  port: number;
  tag: string;
  reconnectIntervalMs?: number;
  bufferLimit?: number;
}

export class FluentdTransport implements LogTransport {
  readonly name = "fluentd";
  private readonly logger = new StructuredLogger({ retentionLimit: 100 });
  private socket: Socket | null = null;
  private readonly tag: string;
  private readonly reconnectIntervalMs: number;
  private readonly bufferLimit: number;
  private buffer: string[] = [];
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: FluentdTransportConfig) {
    this.tag = config.tag;
    this.reconnectIntervalMs = config.reconnectIntervalMs ?? 5000;
    this.bufferLimit = config.bufferLimit ?? 10000;
  }

  private connect(): void {
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

  private handleConnected(): void {
    this.connecting = false;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    // R27-13 FIX: Drain loop has no write error handling - mid-way failure loses entries.
    // Add error handling for each write operation in the drain loop.
    for (const buffered of this.buffer) {
      try {
        const canContinue = this.socket?.write(buffered);
        if (!canContinue) {
          // Write returned false (buffer full), stop sending and wait for drain
          break;
        }
      } catch (err) {
        // R27-13: Mid-way write failure - log error and stop draining remaining entries
        this.logger.error("fluentd.write_error", {
          error: err instanceof Error ? err.message : String(err),
          remainingEntries: this.buffer.length,
          host: this.config.host,
          port: this.config.port,
        });
        break;
      }
    }
    this.buffer = [];
  }

  private handleDisconnected(): void {
    this.socket = null;
    this.connecting = false;
    this.handleReconnect();
  }

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  private handleReconnect(): void {
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
    const backoffMs = Math.min(
      this.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoffMs);
    this.reconnectTimer.unref();
  }

  write(entry: StructuredLogEntry): void {
    const msg = JSON.stringify([this.tag, Math.floor(Date.now() / 1000), entry]);
    if (this.socket?.writable) {
      this.socket.write(msg + "\n");
    } else {
      if (this.buffer.length < this.bufferLimit) {
        this.buffer.push(msg + "\n");
      }
      this.connect();
    }
  }

  async flush(): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      return Promise.resolve();
    }
    if (!socket.writable) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const onDrain = () => {
        clearTimeout(timeout);
        socket.removeListener?.("drain", onDrain);
        resolve();
      };
      const timeout = setTimeout(() => {
        socket.removeListener?.("drain", onDrain);
        resolve();
      }, 5000);
      if (typeof timeout.unref === "function") {
        timeout.unref();
      }
      socket.once?.("drain", onDrain);
    });
  }

  async close(): Promise<void> {
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
