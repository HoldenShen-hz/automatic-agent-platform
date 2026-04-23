/**
 * Fluentd Log Transport
 *
 * Sends structured log entries to Fluentd using the forward protocol
 * over TCP. Supports reconnection and buffering.
 */
import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";
export interface FluentdTransportConfig {
    host: string;
    port: number;
    tag: string;
    reconnectIntervalMs?: number;
    bufferLimit?: number;
}
export declare class FluentdTransport implements LogTransport {
    private readonly config;
    readonly name = "fluentd";
    private readonly logger;
    private socket;
    private readonly tag;
    private readonly reconnectIntervalMs;
    private readonly bufferLimit;
    private buffer;
    private connecting;
    private reconnectTimer;
    constructor(config: FluentdTransportConfig);
    private connect;
    private handleConnected;
    private handleDisconnected;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private handleReconnect;
    write(entry: StructuredLogEntry): void;
    flush(): Promise<void>;
    close(): Promise<void>;
}
