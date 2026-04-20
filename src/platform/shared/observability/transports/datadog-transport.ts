/**
 * Datadog Log Transport
 *
 * Sends structured log entries to Datadog Logs API via HTTPS.
 * Batches entries for efficiency and flushes periodically.
 */

import { request } from "node:https";
import type { LogTransport } from "../log-transport.js";
import type { StructuredLogEntry } from "../structured-logger.js";

export interface DatadogTransportConfig {
  apiKey: string;
  site?: string;  // "datadoghq.com" | "datadoghq.eu"
  service: string;
  source?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export class DatadogTransport implements LogTransport {
  readonly name = "datadog";
  private batch: StructuredLogEntry[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly site: string;
  private readonly service: string;
  private readonly source: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly config: DatadogTransportConfig) {
    this.batchSize = config.batchSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.site = config.site ?? "datadoghq.com";
    this.service = config.service;
    this.source = config.source ?? "automatic-agent";
    this.timer = setInterval(() => {
      void this.flushInternal();
    }, this.flushIntervalMs);
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

    return new Promise((resolve) => {
      const req = request({
        hostname: `http-intake.logs.${this.site}`,
        path: "/api/v2/logs",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": this.config.apiKey,
        },
      }, () => resolve());
      req.on("error", () => resolve());
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
