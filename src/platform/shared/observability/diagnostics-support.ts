/**
 * Diagnostics Service
 *
 * Provides comprehensive diagnostic snapshots, debug dumps, and minimal reproduction
 * bundles for task debugging and support scenarios. Aggregates data from multiple
 * observability sources including the InspectService, HealthService, and StructuredLogger.
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md | Debug Inspect Health Backpressure Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/diagnostics_snapshot_and_repro_bundle_contract.md | Diagnostics Snapshot and Repro Bundle Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */

import type { ArtifactRecord, DispatchDecisionTrace, TraceContext } from "../../contracts/types/domain.js";
import type { ResultEnvelope } from "../../contracts/result-envelope/result-envelope.js";
import { type HealthStatusReport } from "./health-service.js";
import {
  type LeaseHandoverSummary,
  type RemoteRoutingSummary,
  type TaskInspectView,
} from "./inspect-service.js";
import { StructuredLogger, type StructuredLogEntry } from "./structured-logger.js";
import { type TaskTimelineEntry } from "./task-timeline-service.js";

const diagnosticsLogger = new StructuredLogger({ retentionLimit: 50 });
import type { CompactionRecord, FileLockRecord, MessageRecord } from "../../contracts/types/domain.js";
import { extractTraceContext } from "./trace-context.js";
import type { ObservabilityRetentionReport } from "./observability-retention-service.js";

/**
 * Comprehensive diagnostic snapshot for a task, including inspect view, timeline,
 * recent logs, health status, system info, and context summary.
 * Used for detailed task debugging and performance analysis.
 */
export interface DiagnosticSnapshot {
  taskId: string;
  traceSummary: {
    traceId: string | null;
    correlationId: string | null;
    spanIds: string[];
  };
  inspect: TaskInspectView;
  timeline: TaskTimelineEntry[];
  recentLogs: StructuredLogEntry[];
  health: HealthStatusReport;
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  configVersion: string;
  promptBundleVersion: string;
  enabledExtensions: string[];
  contextSummary: {
    messageCount: number;
    compactionCount: number;
    remoteLogCount: number;
    dispatchDecisionCount: number;
    latestDispatchOutcome: DispatchDecisionTrace["outcome"] | null;
    remoteAuthorityViolationCount: number;
    latestRemoteAuthorityReason: string | null;
    remoteRouting: RemoteRoutingSummary;
    leaseHandover: LeaseHandoverSummary;
    activeFileLocks: Array<Pick<FileLockRecord, "id" | "resourcePath" | "lockMode" | "expiresAt">>;
    recentMessages: Array<Pick<MessageRecord, "id" | "messageType" | "createdAt"> & { contentPreview: string }>;
    recentCompactions: Array<Pick<CompactionRecord, "id" | "stage" | "createdAt"> & { summaryPreview: string | null }>;
  };
  retention: ObservabilityRetentionReport | null;
}

/**
 * Debug dump containing state snapshots, event tail, provider status, backpressure info,
 * and warnings for troubleshooting task issues. Designed for support and debugging workflows.
 */
export interface DebugDump {
  taskId: string;
  traceId: string | null;
  traceContext: TraceContext | null;
  recentLogs: StructuredLogEntry[];
  stateSnapshots: {
    taskStatus: string;
    workflowStatus: string | null;
    executionStatus: string | null;
    sessionStatus: string | null;
    approvalStatuses: string[];
  };
  eventTail: Array<{
    id: string;
    eventType: string;
    eventTier: string;
    createdAt: string;
  }>;
  providerStatus: {
    health: HealthStatusReport["providerHealth"];
    successRate: number;
    recentCalls: number;
  };
  backpressure: {
    status: HealthStatusReport["status"];
    degradationMode: HealthStatusReport["degradationMode"];
    queuedTasks: number;
    activeExecutions: number;
    tier1AckBacklog: number;
    queueGovernance: HealthStatusReport["queueGovernance"];
    workerHealth: HealthStatusReport["workerHealth"];
    healthFindings: string[];
  };
  recentToolCalls: Array<{
    messageId: string;
    createdAt: string;
    contentPreview: string;
  }>;
  contextSummary: {
    messageCount: number;
    compactionCount: number;
    activeFileLockCount: number;
  };
  dispatchSummary: {
    totalDecisions: number;
    latestOutcome: DispatchDecisionTrace["outcome"] | null;
    latestSelectedWorkerId: string | null;
    latestSelectedWorkerPlacement: "local" | "remote" | null;
    latestRemoteAvailability: DispatchDecisionTrace["remoteAvailability"];
    latestFallbackApplied: boolean;
    latestRejectedWorkers: string[];
    latestRemoteRejectedWorkers: string[];
    latestRemoteAcceptedWorkers: string[];
    remoteRouting: RemoteRoutingSummary;
  };
  leaseSummary: LeaseHandoverSummary;
  /** Warnings detected during dump generation, e.g., health issues or pending approvals */
  warnings: string[];
  warningSummary: DiagnosticWarningSummary;
  retention: ObservabilityRetentionReport | null;
  logBuffer: ReturnType<StructuredLogger["getBufferSummary"]>;
}

