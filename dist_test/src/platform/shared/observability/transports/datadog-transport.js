/**
 * Datadog Log Transport
 *
 * Sends structured log entries to Datadog Logs API via HTTPS.
 * Batches entries for efficiency and flushes periodically.
 */
import { request } from "node:https";
export class DatadogTransport {
    config;
    name = "datadog";
    batch = [];
    batchSize;
    flushIntervalMs;
    site;
    service;
    source;
    timer = null;
    constructor(config) {
        this.config = config;
        this.batchSize = config.batchSize ?? 100;
        this.flushIntervalMs = config.flushIntervalMs ?? 5000;
        this.site = config.site ?? "datadoghq.com";
        this.service = config.service;
        this.source = config.source ?? "automatic-agent";
        this.timer = setInterval(() => {
            void this.flushInternal();
        }, this.flushIntervalMs);
    }
    write(entry) {
        this.batch.push(entry);
        if (this.batch.length >= this.batchSize) {
            void this.flushInternal();
        }
    }
    async flushInternal() {
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
    async flush() {
        await this.flushInternal();
    }
    async close() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flushInternal();
    }
}
//# sourceMappingURL=datadog-transport.js.map