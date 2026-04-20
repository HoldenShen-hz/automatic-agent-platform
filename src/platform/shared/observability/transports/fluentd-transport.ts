/**
 * Fluentd Log Transport
 *
 * Sends structured log entries to Fluentd using the forward protocol
 * over TCP. Supports reconnection and buffering.
 */

import { createConnection, type Socket } from "node:net";
import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";

export interface FluentdTransportConfig {
  host: string;
  port: number;
  tag: string;
  reconnectIntervalMs?: number;
  bufferLimit?: number;
}

export class FluentdTransport implements LogTransport {
  readonly name = "fluentd";
  private socket: Socket | null = null;
  private readonly tag: string;
  private readonly reconnectIntervalMs: number;
  private readonly bufferLimit: number;
  private buffer: string[] = [];
  private connecting = false;

  constructor(private readonly config: FluentdTransportConfig) {
    this.tag = config.tag;
    this.reconnectIntervalMs = config.reconnectIntervalMs ?? 5000;
    this.bufferLimit = config.bufferLimit ?? 10000;
    this.connect();
  }

  private connect(): void {
    if (this.connecting || (this.socket && !this.socket.destroyed)) {
      return;
    }
    this.connecting = true;
    this.socket = createConnection(this.config.port, this.config.host);
    this.socket.on("connect", () => {
      this.connecting = false;
      for (const buffered of this.buffer) {
        this.socket!.write(buffered);
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
    return new Promise((resolve) => {
      if (this.socket?.writable) {
        this.socket.once("drain", resolve);
      } else {
        resolve();
      }
    });
  }

  async close(): Promise<void> {
    this.socket?.end();
    this.socket = null;
  }
}
