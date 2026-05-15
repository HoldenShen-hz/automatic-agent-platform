import type { TransitionAuditContext } from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";
import { createChildTraceContext, createRootTraceContext } from "../../shared/observability/trace-context.js";
import type { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { AdmissionBackpressureSnapshot, AdmissionPolicy } from "../dispatcher/admission-controller.js";
import type { WorkflowCrashInjection } from "../recovery/workflow-crash-simulator.js";

export const DEFAULT_SINGLE_TASK_MAX_RETRIES = 0;
export const DEFAULT_SINGLE_TASK_RETRY_BACKOFF = "none";

export const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
  tier1AckDegradedThreshold: 100,
} as const;

export interface HappyPathInput {
  dbPath: string;
  title: string;
  request: string;
  tenantId?: string | null;
  admissionPolicy?: AdmissionPolicy;
  admissionBackpressureSnapshot?: () => AdmissionBackpressureSnapshot | null;
  crashInjection?: WorkflowCrashInjection;
  stepOutputOverride?: Record<string, unknown>;
  logger?: Pick<StructuredLogger, "log">;
}

export function createContext(
  traceContext: ReturnType<typeof createRootTraceContext>,
  reasonCode: string,
): TransitionAuditContext {
  const span = createChildTraceContext(traceContext);
  const context: TransitionAuditContext = {
    reasonCode,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId,
    actorType: "system",
    occurredAt: nowIso(),
  };
  if (span.spanId != null) {
    context.spanId = span.spanId;
  }
  if (span.correlationId != null) {
    context.correlationId = span.correlationId;
  }
  return context;
}