export type DiagnosticWarningCategory =
  | "health"
  | "runtime"
  | "approval"
  | "takeover"
  | "provider"
  | "dispatch"
  | "remote_authority"
  | "other";

export type DiagnosticWarningSeverity = "info" | "warning" | "critical";

export type DiagnosticWarningEscalation = "none" | "task" | "operator";

export interface DiagnosticWarningSummaryEntry {
  code: string;
  category: DiagnosticWarningCategory;
  severity: DiagnosticWarningSeverity;
  escalation: DiagnosticWarningEscalation;
  count: number;
  suppressedCount: number;
}

export interface DiagnosticWarningSummary {
  totalEvents: number;
  totalUniqueWarnings: number;
  suppressedDuplicateCount: number;
  highestSeverity: DiagnosticWarningSeverity;
  escalationTargets: DiagnosticWarningEscalation[];
  entries: DiagnosticWarningSummaryEntry[];
}

/**
 * Minimal reproduction bundle for sharing task context with support or for
 * reproducing issues in a local environment. Contains sanitized artifacts and
 * task input without sensitive data.
 */
export interface MinimalReproBundle {
  taskId: string;
  sensitivityWarning: string;
  taskInputJson: string;
  workflowState: TaskInspectView["workflowState"];
  taskResult: ResultEnvelope | null;
  relevantMessages: MessageRecord[];
  toolUsage: Array<{
    stepId: string;
    summary: string | null;
    dataJson: string;
    artifactsJson: string | null;
    result: ResultEnvelope;
  }>;
  sanitizedArtifacts: Array<{
    artifactId: string;
    stepId: string | null;
    kind: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string | null;
    createdAt: string;
    lineage: Record<string, unknown> | null;
  }>;
  fileLocks: FileLockRecord[];
  configSubset: {
    configVersion: string;
    promptBundleVersion: string;
    enabledExtensions: string[];
  };
  providerStatus: {
    health: HealthStatusReport["providerHealth"];
    successRate: number;
    recentCalls: number;
  };
  dispatchDecisions: DispatchDecisionTrace[];
}

export type IncidentTimelineSource =
  | "event"
  | "dispatch"
  | "step_output"
  | "approval"
  | "artifact"
  | "log"
  | "remote_log"
  | "message"
  | "compaction";

export interface IncidentTimelineEntry {
  id: string;
  source: IncidentTimelineSource;
  occurredAt: string;
  title: string;
  summary: string;
  severity: DiagnosticWarningSeverity;
  status?: string;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
  correlationId?: string | null;
  data: Record<string, unknown>;
}

export interface IncidentTimelineReport {
  taskId: string;
  traceSummary: DiagnosticSnapshot["traceSummary"];
  window: {
    startedAt: string | null;
    endedAt: string | null;
    durationMs: number | null;
  };
  summary: {
    totalEntries: number;
    eventCount: number;
    dispatchCount: number;
    stepOutputCount: number;
    approvalCount: number;
    artifactCount: number;
    logCount: number;
    remoteLogCount: number;
    messageCount: number;
    compactionCount: number;
    highestSeverity: DiagnosticWarningSeverity;
  };
  warnings: DiagnosticWarningSummary;
  candidateRootCauses: string[];
  entries: IncidentTimelineEntry[];
}

export interface RemoteTimelineReport {
  taskId: string;
  traceSummary: DiagnosticSnapshot["traceSummary"];
  totalEntries: number;
  totalRemoteLogs: number;
  latestRemoteLogAt: string | null;
  remoteWorkerIds: string[];
  entries: IncidentTimelineEntry[];
}

/**
 * DiagnosticsService aggregates observability data from multiple sources to provide
 * comprehensive debugging information. It combines task inspect views, timelines,
 * logs, health reports, and configuration data into actionable diagnostic packages.
 */



