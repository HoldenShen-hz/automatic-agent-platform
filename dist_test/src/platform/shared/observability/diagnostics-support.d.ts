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
import { type LeaseHandoverSummary, type RemoteRoutingSummary, type TaskInspectView } from "./inspect-service.js";
import { StructuredLogger, type StructuredLogEntry } from "./structured-logger.js";
import { type TaskTimelineEntry } from "./task-timeline-service.js";
import type { CompactionRecord, FileLockRecord, MessageRecord } from "../../contracts/types/domain.js";
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
        recentMessages: Array<Pick<MessageRecord, "id" | "messageType" | "createdAt"> & {
            contentPreview: string;
        }>;
        recentCompactions: Array<Pick<CompactionRecord, "id" | "stage" | "createdAt"> & {
            summaryPreview: string | null;
        }>;
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
export type DiagnosticWarningCategory = "health" | "runtime" | "approval" | "takeover" | "provider" | "dispatch" | "remote_authority" | "other";
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
export type IncidentTimelineSource = "event" | "dispatch" | "step_output" | "approval" | "artifact" | "log" | "remote_log" | "message" | "compaction";
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
export declare function buildIncidentTimelineMarkdown(report: IncidentTimelineReport): string;
export declare function extractRemoteAuthorityViolations(events: TaskInspectView["recentEvents"]): string[];
export declare function toIncidentTimelineEntry(entry: TaskTimelineEntry): IncidentTimelineEntry;
export declare function messageToIncidentTimelineEntry(message: MessageRecord, taskId: string): IncidentTimelineEntry;
export declare function compactionToIncidentTimelineEntry(record: CompactionRecord, taskId: string): IncidentTimelineEntry;
export declare function logToIncidentTimelineEntry(entry: StructuredLogEntry, taskId: string): IncidentTimelineEntry;
export declare function buildTraceSummary(entries: TaskTimelineEntry[], fallbackTraceId: string | null, fallbackCorrelationId: string | null): {
    traceId: string | null;
    correlationId: string | null;
    spanIds: string[];
};
export declare function buildPrimaryTraceContext(events: TaskInspectView["recentEvents"], fallbackTraceId: string | null, fallbackCorrelationId: string | null): TraceContext | null;
export declare function countIncidentEntries(entries: IncidentTimelineEntry[], source: IncidentTimelineSource): number;
export declare function resolveDurationMs(startedAt: string | null, endedAt: string | null): number | null;
export declare function inferTimelineSeverity(entry: TaskTimelineEntry): DiagnosticWarningSeverity;
export declare function resolveHighestIncidentSeverity(entries: IncidentTimelineEntry[], warningSeverity: DiagnosticWarningSeverity): DiagnosticWarningSeverity;
export declare function buildIncidentRootCauses(snapshot: DiagnosticSnapshot, debugDump: DebugDump): string[];
export declare function selectRemoteTimelineEntries(entries: IncidentTimelineEntry[]): IncidentTimelineEntry[];
export declare function extractRemoteWorkerIds(entries: IncidentTimelineEntry[]): string[];
/**
 * Creates a preview of text content by collapsing whitespace and truncating
 * to a maximum length for display in diagnostic outputs.
 * @param content - The text content to preview
 * @param maxLength - Maximum length of the preview (default 120 characters)
 * @returns Preview string with whitespace normalized and truncated
 */
export declare function previewText(content: string, maxLength?: number): string;
/**
 * Sanitizes an artifact record for inclusion in reproduction bundles by
 * extracting relevant fields and safely parsing the lineage JSON.
 * @param artifact - The artifact record to sanitize
 * @returns Sanitized artifact subset for external sharing
 */
export declare function sanitizeArtifact(artifact: ArtifactRecord): {
    artifactId: string;
    stepId: string | null;
    kind: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string | null;
    createdAt: string;
    lineage: Record<string, unknown> | null;
};
/**
 * Safely parses a JSON string into a record object, returning null if parsing
 * fails or the result is not a valid object. Used for parsing lineage JSON.
 * @param raw - Raw JSON string to parse
 * @returns Parsed record object or null if invalid
 */
export declare function safeParseRecord(raw: string | null): Record<string, unknown> | null;
export declare function buildDiagnosticWarningSummary(warnings: string[]): DiagnosticWarningSummary;
export declare function classifyDiagnosticWarning(code: string): Pick<DiagnosticWarningSummaryEntry, "category" | "severity" | "escalation">;
export declare function resolveHighestWarningSeverity(entries: DiagnosticWarningSummaryEntry[]): DiagnosticWarningSeverity;
export declare function warningSeverityRank(severity: DiagnosticWarningSeverity): number;
