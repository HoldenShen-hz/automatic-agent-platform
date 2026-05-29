function detachTimer(timer) {
    if (typeof timer === "object" && timer !== null && "unref" in timer && typeof timer.unref === "function") {
        timer.unref();
    }
}
export class TelemetrySink {
    exporters;
    events = [];
    deadLetters = [];
    consentChecker;
    maxBufferSize;
    maxRetryAttempts;
    autoFlush;
    autoFlushQueued = false;
    flushTimer;
    flushPromise = null;
    flushingEntries = [];
    disposed = false;
    constructor(exporters = [], options = {}) {
        this.exporters = exporters;
        this.consentChecker = options.consentChecker ?? (() => true);
        this.maxBufferSize = Math.max(1, options.maxBufferSize ?? 100);
        this.maxRetryAttempts = Math.max(0, options.maxRetryAttempts ?? 3);
        this.autoFlush = options.autoFlush ?? false;
        this.flushTimer = options.flushIntervalMs == null
            ? null
            : setInterval(() => {
                void this.flush().catch(() => undefined);
            }, options.flushIntervalMs);
        if (this.flushTimer != null) {
            detachTimer(this.flushTimer);
        }
    }
    record(name, attributes = {}) {
        if (this.disposed || !this.consentChecker()) {
            return;
        }
        this.events.push({
            event: {
                name,
                attributes,
                recordedAt: new Date().toISOString(),
            },
            pendingExporters: new Set(this.exporters.map((_exporter, index) => index)),
            attempts: 0,
            lastError: null,
        });
        if (this.exporters.length === 0 && this.events.length >= this.maxBufferSize) {
            const overflow = this.events.splice(0, this.events.length - this.maxBufferSize + 1);
            this.deadLetters.push(...overflow.map((entry) => ({
                event: entry.event,
                reason: "telemetry.buffer_overflow_no_exporter",
                failedAt: new Date().toISOString(),
            })));
            return;
        }
        if (this.events.length >= this.maxBufferSize) {
            void this.flush().catch(() => undefined);
            return;
        }
        if (this.autoFlush && this.exporters.length > 0) {
            this.queueAutoFlush();
        }
    }
    list() {
        return this.events.map((entry) => entry.event);
    }
    listDeadLetters() {
        return [...this.deadLetters];
    }
    scoped(scope) {
        return {
            record: (name, attributes = {}) => {
                this.record(`${scope.name}.${name}`, {
                    ...(scope.attributes ?? {}),
                    ...attributes,
                });
            },
        };
    }
    async flush() {
        if (this.flushPromise != null) {
            return this.flushPromise;
        }
        this.flushPromise = this.flushInternal().finally(() => {
            this.flushPromise = null;
        });
        return this.flushPromise;
    }
    async dispose() {
        if (this.disposed) {
            return;
        }
        if (this.flushTimer != null) {
            clearInterval(this.flushTimer);
        }
        this.disposed = true;
        await this.flush().catch(() => undefined);
    }
    async flushInternal() {
        if ((this.events.length === 0 && this.flushingEntries.length === 0) || this.exporters.length === 0) {
            return;
        }
        while (this.events.length > 0 || this.flushingEntries.length > 0) {
            const batch = this.flushingEntries.length > 0
                ? this.flushingEntries
                : this.events.splice(0, this.events.length);
            this.flushingEntries = batch;
            const survivors = await this.deliverBatch(batch);
            this.flushingEntries = [];
            if (survivors.length > 0) {
                this.events.unshift(...survivors);
                break;
            }
        }
    }
    async deliverBatch(batch) {
        const deliveries = this.exporters.map(async (exporter, exporterIndex) => {
            const pendingEntries = batch.filter((entry) => entry.pendingExporters.has(exporterIndex));
            if (pendingEntries.length === 0) {
                return;
            }
            try {
                await exporter.export(pendingEntries.map((entry) => entry.event));
                for (const entry of pendingEntries) {
                    entry.pendingExporters.delete(exporterIndex);
                    entry.lastError = null;
                }
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                for (const entry of pendingEntries) {
                    entry.attempts += 1;
                    entry.lastError = reason;
                }
            }
        });
        await Promise.all(deliveries);
        const survivors = [];
        for (const entry of batch) {
            if (entry.pendingExporters.size === 0) {
                continue;
            }
            if (entry.attempts > this.maxRetryAttempts) {
                this.deadLetters.push({
                    event: entry.event,
                    reason: entry.lastError ?? "telemetry.export_failed",
                    failedAt: new Date().toISOString(),
                });
                continue;
            }
            survivors.push(entry);
        }
        return survivors;
    }
    queueAutoFlush() {
        if (this.autoFlushQueued) {
            return;
        }
        this.autoFlushQueued = true;
        queueMicrotask(() => {
            this.autoFlushQueued = false;
            void this.flush().catch(() => undefined);
        });
    }
}
export class InMemoryTelemetryExporter {
    exported = [];
    async export(events) {
        this.exported.push(...events);
    }
    list() {
        return [...this.exported];
    }
}
export class OtlpHttpTelemetryExporter {
    endpoint;
    fetchImplementation;
    headers;
    timeoutMs;
    constructor(endpoint, fetchImplementation = globalThis.fetch.bind(globalThis), headers = {}, options = {}) {
        this.endpoint = endpoint;
        this.fetchImplementation = fetchImplementation;
        this.headers = headers;
        if (resolveAuthorizationHeader(this.headers).length === 0) {
            throw new Error("telemetry.authorization_required:OTLP exports requires authorization header or VITE_OTLP_AUTH_TOKEN");
        }
        this.timeoutMs = options.timeoutMs ?? 5_000;
    }
    async export(events) {
        if (events.length === 0) {
            return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        if (typeof timeout === "object" && "unref" in timeout && typeof timeout.unref === "function") {
            timeout.unref();
        }
        try {
            await this.fetchImplementation(this.endpoint, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "content-type": "application/json",
                    ...this.headers,
                },
                body: JSON.stringify({
                    "service.name": "automatic-agent-platform-ui",
                    resourceLogs: [
                        {
                            resource: {
                                attributes: [
                                    {
                                        key: "service.name",
                                        value: { stringValue: "automatic-agent-platform-ui" },
                                    },
                                ],
                            },
                            scopeLogs: [
                                {
                                    scope: { name: "ui-telemetry" },
                                    logRecords: events.map((event) => ({
                                        body: { stringValue: event.name },
                                        timeUnixNano: String(Date.parse(event.recordedAt) * 1_000_000),
                                        attributes: Object.entries(event.attributes).map(([key, value]) => ({
                                            key,
                                            value: serializeAttributeValue(value),
                                        })),
                                    })),
                                },
                            ],
                        },
                    ],
                }),
            });
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
export function createTelemetrySink(exporters = []) {
    return new TelemetrySink(exporters, { autoFlush: exporters.length > 0 });
}
export function measureDuration(name, fn) {
    performance.mark(`${name}:start`);
    try {
        const result = fn();
        if (result instanceof Promise) {
            return result.finally(() => {
                performance.mark(`${name}:end`);
                performance.measure(name, `${name}:start`, `${name}:end`);
            });
        }
        performance.mark(`${name}:end`);
        performance.measure(name, `${name}:start`, `${name}:end`);
        return result;
    }
    catch (error) {
        performance.mark(`${name}:end`);
        performance.measure(name, `${name}:start`, `${name}:end`);
        throw error;
    }
}
function vitalRating(name, value) {
    switch (name) {
        case "LCP":
            return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
        case "FID":
            return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
        case "CLS":
            return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
        case "INP":
            return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
        case "TTFB":
            return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
        case "FCP":
            return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
    }
}
export function startWebVitalsCollection(sink) {
    const dispose = [];
    observePerformanceType("paint", dispose, (list) => {
        for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
                sink.record("web_vitals.FCP", {
                    value_ms: entry.startTime,
                    rating: vitalRating("FCP", entry.startTime),
                });
            }
        }
    });
    observePerformanceType("largest-contentful-paint", dispose, (list) => {
        for (const entry of list.getEntries()) {
            sink.record("web_vitals.LCP", {
                value_ms: entry.startTime,
                rating: vitalRating("LCP", entry.startTime),
            });
        }
    });
    observePerformanceType("layout-shift", dispose, (list) => {
        for (const entry of list.getEntries()) {
            const layoutShift = entry;
            if (layoutShift.hadRecentInput) {
                continue;
            }
            const value = layoutShift.value ?? 0;
            sink.record("web_vitals.CLS", {
                value,
                rating: vitalRating("CLS", value),
            });
        }
    });
    observePerformanceType("event", dispose, (list) => {
        for (const entry of list.getEntries()) {
            sink.record("web_vitals.INP", {
                value_ms: entry.duration,
                rating: vitalRating("INP", entry.duration),
            });
        }
    });
    return () => {
        for (const callback of dispose) {
            callback();
        }
    };
}
export const observeWebVitals = startWebVitalsCollection;
function observePerformanceType(type, dispose, callback) {
    if (typeof PerformanceObserver === "undefined") {
        return;
    }
    try {
        const observer = new PerformanceObserver(callback);
        observer.observe({ type, buffered: true });
        dispose.push(() => observer.disconnect());
    }
    catch (error) {
        const reporter = globalThis.console;
        reporter?.warn?.("telemetry.performance_observer_unsupported", {
            type,
            error: error instanceof Error ? error.message : String(error),
        });
        return;
    }
}
function resolveAuthorizationHeader(headers) {
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === "authorization") {
            return value;
        }
    }
    return "";
}
function serializeAttributeValue(value) {
    if (typeof value === "number") {
        return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
    }
    if (typeof value === "boolean") {
        return { boolValue: value };
    }
    return { stringValue: String(value) };
}