export function buildIncidentTimelineMarkdown(report: IncidentTimelineReport): string {
  const lines = [
    `# Incident Timeline: ${report.taskId}`,
    "",
    `- Trace ID: ${report.traceSummary.traceId ?? "n/a"}`,
    `- Correlation ID: ${report.traceSummary.correlationId ?? "n/a"}`,
    `- Window: ${report.window.startedAt ?? "n/a"} -> ${report.window.endedAt ?? "n/a"}`,
    `- Duration (ms): ${report.window.durationMs ?? "n/a"}`,
    `- Highest severity: ${report.summary.highestSeverity}`,
    `- Total entries: ${report.summary.totalEntries}`,
    "",
    "## Source Counts",
    "",
    `- events: ${report.summary.eventCount}`,
    `- dispatches: ${report.summary.dispatchCount}`,
    `- step outputs: ${report.summary.stepOutputCount}`,
    `- approvals: ${report.summary.approvalCount}`,
    `- artifacts: ${report.summary.artifactCount}`,
    `- logs: ${report.summary.logCount}`,
    `- remote logs: ${report.summary.remoteLogCount}`,
    `- messages: ${report.summary.messageCount}`,
    `- compactions: ${report.summary.compactionCount}`,
    "",
    "## Candidate Root Causes",
    "",
    ...report.candidateRootCauses.map((item) => `- ${item}`),
    "",
    "## Warning Summary",
    "",
    `- Unique warnings: ${report.warnings.totalUniqueWarnings}`,
    `- Suppressed duplicates: ${report.warnings.suppressedDuplicateCount}`,
    ...report.warnings.entries.map(
      (entry) =>
        `- ${entry.code} [${entry.category}] severity=${entry.severity} escalation=${entry.escalation} count=${entry.count}`,
    ),
    "",
    "## Timeline",
    "",
    ...report.entries.map(
      (entry) =>
        `- ${entry.occurredAt} [${entry.source}] [${entry.severity}] ${entry.title}: ${entry.summary}`,
    ),
  ];

  return lines.join("\n");
}

export function extractRemoteAuthorityViolations(events: TaskInspectView["recentEvents"]): string[] {
  const violations: string[] = [];
  for (const event of events) {
    if (
      event.eventType !== "worker:claim_rejected"
      && event.eventType !== "worker:heartbeat_rejected"
      && event.eventType !== "worker:writeback_rejected"
    ) {
      continue;
    }
    try {
      const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
      const reasonCode = typeof payload.reasonCode === "string" ? payload.reasonCode : null;
      if (reasonCode != null && reasonCode.startsWith("remote_session_")) {
        violations.push(reasonCode);
      }
    } catch (err) {
      diagnosticsLogger.log({ level: "debug", message: "Failed to parse event payload for remote authority violation extraction", data: { eventId: event.id, error: err instanceof Error ? err.message : String(err) } });
      continue;
    }
  }
  return violations;
}

export function toIncidentTimelineEntry(entry: TaskTimelineEntry): IncidentTimelineEntry {
  return {
    id: entry.id,
    source: entry.kind,
    occurredAt: entry.occurredAt,
    title: entry.title,
    summary: entry.summary,
    severity: inferTimelineSeverity(entry),
    traceId: entry.traceId ?? null,
    spanId: entry.spanId ?? null,
    parentSpanId: entry.parentSpanId ?? null,
    correlationId: entry.correlationId ?? null,
    ...(entry.status ? { status: entry.status } : {}),
    data: entry.data,
  };
}

export function messageToIncidentTimelineEntry(message: MessageRecord, taskId: string): IncidentTimelineEntry {
  return {
    id: message.id,
    source: "message",
    occurredAt: message.createdAt,
    title: `message:${message.messageType}`,
    summary: `${message.direction} ${message.messageType} message: ${previewText(message.content, 160)}`,
    severity: "info",
    correlationId: taskId,
    data: {
      sessionId: message.sessionId,
      direction: message.direction,
      attachmentsPresent: message.attachmentsJson != null,
      contentLength: message.content.length,
    },
  };
}

export function compactionToIncidentTimelineEntry(record: CompactionRecord, taskId: string): IncidentTimelineEntry {
  return {
    id: record.id,
    source: "compaction",
    occurredAt: record.createdAt,
    title: `compaction:${record.stage}`,
    summary: `Context compaction ${record.stage}: ${previewText(record.summaryText ?? record.compactionReason, 160)}`,
    severity: "info",
    correlationId: taskId,
    data: {
      sessionId: record.sessionId,
      compactionReason: record.compactionReason,
      overflowTriggered: record.overflowTriggered === 1,
      autoTriggered: record.autoTriggered === 1,
      tokenReductionEstimate: record.tokenReductionEstimate,
    },
  };
}

