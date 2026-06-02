/**
 * Datadog Log Transport
 *
 * Sends structured log entries to Datadog Logs API via HTTPS.
 * Batches entries for efficiency and flushes periodically.
 */

import { Agent, request } from "node:https";
import type { LogTransport } from "../log-transport.js";
import { StructuredLogger, type StructuredLogEntry } from "../structured-logger.js";

export type DatadogRequestFactory = typeof request;

export interface DatadogTransportConfig {
  apiKey: string;
  site?: string;  // "datadoghq.com" | "datadoghq.eu"
  service: string;
  source?: string;
  env?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxBufferedEntries?: number;
  maxRetryWindowMs?: number;
  agent?: Agent;
  requestFactory?: DatadogRequestFactory;
}

const DEFAULT_DATADOG_HTTPS_AGENT = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30_000,
});
const datadogTransportLogger = new StructuredLogger({ retentionLimit: 100 });

export class DatadogTransport implements LogTransport {
  readonly name = "datadog";
  private batch: StructuredLogEntry[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly site: string;
  private readonly service: string;
  private readonly source: string;
  private readonly env: string;
  private readonly agent: Agent;
  private readonly requestFactory: DatadogRequestFactory;
  private readonly maxBufferedEntries: number;
  private readonly maxRetryWindowMs: number;
  private timer: NodeJS.Timeout | null = null;
  private flushInFlight: Promise<void> | null = null;

  constructor(private readonly config: DatadogTransportConfig) {
    this.batchSize = config.batchSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.site = config.site ?? "datadoghq.com";
    this.service = config.service;
    this.source = config.source ?? "automatic-agent";
    this.env = config.env ?? "unknown";
    this.agent = config.agent ?? DEFAULT_DATADOG_HTTPS_AGENT;
    this.requestFactory = config.requestFactory ?? request;
    this.maxBufferedEntries = Math.max(this.batchSize, Math.trunc(config.maxBufferedEntries ?? this.batchSize * 10));
    this.maxRetryWindowMs = Math.max(0, Math.trunc(config.maxRetryWindowMs ?? 2_000));
    this.timer = setInterval(() => {
      void this.requestFlush();
    }, this.flushIntervalMs);
    this.timer.unref();
  }

  write(entry: StructuredLogEntry): void {
    this.batch.push(entry);
    this.trimBufferedEntries();
    if (this.batch.length >= this.batchSize) {
      void this.requestFlush();
    }
  }

  private requestFlush(): Promise<void> {
    if (this.flushInFlight != null) {
      return this.flushInFlight;
    }
    this.flushInFlight = this.flushInternal().finally(() => {
      this.flushInFlight = null;
    });
    return this.flushInFlight;
  }

  private async flushInternal(): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }
    const entries = this.batch.splice(0);
    const body = JSON.stringify(entries.map((e) => ({
      ...e,
      service: this.service,
      ddsource: this.source,
      ddtags: `env:${this.env}`,
    })));

    const maxRetries = 3;
    const baseDelayMs = 100;
    const retryDeadlineMs = Date.now() + this.maxRetryWindowMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.doRequest(body);
        return;
      } catch (err) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt || Date.now() + delay > retryDeadlineMs) {
          this.batch.unshift(...entries);
          this.trimBufferedEntries();
          datadogTransportLogger.error("datadog_transport.flush_failed", {
            entryCount: entries.length,
            maxRetries,
            error: err instanceof Error ? err.stack ?? err.message : String(err),
          });
          return;
        }
        await new Promise((r) => {
          const retryTimer = setTimeout(r, delay);
          retryTimer.unref?.();
        });
      }
    }
  }

  private doRequest(body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.requestFactory({
        hostname: `http-intake.logs.${this.site}`,
        path: "/api/v2/logs",
        method: "POST",
        agent: this.agent,
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": this.config.apiKey,
        },
      }, (res) => {
        if (res.statusCode == null || (res.statusCode >= 200 && res.statusCode < 300)) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
      req.on("error", reject);
      req.end(body);
    });
  }

  async flush(): Promise<void> {
    await this.requestFlush();
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.requestFlush();
  }

  private trimBufferedEntries(): void {
    if (this.batch.length <= this.maxBufferedEntries) {
      return;
    }
    this.batch.splice(0, this.batch.length - this.maxBufferedEntries);
  }
}
