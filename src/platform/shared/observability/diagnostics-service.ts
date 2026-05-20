/**
 * Diagnostics Service
 */

export * from "./diagnostics-support.js";

import { arch, platform } from "node:os";

import { ConfigGovernanceService } from "../../five-plane-control-plane/config-center/config-governance-service.js";
import { HealthService } from "./health-service.js";
import { InspectService } from "./inspect-service.js";
import { ObservabilityRetentionService } from "./observability-retention-service.js";
import { StructuredLogger, type StructuredLogEntry } from "./structured-logger.js";
import { TaskTimelineService } from "./task-timeline-service.js";
import {
  buildDiagnosticWarningSummary,
  buildIncidentRootCauses,
  buildPrimaryTraceContext,
  buildTraceSummary,
  compactionToIncidentTimelineEntry,
  countIncidentEntries,
  extractRemoteAuthorityViolations,
  extractRemoteWorkerIds,
  logToIncidentTimelineEntry,
  messageToIncidentTimelineEntry,
  previewText,
  resolveDurationMs,
  resolveHighestIncidentSeverity,
  sanitizeArtifact,
  selectRemoteTimelineEntries,
  toIncidentTimelineEntry,
  type DebugDump,
  type DiagnosticSnapshot,
  type IncidentTimelineReport,
  type MinimalReproBundle,
  type RemoteTimelineReport,
} from "./diagnostics-support.js";

let diagnosticsLogger: StructuredLogger | null = null;

function getDiagnosticsLogger(): StructuredLogger {
  diagnosticsLogger ??= new StructuredLogger({ retentionLimit: 50 });
  return diagnosticsLogger;
}


export class DiagnosticsService {
  private readonly timelineService: TaskTimelineService;
  private readonly configGovernance = new ConfigGovernanceService();

  public constructor(
    private readonly inspectService: InspectService,
    private readonly healthService: HealthService,
    private readonly logger: StructuredLogger,
    private readonly retentionService: ObservabilityRetentionService | null = null,
  ) {
    this.timelineService = new TaskTimelineService(inspectService);
  }

  /**
   * Builds a comprehensive diagnostic snapshot for a task including inspect view,
   * timeline entries, recent logs, health status, system info, and context summary.
   * @param taskId - The ID of the task to snapshot
   * @returns Complete diagnostic snapshot for the task
   */
  public buildTaskSnapshot(taskId: string): DiagnosticSnapshot {
    const timeline = this.timelineService.buildTaskTimeline(taskId);
    const messages = this.inspectService.listSessionMessages(taskId);
    const compactions = this.inspectService.listSessionCompactionRecords(taskId);
    const fileLocks = this.inspectService.listFileLocksByTask(taskId);
    const configBundle = this.safeLoadConfigBundle();
    const dispatchDecisions = timeline.inspect.dispatchDecisions;
    const latestDispatchDecision = dispatchDecisions.at(-1) ?? null;
    const remoteAuthorityViolations = extractRemoteAuthorityViolations(timeline.inspect.recentEvents);
    const retention = this.retentionService?.preview() ?? null;
    const remoteLogCount = timeline.entries.filter((entry) => entry.kind === "remote_log").length;

    return {
      taskId,
      traceSummary: buildTraceSummary(timeline.entries, timeline.inspect.execution?.traceId ?? null, taskId),
      inspect: timeline.inspect,
      timeline: timeline.entries,
      recentLogs: this.logger.recentByTask(taskId, 20),
      health: this.healthService.getReport(),
      systemInfo: {
        platform: platform(),
        arch: arch(),
        nodeVersion: process.version,
      },
      configVersion: configBundle?.version.versionId ?? "single_task_execution.default",
      promptBundleVersion: configBundle?.version.versionId ?? "single_task_execution.default",
      enabledExtensions: [],
      contextSummary: {
        messageCount: messages.length,
        compactionCount: compactions.length,
        remoteLogCount,
        dispatchDecisionCount: dispatchDecisions.length,
        latestDispatchOutcome: latestDispatchDecision?.outcome ?? null,
        remoteAuthorityViolationCount: remoteAuthorityViolations.length,
        latestRemoteAuthorityReason: remoteAuthorityViolations.at(-1) ?? null,
        remoteRouting: timeline.inspect.remoteRoutingSummary,
        leaseHandover: timeline.inspect.leaseHandoverSummary,
        activeFileLocks: fileLocks.map((lock) => ({
          id: lock.id,
          resourcePath: lock.resourcePath,
          lockMode: lock.lockMode,
          expiresAt: lock.expiresAt,
        })),
        recentMessages: messages.slice(-5).map((message) => ({
          id: message.id,
          messageType: message.messageType,
          createdAt: message.createdAt,
          contentPreview: previewText(message.content),
        })),
        recentCompactions: compactions.slice(-3).map((record) => ({
          id: record.id,
          stage: record.stage,
          createdAt: record.createdAt,
          summaryPreview: record.summaryText ? previewText(record.summaryText) : null,
        })),
      },
      retention,
    };
  }