export function logToIncidentTimelineEntry(entry: StructuredLogEntry, taskId: string): IncidentTimelineEntry {
  return {
    id: [entry.createdAt, entry.level, entry.message].join(":"),
    source: "log",
    occurredAt: entry.createdAt,
    title: `log:${entry.level}`,
    summary: previewText(entry.message, 160),
    severity: entry.level === "error" ? "critical" : entry.level === "warn" ? "warning" : "info",
    traceId: entry.traceId ?? null,
    spanId: entry.spanId ?? null,
    parentSpanId: entry.parentSpanId ?? null,
    correlationId: entry.correlationId ?? entry.taskId ?? taskId,
    data: {
      taskId: entry.taskId ?? null,
      agentId: entry.agentId ?? null,
      sessionId: entry.sessionId ?? null,
      stepId: entry.stepId ?? null,
      data: entry.data ?? null,
    },
  };
}

export function buildTraceSummary(entries: TaskTimelineEntry[], fallbackTraceId: string | null, fallbackCorrelationId: string | null): {
  traceId: string | null;
  correlationId: string | null;
  spanIds: string[];
} {
  const firstWithTrace = entries.find((entry) => entry.traceId != null || entry.correlationId != null || entry.spanId != null);
  return {
    traceId: firstWithTrace?.traceId ?? fallbackTraceId,
    correlationId: firstWithTrace?.correlationId ?? fallbackCorrelationId ?? fallbackTraceId,
    spanIds: [...new Set(entries.map((entry) => entry.spanId).filter((value): value is string => typeof value === "string"))],
  };
}

export function buildPrimaryTraceContext(
  events: TaskInspectView["recentEvents"],
  fallbackTraceId: string | null,
  fallbackCorrelationId: string | null,
): TraceContext | null {
  for (const event of events) {
    const parsed = safeParseRecord(event.payloadJson);
    const traceContext = extractTraceContext(parsed, {
      traceId: event.traceId,
      correlationId: event.taskId ?? fallbackCorrelationId ?? fallbackTraceId,
    });
    if (traceContext) {
      return traceContext;
    }
  }

  if (fallbackTraceId == null) {
    return null;
  }
  return {
    traceId: fallbackTraceId,
    spanId: null,
    parentSpanId: null,
    correlationId: fallbackCorrelationId ?? fallbackTraceId,
  };
}

export function countIncidentEntries(entries: IncidentTimelineEntry[], source: IncidentTimelineSource): number {
  return entries.filter((entry) => entry.source === source).length;
}

export function resolveDurationMs(startedAt: string | null, endedAt: string | null): number | null {
  if (startedAt == null || endedAt == null) {
    return null;
  }
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) {
    return null;
  }
  return Math.max(0, ended - started);
}

export function inferTimelineSeverity(entry: TaskTimelineEntry): DiagnosticWarningSeverity {
  if (entry.kind === "dispatch" && entry.status === "blocked") {
    return "warning";
  }
  if (entry.kind === "remote_log") {
    const level = typeof entry.data.level === "string" ? entry.data.level : "info";
    return level === "error" ? "critical" : level === "warn" ? "warning" : "info";
  }
  if (
    entry.kind === "event"
    && (entry.title === "worker:claim_rejected"
      || entry.title === "worker:heartbeat_rejected"
      || entry.title === "worker:writeback_rejected")
  ) {
    const reasonCode = typeof entry.data.reasonCode === "string" ? entry.data.reasonCode : "";
    return reasonCode.startsWith("remote_session_") ? "critical" : "warning";
  }
  if (entry.kind === "approval" && entry.status === "requested") {
    return "warning";
  }
  return "info";
}

export function resolveHighestIncidentSeverity(
  entries: IncidentTimelineEntry[],
  warningSeverity: DiagnosticWarningSeverity,
): DiagnosticWarningSeverity {
  const entrySeverity = resolveHighestWarningSeverity(
    entries.map((entry, index) => ({
      code: `${entry.source}:${index}`,
      category: "other",
      severity: entry.severity,
      escalation: "none",
      count: 1,
      suppressedCount: 0,
    })),
  );
  return warningSeverityRank(warningSeverity) >= warningSeverityRank(entrySeverity)
    ? warningSeverity
    : entrySeverity;
}

