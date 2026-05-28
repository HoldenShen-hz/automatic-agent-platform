import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

import type { TraceContext } from "../../contracts/types/domain.js";
import {
  loadOtelApi,
  type OtelApiLike,
  type OtelTelemetrySpanLike as TelemetrySpanLike,
} from "./otel-module-loader.js";

export interface ActiveTelemetryContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
}

const fallbackContextStorage = new AsyncLocalStorage<ActiveTelemetryContext>();

export function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function isValidTraceId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value) && !/^0{32}$/i.test(value);
}

export function isValidSpanId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/i.test(value) && !/^0{16}$/i.test(value);
}

function toActiveTelemetryContext(
  spanContext: { traceId: string; spanId: string } | null | undefined,
  parentSpanId: string | null = null,
): ActiveTelemetryContext | null {
  if (!spanContext || !isValidTraceId(spanContext.traceId) || !isValidSpanId(spanContext.spanId)) {
    return null;
  }
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    parentSpanId,
  };
}

export function getActiveTelemetryContext(): ActiveTelemetryContext | null {
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

function normalizeAttributes(attributes: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  if (!attributes) {
    return {};
  }
  const normalized: Record<string, string | number | boolean> = {};
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

function createFallbackSpan(context: ActiveTelemetryContext): TelemetrySpanLike {
  return {
    end() {},
    recordException() {},
    setAttribute() {},
    setStatus() {},
    spanContext() {
      return {
        traceId: context.traceId,
        spanId: context.spanId,
      };
    },
  };
}

function deriveFallbackContext(
  parent: Pick<TraceContext, "traceId" | "spanId"> | ActiveTelemetryContext | null | undefined,
): ActiveTelemetryContext {
  return {
    traceId: parent?.traceId && isValidTraceId(parent.traceId) ? parent.traceId : generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parent?.spanId && isValidSpanId(parent.spanId) ? parent.spanId : null,
  };
}

export async function startActiveSpan<T>(
  name: string,
  options: {
    attributes?: Record<string, unknown>;
    tracerName?: string;
    parentContext?: Pick<TraceContext, "traceId" | "spanId"> | ActiveTelemetryContext | null;
  } = {},
  callback: (span: TelemetrySpanLike, context: ActiveTelemetryContext) => Promise<T> | T,
): Promise<T> {
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
    const resolvedContext =
      toActiveTelemetryContext(span.spanContext(), parentContext?.spanId ?? null)
      ?? deriveFallbackContext(parentContext);
    return await fallbackContextStorage.run(resolvedContext, async () => {
      try {
        if (typeof span.setAttributes === "function") {
          span.setAttributes(attributes);
        } else {
          for (const [key, value] of Object.entries(attributes)) {
            span.setAttribute(key, value);
          }
        }
        const result = await callback(span, resolvedContext);
        span.setStatus({ code: api.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "unknown_error",
        });
        throw error;
      } finally {
        span.end();
      }
    });
  });
}