  /**
   * Builds a debug dump containing state snapshots, event tail, provider status,
   * backpressure metrics, and generated warnings for troubleshooting task issues.
   * @param taskId - The ID of the task to debug
   * @returns Debug dump with all relevant troubleshooting information
   */
  public buildDebugDump(taskId: string): DebugDump {
    const inspect = this.inspectService.getTaskInspectView(taskId);
    const health = this.healthService.getReport();
    const messages = this.inspectService.listSessionMessages(taskId);
    const compactions = this.inspectService.listSessionCompactionRecords(taskId);
    const fileLocks = this.inspectService.listFileLocksByTask(taskId);
    const latestDispatchDecision = inspect.dispatchDecisions.at(-1) ?? null;
    const warningSignals: string[] = [];
    const remoteAuthorityViolations = extractRemoteAuthorityViolations(inspect.recentEvents);

    // Collect warnings for various unhealthy conditions
    if (health.status !== "ok") {
      warningSignals.push(`health:${health.status}`);
    }
    if (inspect.recoverySummary.activeExecutionId) {
      warningSignals.push(`active_execution:${inspect.recoverySummary.activeExecutionId}`);
    }
    if (inspect.approvals.some((approval) => approval.status === "requested")) {
      warningSignals.push("approval_pending");
    }
    if (inspect.takeoverSessions.some((session) => session.status === "open")) {
      warningSignals.push("takeover_open");
    }
    if (health.providerHealth !== "healthy") {
      warningSignals.push(`provider:${health.providerHealth}`);
    }
    if (health.degradationMode !== "none") {
      warningSignals.push(`degradation:${health.degradationMode}`);
    }
    if (latestDispatchDecision && latestDispatchDecision.outcome !== "dispatched") {
      warningSignals.push(`dispatch:${latestDispatchDecision.outcome}`);
    }
    for (const reasonCode of remoteAuthorityViolations) {
      warningSignals.push(`remote_authority:${reasonCode}`);
    }
    const warningSummary = buildDiagnosticWarningSummary(warningSignals);
    const retention = this.retentionService?.preview() ?? null;

    return {
      taskId,
      traceId: inspect.execution?.traceId ?? null,
      traceContext: buildPrimaryTraceContext(inspect.recentEvents, inspect.execution?.traceId ?? null, taskId),
      recentLogs: this.logger.recentByTask(taskId, 20),
      stateSnapshots: {
        taskStatus: inspect.task.status,
        workflowStatus: inspect.workflowState?.status ?? null,
        executionStatus: inspect.execution?.status ?? null,
        sessionStatus: inspect.session?.status ?? null,
        approvalStatuses: inspect.approvals.map((approval) => approval.status),
      },
      eventTail: inspect.recentEvents.slice(-10).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        eventTier: event.eventTier,
        createdAt: event.createdAt,
      })),
      providerStatus: {
        health: health.providerHealth,
        successRate: health.providerSuccessRate,
        recentCalls: health.providerRecentCalls,
      },
      backpressure: {
        status: health.status,
        degradationMode: health.degradationMode,
        queuedTasks: health.queuedTasks,
        activeExecutions: health.activeExecutions,
        tier1AckBacklog: health.tier1AckBacklog,
        queueGovernance: health.queueGovernance,
        workerHealth: health.workerHealth,
        healthFindings: health.findings,
      },
      recentToolCalls: messages
        .filter((message) => message.messageType === "tool_result")
        .slice(-5)
        .map((message) => ({
          messageId: message.id,
          createdAt: message.createdAt,
          contentPreview: previewText(message.content),
        })),
      contextSummary: {
        messageCount: messages.length,
        compactionCount: compactions.length,
        activeFileLockCount: fileLocks.length,
      },
      dispatchSummary: {
        totalDecisions: inspect.dispatchDecisions.length,
        latestOutcome: latestDispatchDecision?.outcome ?? null,
        latestSelectedWorkerId: latestDispatchDecision?.selectedWorkerId ?? null,
        latestSelectedWorkerPlacement: latestDispatchDecision?.selectedWorkerPlacement ?? null,
        latestRemoteAvailability: latestDispatchDecision?.remoteAvailability ?? null,
        latestFallbackApplied: latestDispatchDecision?.fallbackApplied === true,
        latestRejectedWorkers:
          latestDispatchDecision?.evaluations
            .filter((evaluation) => !evaluation.accepted)
            .map((evaluation) => evaluation.workerId) ?? [],
        latestRemoteRejectedWorkers: latestDispatchDecision?.remoteRejectedWorkerIds ?? [],
        latestRemoteAcceptedWorkers: latestDispatchDecision?.remoteAcceptedWorkerIds ?? [],
        remoteRouting: inspect.remoteRoutingSummary,
      },
      leaseSummary: inspect.leaseHandoverSummary,
      warnings: warningSummary.entries.map((entry) => entry.code),
      warningSummary,
      retention,
      logBuffer: this.logger.getBufferSummary(),
    };
  }

  /**
   * Builds a minimal reproduction bundle for sharing task context with support
   * or reproducing issues. Contains task input, relevant messages, tool usage,
   * sanitized artifacts, and configuration subset with a sensitivity warning.
   * @param taskId - The ID of the task to bundle
   * @returns Minimal repro bundle with sanitized data for sharing
   */
  public buildMinimalReproBundle(taskId: string): MinimalReproBundle {
    const inspect = this.inspectService.getTaskInspectView(taskId);
    const health = this.healthService.getReport();
    const configBundle = this.safeLoadConfigBundle();

    return {
      taskId,
      sensitivityWarning:
        "Bundle may contain session messages, logs, and configuration metadata. Review before sharing.",
      taskInputJson: inspect.task.inputJson,
      workflowState: inspect.workflowState,
      taskResult: inspect.taskResult,
      relevantMessages: this.inspectService.listSessionMessages(taskId).slice(-10),
      toolUsage: inspect.stepOutputs.map((output, index) => ({
        stepId: output.stepId ?? output.nodeRunId,
        summary: output.summary,
        dataJson: output.dataJson,
        artifactsJson: output.artifactsJson,
        result: inspect.stepResults[index]!,
      })),
      sanitizedArtifacts: inspect.artifacts.map((artifact) => sanitizeArtifact(artifact)),
      fileLocks: this.inspectService.listFileLocksByTask(taskId),
      configSubset: {
        configVersion: configBundle?.version.versionId ?? "single_task_execution.default",
        promptBundleVersion: configBundle?.version.versionId ?? "single_task_execution.default",
        enabledExtensions: [],
      },
      providerStatus: {
        health: health.providerHealth,
        successRate: health.providerSuccessRate,
        recentCalls: health.providerRecentCalls,
      },
      dispatchDecisions: inspect.dispatchDecisions,
    };
  }

  public buildIncidentTimelineReport(taskId: string): IncidentTimelineReport {
    const snapshot = this.buildTaskSnapshot(taskId);
    const debugDump = this.buildDebugDump(taskId);
    const messages = this.inspectService.listSessionMessages(taskId);
    const compactions = this.inspectService.listSessionCompactionRecords(taskId);
    const logs = this.collectIncidentLogs(taskId, snapshot.traceSummary.traceId, snapshot.traceSummary.correlationId);
    const entries = [
      ...snapshot.timeline.map((entry) => toIncidentTimelineEntry(entry)),
      ...messages.map((message) => messageToIncidentTimelineEntry(message, taskId)),
      ...compactions.map((record) => compactionToIncidentTimelineEntry(record, taskId)),
      ...logs.map((entry) => logToIncidentTimelineEntry(entry, taskId)),
    ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

    const startedAt = entries[0]?.occurredAt ?? null;
    const endedAt = entries.at(-1)?.occurredAt ?? null;

    return {
      taskId,
      traceSummary: snapshot.traceSummary,
      window: {
        startedAt,
        endedAt,
        durationMs: resolveDurationMs(startedAt, endedAt),
      },
      summary: {
        totalEntries: entries.length,
        eventCount: countIncidentEntries(entries, "event"),
        dispatchCount: countIncidentEntries(entries, "dispatch"),
        stepOutputCount: countIncidentEntries(entries, "step_output"),
        approvalCount: countIncidentEntries(entries, "approval"),
        artifactCount: countIncidentEntries(entries, "artifact"),
        logCount: countIncidentEntries(entries, "log"),
        remoteLogCount: countIncidentEntries(entries, "remote_log"),
        messageCount: countIncidentEntries(entries, "message"),
        compactionCount: countIncidentEntries(entries, "compaction"),
        highestSeverity: resolveHighestIncidentSeverity(entries, debugDump.warningSummary.highestSeverity),
      },
      warnings: debugDump.warningSummary,
      candidateRootCauses: buildIncidentRootCauses(snapshot, debugDump),
      entries,
    };
  }

  public buildRemoteTimelineReport(taskId: string): RemoteTimelineReport {
    const incident = this.buildIncidentTimelineReport(taskId);
    const entries = selectRemoteTimelineEntries(incident.entries);
    const remoteLogEntries = entries.filter((entry) => entry.source === "remote_log");

    return {
      taskId,
      traceSummary: incident.traceSummary,
      totalEntries: entries.length,
      totalRemoteLogs: remoteLogEntries.length,
      latestRemoteLogAt: remoteLogEntries.at(-1)?.occurredAt ?? null,
      remoteWorkerIds: extractRemoteWorkerIds(entries),
      entries,
    };
  }

  /**
   * Safely loads the configuration bundle, returning null if loading fails.
   * Used to include configuration metadata in diagnostic snapshots.
   * @returns The config bundle or null if unavailable
   */
  private safeLoadConfigBundle(): ReturnType<ConfigGovernanceService["loadBundle"]> | null {
    try {
      return this.configGovernance.loadBundle("dev");
    } catch (err) {
      getDiagnosticsLogger().log({ level: "warn", message: "Failed to load config bundle", data: { error: err instanceof Error ? err.message : String(err) } });
      return null;
    }
  }

  private collectIncidentLogs(
    taskId: string,
    traceId: string | null,
    correlationId: string | null,
  ): StructuredLogEntry[] {
    const deduped = new Map<string, StructuredLogEntry>();
    const pools = [
      ...this.logger.recentByTask(taskId, 100),
      ...(traceId ? this.logger.recentByTrace(traceId, 100) : []),
      ...(correlationId ? this.logger.recentByCorrelation(correlationId, 100) : []),
    ];

    for (const entry of pools) {
      const key = [
        entry.createdAt,
        entry.level,
        entry.message,
        entry.taskId ?? "",
        entry.traceId ?? "",
        entry.correlationId ?? "",
      ].join("|");
      deduped.set(key, entry);
    }

    return [...deduped.values()].sort((left, right) => {
      const leftOccurredAt = left.createdAt ?? left.timestamp;
      const rightOccurredAt = right.createdAt ?? right.timestamp;
      return leftOccurredAt.localeCompare(rightOccurredAt);
    });
  }
}