export function buildIncidentRootCauses(snapshot: DiagnosticSnapshot, debugDump: DebugDump): string[] {
  const hints: string[] = [];
  const latestDispatchDecision = snapshot.inspect.dispatchDecisions.at(-1) ?? null;

  if (snapshot.contextSummary.remoteAuthorityViolationCount > 0) {
    hints.push("Remote worker session authority failed; inspect resume offset, reconnect state, and fencing ownership.");
  }
  if (latestDispatchDecision?.outcome === "blocked") {
    hints.push(`Dispatch was blocked by ${latestDispatchDecision.reasonCode ?? "unknown_reason"} and no eligible worker accepted the task.`);
  } else if (latestDispatchDecision?.fallbackApplied) {
    hints.push("Remote routing degraded and the task fell back to a local worker after remote placement was unavailable.");
  }
  if (snapshot.inspect.approvals.some((approval) => approval.status === "requested")) {
    hints.push("Execution is waiting on an operator approval before it can continue.");
  }
  const remoteErrorLogCount = snapshot.timeline.filter(
    (entry) =>
      entry.kind === "remote_log"
      && (entry.data.level === "error" || entry.data.level === "warn"),
  ).length;
  if (remoteErrorLogCount > 0) {
    hints.push(`Remote worker emitted ${remoteErrorLogCount} warning/error log entries; inspect the remote timeline for runtime-specific failure context.`);
  }
  if (debugDump.providerStatus.health === "failed") {
    hints.push("Provider health is failed; inspect upstream model timeouts, quota, or credential issues.");
  } else if (debugDump.providerStatus.health !== "healthy") {
    hints.push(`Provider health is ${debugDump.providerStatus.health}; expect degraded model or tool responsiveness.`);
  }
  if (snapshot.inspect.workflowState?.lastErrorCode) {
    hints.push(`Workflow recorded lastErrorCode=${snapshot.inspect.workflowState.lastErrorCode}.`);
  } else if (snapshot.inspect.task.errorCode) {
    hints.push(`Task recorded errorCode=${snapshot.inspect.task.errorCode}.`);
  }
  if (hints.length === 0) {
    hints.push("No critical warning signature was detected; inspect step outputs, messages, and logs for semantic failure context.");
  }

  return [...new Set(hints)];
}

export function selectRemoteTimelineEntries(entries: IncidentTimelineEntry[]): IncidentTimelineEntry[] {
  return entries.filter((entry) => {
    if (entry.source === "remote_log") {
      return true;
    }
    if (entry.source === "dispatch") {
      return (
        entry.data.dispatchTarget === "prefer_remote"
        || entry.data.dispatchTarget === "require_remote"
        || entry.data.selectedWorkerPlacement === "remote"
        || entry.data.remoteAvailability != null
      );
    }
    if (entry.source === "event") {
      return entry.title.startsWith("worker:") || entry.title === "lease:handover_recorded";
    }
    return false;
  });
}

export function extractRemoteWorkerIds(entries: IncidentTimelineEntry[]): string[] {
  const workerIds = new Set<string>();
  for (const entry of entries) {
    if (typeof entry.data.workerId === "string" && entry.data.workerId.length > 0) {
      workerIds.add(entry.data.workerId);
    }
    if (typeof entry.data.selectedWorkerId === "string" && entry.data.selectedWorkerPlacement === "remote") {
      workerIds.add(entry.data.selectedWorkerId);
    }
    const acceptedIds = Array.isArray(entry.data.remoteAcceptedWorkerIds) ? entry.data.remoteAcceptedWorkerIds : [];
    for (const value of acceptedIds) {
      if (typeof value === "string" && value.length > 0) {
        workerIds.add(value);
      }
    }
    const rejectedIds = Array.isArray(entry.data.remoteRejectedWorkerIds) ? entry.data.remoteRejectedWorkerIds : [];
    for (const value of rejectedIds) {
      if (typeof value === "string" && value.length > 0) {
        workerIds.add(value);
      }
    }
  }
  return [...workerIds].sort();
}

/**
 * Creates a preview of text content by collapsing whitespace and truncating
 * to a maximum length for display in diagnostic outputs.
 * @param content - The text content to preview
 * @param maxLength - Maximum length of the preview (default 120 characters)
 * @returns Preview string with whitespace normalized and truncated
 */
