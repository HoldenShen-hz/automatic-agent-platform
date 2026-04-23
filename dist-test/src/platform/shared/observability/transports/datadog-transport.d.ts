/**
 * Datadog Log Transport
 *
 * Sends structured log entries to Datadog Logs API via HTTPS.
 * Batches entries for efficiency and flushes periodically.
 */
import { request } from "node:https";
import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";
export type DatadogRequestFactory = typeof request;
export interface DatadogTransportConfig {
    apiKey: string;
    site?: string;
    service: string;
    source?: string;
    batchSize?: number;
    flushIntervalMs?: number;
    requestFactory?: DatadogRequestFactory;
}
export declare class DatadogTransport implements LogTransport {
    private readonly config;
    readonly name = "datadog";
    private batch;
    private readonly batchSize;
    private readonly flushIntervalMs;
    private readonly site;
    private readonly service;
    private readonly source;
    private readonly requestFactory;
    private timer;
    constructor(config: DatadogTransportConfig);
    write(entry: StructuredLogEntry): void;
    private flushInternal;
    flush(): Promise<void>;
    close(): Promise<void>;
}
