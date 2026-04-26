/**
 * Trace Context Utilities
 *
 * Manages distributed tracing context for correlating operations across services.
 * Provides functions for creating root trace contexts, child spans, and propagating
 * trace context through payloads and event systems.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary - trace, span, correlation}
 */

import type { TraceContext, TransitionAuditContext } from "../../contracts/types/domain.js";
import { generateSpanId, generateTraceId, getActiveTelemetryContext, isValidSpanId, isValidTraceId } from "./otel-tracer.js";

/**
 * Creates a new root trace context, generating new trace and span IDs.
 * Used when initiating a new trace that is not a child of an existing trace.
 */
export function createRootTraceContext(input: {
  traceId?: string | null;
  spanId?: string | null;
  correlationId?: string | null;
} = {}): TraceContext {
  const activeContext = getActiveTelemetryContext();
  const traceId =
    input.traceId
    ?? (activeContext?.traceId && isValidTraceId(activeContext.traceId) ? activeContext.traceId : generateTraceId());
  return {
    traceId,
    spanId:
      input.spanId
      ?? (activeContext?.spanId && isValidSpanId(activeContext.spanId) ? activeContext.spanId : generateSpanId()),
    parentSpanId: null,
    correlationId: input.correlationId ?? traceId,
  };
}

/**
 * Creates a child trace context under an existing parent trace.
 * The child inherits the trace ID but has a new span ID and references the parent span.
 */
export function createChildTraceContext(
  parent: Pick<TraceContext, "traceId" | "spanId" | "correlationId">,
  input: {
    spanId?: string;
    correlationId?: string | null;
  } = {},
): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: input.spanId ?? generateSpanId(),
    parentSpanId: parent.spanId ?? null,
    correlationId: input.correlationId ?? parent.correlationId ?? parent.traceId,
  };
}

/**
 * Converts a TransitionAuditContext to a TraceContext format.
 * Used when extracting trace context from audit records.
 */
export function toAuditContextTraceContext(context: TransitionAuditContext): TraceContext {
  return {
    traceId: context.traceId,
    spanId: context.spanId ?? null,
    parentSpanId: context.parentSpanId ?? null,
    correlationId: context.correlationId ?? context.traceId,
  };
}

/**
 * Injects trace context into a payload object.
 * If trace context already exists in the payload, returns the payload unchanged.
 * This prevents duplicate trace context injection.
 */
export function injectTraceContext(
  payload: Record<string, unknown>,
  traceContext: TraceContext | null,
): Record<string, unknown> {
  if (traceContext == null) {
    return payload;
  }
  if ("traceContext" in payload) {
    return payload;
  }
  return {
    ...payload,
    traceContext,
  };
}

/**
 * Extracts trace context from a value that may contain a traceContext field.
 * Falls back to provided fallback values if no trace context is found.
 */
export function extractTraceContext(
  value: unknown,
  fallback: {
    traceId?: string | null;
    correlationId?: string | null;
  } = {},
): TraceContext | null {
  if (isRecord(value) && isRecord(value.traceContext)) {
    return normalizeTraceContext(value.traceContext, fallback);
  }
  if (fallback.traceId) {
    return {
      traceId: fallback.traceId,
      spanId: null,
      parentSpanId: null,
      correlationId: fallback.correlationId ?? fallback.traceId,
    };
  }
  return null;
}

/**
 * Normalizes and validates trace context values from a record.
 * Ensures all required fields are present and properly typed.
 */
function normalizeTraceContext(
  value: Record<string, unknown>,
  fallback: {
    traceId?: string | null;
    correlationId?: string | null;
  },
): TraceContext | null {
  const traceId =
    typeof value.traceId === "string"
      ? value.traceId
      : fallback.traceId ?? null;
  if (traceId == null) {
    return null;
  }

  return {
    traceId,
    spanId: typeof value.spanId === "string" ? value.spanId : null,
    parentSpanId: typeof value.parentSpanId === "string" ? value.parentSpanId : null,
    correlationId:
      typeof value.correlationId === "string"
        ? value.correlationId
        : fallback.correlationId ?? traceId,
  };
}

/**
 * Type guard to check if a value is a plain object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