export function previewText(content: string, maxLength: number = 120): string {
  return content.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/**
 * Sanitizes an artifact record for inclusion in reproduction bundles by
 * extracting relevant fields and safely parsing the lineage JSON.
 * @param artifact - The artifact record to sanitize
 * @returns Sanitized artifact subset for external sharing
 */
export function sanitizeArtifact(artifact: ArtifactRecord): {
  artifactId: string;
  stepId: string | null;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  createdAt: string;
  lineage: Record<string, unknown> | null;
} {
  return {
    artifactId: artifact.artifactId,
    stepId: artifact.stepId,
    kind: artifact.kind,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes,
    checksum: artifact.checksum,
    createdAt: artifact.createdAt,
    lineage: safeParseRecord(artifact.lineageJson),
  };
}

/**
 * Safely parses a JSON string into a record object, returning null if parsing
 * fails or the result is not a valid object. Used for parsing lineage JSON.
 * @param raw - Raw JSON string to parse
 * @returns Parsed record object or null if invalid
 */
export function safeParseRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch (err) {
    diagnosticsLogger.log({ level: "debug", message: "Failed to parse record JSON", data: { error: err instanceof Error ? err.message : String(err) } });
    return null;
  }
}

export function buildDiagnosticWarningSummary(warnings: string[]): DiagnosticWarningSummary {
  const entriesByCode = new Map<string, DiagnosticWarningSummaryEntry>();
  for (const warning of warnings) {
    const existing = entriesByCode.get(warning);
    if (existing) {
      existing.count += 1;
      existing.suppressedCount += 1;
      continue;
    }
    const classification = classifyDiagnosticWarning(warning);
    entriesByCode.set(warning, {
      code: warning,
      category: classification.category,
      severity: classification.severity,
      escalation: classification.escalation,
      count: 1,
      suppressedCount: 0,
    });
  }

  const entries = [...entriesByCode.values()];
  const escalationTargets = [...new Set(entries.map((entry) => entry.escalation).filter((value) => value !== "none"))];

  return {
    totalEvents: warnings.length,
    totalUniqueWarnings: entries.length,
    suppressedDuplicateCount: warnings.length - entries.length,
    highestSeverity: resolveHighestWarningSeverity(entries),
    escalationTargets,
    entries,
  };
}

export function classifyDiagnosticWarning(code: string): Pick<DiagnosticWarningSummaryEntry, "category" | "severity" | "escalation"> {
  if (code.startsWith("health:")) {
    const status = code.slice("health:".length);
    if (status === "unhealthy" || status === "overloaded") {
      return { category: "health", severity: "critical", escalation: "operator" };
    }
    return { category: "health", severity: "warning", escalation: "task" };
  }

  if (code.startsWith("provider:")) {
    const providerHealth = code.slice("provider:".length);
    if (providerHealth === "failed") {
      return { category: "provider", severity: "critical", escalation: "operator" };
    }
    return { category: "provider", severity: "warning", escalation: "task" };
  }

  if (code.startsWith("remote_authority:")) {
    return { category: "remote_authority", severity: "critical", escalation: "operator" };
  }

  if (code.startsWith("dispatch:")) {
    const outcome = code.slice("dispatch:".length);
    if (outcome === "blocked") {
      return { category: "dispatch", severity: "warning", escalation: "task" };
    }
    return { category: "dispatch", severity: "info", escalation: "none" };
  }

  if (code === "approval_pending") {
    return { category: "approval", severity: "warning", escalation: "operator" };
  }

  if (code === "takeover_open") {
    return { category: "takeover", severity: "warning", escalation: "operator" };
  }

  if (code.startsWith("active_execution:")) {
    return { category: "runtime", severity: "info", escalation: "none" };
  }

  if (code.startsWith("degradation:")) {
    return { category: "runtime", severity: "warning", escalation: "task" };
  }

  return { category: "other", severity: "warning", escalation: "task" };
}

export function resolveHighestWarningSeverity(entries: DiagnosticWarningSummaryEntry[]): DiagnosticWarningSeverity {
  let highestRank = 0;
  let highestSeverity: DiagnosticWarningSeverity = "info";
  for (const entry of entries) {
    const rank = warningSeverityRank(entry.severity);
    if (rank > highestRank) {
      highestRank = rank;
      highestSeverity = entry.severity;
    }
  }
  return highestSeverity;
}

export function warningSeverityRank(severity: DiagnosticWarningSeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "info":
    default:
      return 1;
  }
}
