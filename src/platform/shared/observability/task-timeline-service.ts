/**
 * Task timeline aggregation service for observability and debugging.
 *
 * Builds a chronological timeline of all events, step outputs, approvals, and artifacts
 * associated with a task, providing a unified view for inspect and diagnostics.
 *
 * ## References
 * - Contract: {@link https://github.com/automatic-agent/automatic-agent-platform/tree/main/docs_zh/contracts/observability_contract.md Observability Contract}
 * - Related: {@link https://github.com/automatic-agent/automatic-agent-platform/tree/main/docs_zh/contracts/trace_and_root_cause_observability_contract.md trace_and_root_cause_observability_contract.md}
 * - Related: {@link https://github.com/automatic-agent/automatic-agent-platform/tree/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md debug_inspect_health_backpressure_contract.md}
 * - Glossary: {@link https://github.com/automatic-agent/automatic-agent-platform/tree/main/docs_zh/governance/glossary_and_terminology.md Glossary - task, workflow, step, execution, artifact, trace, inspect}
 * - Architecture: {@link https://github.com/automatic-agent/automatic-agent-platform/tree/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
 *
 * @module
 */

import type { ApprovalRecord, ArtifactRecord, EventRecord, RemoteLogRecord, StepOutputRecord } from "../../contracts/types/domain.js";

import { InspectService, type DispatchDecisionInspectTrace, type TaskInspectView } from "./inspect-service.js";
import { extractTraceContext } from "./trace-context.js";
import { StructuredLogger } from "./structured-logger.js";

const timelineLogger = new StructuredLogger({ retentionLimit: 50 });

export interface TaskTimelineEntry {
  id: string;
  kind: "event" | "step_output" | "approval" | "artifact" | "dispatch" | "remote_log";
  occurredAt: string;
  title: string;
  summary: string;
  status?: string;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  correlationId?: string | null;
  data: Record<string, unknown>;
}

function remoteLogEntry(record: RemoteLogRecord): TaskTimelineEntry {
  const context = safeParseRecord(record.contextJson);
  const traceId = typeof context?.traceId === "string" ? context.traceId : null;
  const spanId = typeof context?.spanId === "string" ? context.spanId : null;
  const parentSpanId = typeof context?.parentSpanId === "string" ? context.parentSpanId : null;
  const correlationId = typeof context?.correlationId === "string" ? context.correlationId : record.taskId;

  return {
    id: record.id,
    kind: "remote_log",
    occurredAt: record.createdAt,
    title: `remote_log:${record.level}`,
    summary: `Remote worker ${record.workerId}${record.runtimeInstanceId ? ` (${record.runtimeInstanceId})` : ""}: ${record.message}`,
    status: record.level,
    traceId,
    spanId,
    parentSpanId,
    correlationId,
    data: {
      workerId: record.workerId,
      runtimeInstanceId: record.runtimeInstanceId,
      level: record.level,
      context,
    },
  };
}

function eventEntry(event: EventRecord): TaskTimelineEntry {
  const data = JSON.parse(event.payloadJson) as Record<string, unknown>;
  const traceContext = extractTraceContext(data, {
    traceId: event.traceId,
    correlationId: event.taskId,
  });
  return {
    id: event.id,
    kind: "event",
    occurredAt: event.createdAt,
    title: event.eventType,
    summary: buildEventSummary(event, data),
    traceId: event.traceId,
    spanId: traceContext?.spanId ?? null,
    parentSpanId: traceContext?.parentSpanId ?? null,
    correlationId: traceContext?.correlationId ?? null,
    data,
  };
}

function stepOutputEntry(stepOutput: StepOutputRecord): TaskTimelineEntry {
  return {
    id: stepOutput.id,
    kind: "step_output",
    occurredAt: stepOutput.producedAt,
    title: `step:${stepOutput.stepId}`,
    summary: stepOutput.summary ?? `Step ${stepOutput.stepId} produced output`,
    status: stepOutput.status,
    data: {
      roleId: stepOutput.roleId,
      durationMs: stepOutput.durationMs,
      tokenCost: stepOutput.tokenCost,
    },
  };
}

function artifactEntry(artifact: ArtifactRecord): TaskTimelineEntry {
  return {
    id: artifact.artifactId,
    kind: "artifact",
    occurredAt: artifact.createdAt,
    title: `artifact:${artifact.kind}`,
    summary: `Artifact ${artifact.fileName} indexed for ${artifact.stepId ?? "task"}`,
    data: {
      stepId: artifact.stepId,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      checksum: artifact.checksum,
    },
  };
}

function approvalEntry(approval: ApprovalRecord): TaskTimelineEntry {
  const occurredAt = approval.respondedAt ?? approval.createdAt;
  return {
    id: approval.id,
    kind: "approval",
    occurredAt,
    title: `approval:${approval.status}`,
    summary:
      approval.status === "requested"
        ? "Approval requested"
        : `Approval moved to ${approval.status}`,
    status: approval.status,
    data: {
      executionId: approval.executionId,
      timeoutPolicy: approval.timeoutPolicy,
    },
  };
}

