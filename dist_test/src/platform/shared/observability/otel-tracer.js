import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
const fallbackContextStorage = new AsyncLocalStorage();
function loadOtelApi(requireFn = createRequire(import.meta.url)) {
    try {
        return requireFn("@opentelemetry/api");
    }
    catch {
        return null;
    }
}
export function generateTraceId() {
    return randomBytes(16).toString("hex");
}
export function generateSpanId() {
    return randomBytes(8).toString("hex");
}
export function isValidTraceId(value) {
    return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value) && !/^0{32}$/i.test(value);
}
export function isValidSpanId(value) {
    return typeof value === "string" && /^[0-9a-f]{16}$/i.test(value) && !/^0{16}$/i.test(value);
}
function toActiveTelemetryContext(spanContext, parentSpanId = null) {
    if (!spanContext || !isValidTraceId(spanContext.traceId) || !isValidSpanId(spanContext.spanId)) {
        return null;
    }
    return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        parentSpanId,
    };
}
export function getActiveTelemetryContext() {
    const api = loadOtelApi();
    if (api) {
        const activeSpan = api.trace.getSpan(api.context.active());
        const activeContext = toActiveTelemetryContext(activeSpan?.spanContext());
        if (activeContext) {
            return activeContext;
        }
    }
    return fallbackContextStorage.getStore() ?? null;
}
function normalizeAttributes(attributes) {
    if (!attributes) {
        return {};
    }
    const normalized = {};
    for (const [key, value] of Object.entries(attributes)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            normalized[key] = value;
            continue;
        }
        if (value == null) {
            continue;
        }
        normalized[key] = JSON.stringify(value);
    }
    return normalized;
}
function createFallbackSpan(context) {
    return {
        end() { },
        recordException() { },
        setAttribute() { },
        setStatus() { },
        spanContext() {
            return {
                traceId: context.traceId,
                spanId: context.spanId,
            };
        },
    };
}
function deriveFallbackContext(parent) {
    return {
        traceId: parent?.traceId && isValidTraceId(parent.traceId) ? parent.traceId : generateTraceId(),
        spanId: generateSpanId(),
        parentSpanId: parent?.spanId && isValidSpanId(parent.spanId) ? parent.spanId : null,
    };
}
export async function startActiveSpan(name, options = {}, callback) {
    const parentContext = options.parentContext ?? getActiveTelemetryContext();
    const api = loadOtelApi();
    const attributes = normalizeAttributes({
        "aa.span.name": name,
        ...(options.attributes ?? {}),
        ...(parentContext?.traceId ? { "aa.parent.trace_id": parentContext.traceId } : {}),
        ...(parentContext?.spanId ? { "aa.parent.span_id": parentContext.spanId } : {}),
    });
    if (!api) {
        const fallbackContext = deriveFallbackContext(parentContext);
        return await fallbackContextStorage.run(fallbackContext, () => callback(createFallbackSpan(fallbackContext), fallbackContext));
    }
    const tracer = api.trace.getTracer(options.tracerName ?? "automatic-agent-platform");
    return await tracer.startActiveSpan(name, { attributes }, async (span) => {
        const resolvedContext = toActiveTelemetryContext(span.spanContext(), parentContext?.spanId ?? null)
            ?? deriveFallbackContext(parentContext);
        return await fallbackContextStorage.run(resolvedContext, async () => {
            try {
                if (typeof span.setAttributes === "function") {
                    span.setAttributes(attributes);
                }
                else {
                    for (const [key, value] of Object.entries(attributes)) {
                        span.setAttribute(key, value);
                    }
                }
                const result = await callback(span, resolvedContext);
                span.setStatus({ code: api.SpanStatusCode.OK });
                return result;
            }
            catch (error) {
                span.recordException(error);
                span.setStatus({
                    code: api.SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : "unknown_error",
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    });
}
//# sourceMappingURL=otel-tracer.js.map