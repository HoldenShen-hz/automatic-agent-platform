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
  site?: string;  // "datadoghq.com" | "datadoghq.eu"
  service: string;
  source?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  requestFactory?: DatadogRequestFactory;
}

export class DatadogTransport implements LogTransport {
  readonly name = "datadog";
  private batch: StructuredLogEntry[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly site: string;
  private readonly service: string;
  private readonly source: string;
  private readonly requestFactory: DatadogRequestFactory;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly config: DatadogTransportConfig) {
    this.batchSize = config.batchSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.site = config.site ?? "datadoghq.com";
    this.service = config.service;
    this.source = config.source ?? "automatic-agent";
    this.requestFactory = config.requestFactory ?? request;
    this.timer = setInterval(() => {
      void this.flushInternal();
    }, this.flushIntervalMs);
    this.timer.unref();
  }

  write(entry: StructuredLogEntry): void {
    this.batch.push(entry);
    if (this.batch.length >= this.batchSize) {
      void this.flushInternal();
    }
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
      ddtags: `env:${process.env.NODE_ENV ?? "dev"}`,
    })));

    const maxRetries = 3;
    const baseDelayMs = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.doRequest(body);
        return;
      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) {
          // Re-add entries to front of batch for backpressure when all retries exhausted
          this.batch.unshift(...entries);
          console.error(`[DatadogTransport] failed to send ${entries.length} logs after ${maxRetries} attempts:`, err);
          return;
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  private doRequest(body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.requestFactory({
        hostname: `http-intake.logs.${this.site}`,
        path: "/api/v2/logs",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": this.config.apiKey,
        },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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
    await this.flushInternal();
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flushInternal();
  }
}