function dispatchEntry(decision: DispatchDecisionInspectTrace, occurredAt: string): TaskTimelineEntry {
  return {
    id: decision.ticketId,
    kind: "dispatch",
    occurredAt,
    title: `dispatch:${decision.outcome}`,
    summary: buildDispatchSummary(decision),
    status: decision.outcome,
    data: {
      queueName: decision.queueName,
      dispatchTarget: decision.dispatchTarget ?? "any",
      selectedWorkerId: decision.selectedWorkerId,
      selectedWorkerPlacement: decision.selectedWorkerPlacement,
      remoteAvailability: decision.remoteAvailability ?? null,
      fallbackApplied: decision.fallbackApplied === true,
      reasonCode: decision.reasonCode,
      remoteAcceptedWorkerIds: decision.remoteAcceptedWorkerIds,
      remoteRejectedWorkerIds: decision.remoteRejectedWorkerIds,
      localAcceptedWorkerIds: decision.localAcceptedWorkerIds,
      localRejectedWorkerIds: decision.localRejectedWorkerIds,
    },
  };
}

export class TaskTimelineService {
  public constructor(private readonly inspectService: InspectService) {}

  public buildTaskTimeline(taskId: string): {
    taskId: string;
    entries: TaskTimelineEntry[];
    inspect: TaskInspectView;
  } {
    const inspect = this.inspectService.getTaskInspectView(taskId);
    const dispatchEventTimes = new Map<string, string[]>();
    for (const event of inspect.recentEvents) {
      if (event.eventType !== "dispatch:decision_recorded") {
        continue;
      }
      const ticketId = extractDispatchTicketId(event);
      if (!ticketId) {
        continue;
      }
      const existing = dispatchEventTimes.get(ticketId) ?? [];
      existing.push(event.createdAt);
      dispatchEventTimes.set(ticketId, existing);
    }

    const entries = [
      ...inspect.recentEvents
        .filter((event) => event.eventType !== "dispatch:decision_recorded")
        .map(eventEntry),
      ...inspect.dispatchDecisions.map((decision) => dispatchEntry(decision, consumeDispatchOccurredAt(decision, dispatchEventTimes))),
      ...inspect.stepOutputs.map(stepOutputEntry),
      ...inspect.artifacts.map(artifactEntry),
      ...inspect.approvals.map(approvalEntry),
      ...this.inspectService.listRemoteLogsByTask(taskId).map(remoteLogEntry),
    ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

    return {
      taskId,
      entries,
      inspect,
    };
  }
}

function buildDispatchSummary(decision: DispatchDecisionInspectTrace): string {
  const selectedWorker =
    decision.selectedWorkerId == null
      ? null
      : decision.selectedWorkerPlacement == null
        ? decision.selectedWorkerId
        : `${decision.selectedWorkerId} (${decision.selectedWorkerPlacement})`;

  if (decision.outcome === "dispatched" && selectedWorker && decision.fallbackApplied) {
    return `Dispatch fell back to ${selectedWorker} after remote ${decision.remoteAvailability ?? "unknown"} routing`;
  }
  if (decision.outcome === "dispatched" && selectedWorker) {
    return `Dispatch routed to ${selectedWorker}`;
  }
  if (decision.outcome === "blocked") {
    return `Dispatch blocked by ${decision.reasonCode ?? "unknown_reason"}`;
  }
  return `Dispatch could not find an eligible worker${decision.remoteAvailability ? ` (${decision.remoteAvailability})` : ""}`;
}

function extractDispatchTicketId(event: EventRecord): string | null {
  try {
    const parsed = JSON.parse(event.payloadJson) as Record<string, unknown>;
    return typeof parsed.ticketId === "string" ? parsed.ticketId : null;
  } catch (err) {
    timelineLogger.log({ level: "debug", message: "Failed to extract dispatch ticket ID from event", data: { eventId: event.id, error: err } });
    return null;
  }
}

function consumeDispatchOccurredAt(
  decision: DispatchDecisionInspectTrace,
  dispatchEventTimes: Map<string, string[]>,
): string {
  const times = dispatchEventTimes.get(decision.ticketId);
  if (!times || times.length === 0) {
    return "9999-12-31T23:59:59.999Z";
  }
  return times.shift() ?? "9999-12-31T23:59:59.999Z";
}

function buildEventSummary(event: EventRecord, data: Record<string, unknown>): string {
  if (
    event.eventType === "worker:claim_rejected"
    || event.eventType === "worker:heartbeat_rejected"
    || event.eventType === "worker:writeback_rejected"
  ) {
    const reasonCode = typeof data.reasonCode === "string" ? data.reasonCode : "unknown_reason";
    const remoteSessionStatus = typeof data.remoteSessionStatus === "string" ? data.remoteSessionStatus : null;
    const action =
      event.eventType === "worker:claim_rejected"
        ? "claim"
        : event.eventType === "worker:heartbeat_rejected"
          ? "heartbeat"
          : "writeback";
    return `Worker ${action} rejected by ${reasonCode}${remoteSessionStatus ? ` (session=${remoteSessionStatus})` : ""}`;
  }

  return `Event ${event.eventType} emitted as ${event.eventTier}`;
}

function safeParseRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch (err) {
    timelineLogger.log({ level: "debug", message: "Failed to parse record JSON", data: { error: err instanceof Error ? err.message : String(err) } });
    return null;
  }
}
