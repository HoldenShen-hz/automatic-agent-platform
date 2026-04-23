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
/**
 * Creates a new root trace context, generating new trace and span IDs.
 * Used when initiating a new trace that is not a child of an existing trace.
 */
export declare function createRootTraceContext(input?: {
    traceId?: string;
    spanId?: string;
    correlationId?: string | null;
}): TraceContext;
/**
 * Creates a child trace context under an existing parent trace.
 * The child inherits the trace ID but has a new span ID and references the parent span.
 */
export declare function createChildTraceContext(parent: Pick<TraceContext, "traceId" | "spanId" | "correlationId">, input?: {
    spanId?: string;
    correlationId?: string | null;
}): TraceContext;
/**
 * Converts a TransitionAuditContext to a TraceContext format.
 * Used when extracting trace context from audit records.
 */
export declare function toAuditContextTraceContext(context: TransitionAuditContext): TraceContext;
/**
 * Injects trace context into a payload object.
 * If trace context already exists in the payload, returns the payload unchanged.
 * This prevents duplicate trace context injection.
 */
export declare function injectTraceContext(payload: Record<string, unknown>, traceContext: TraceContext | null): Record<string, unknown>;
/**
 * Extracts trace context from a value that may contain a traceContext field.
 * Falls back to provided fallback values if no trace context is found.
 */
export declare function extractTraceContext(value: unknown, fallback?: {
    traceId?: string | null;
    correlationId?: string | null;
}): TraceContext | null;
