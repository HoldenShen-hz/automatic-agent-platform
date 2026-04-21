/**
 * Diagnostics Service
 */
export * from "./diagnostics-support.js";
import { HealthService } from "./health-service.js";
import { InspectService } from "./inspect-service.js";
import { ObservabilityRetentionService } from "./observability-retention-service.js";
import { StructuredLogger } from "./structured-logger.js";
import { type DebugDump, type DiagnosticSnapshot, type IncidentTimelineReport, type MinimalReproBundle, type RemoteTimelineReport } from "./diagnostics-support.js";
export declare class DiagnosticsService {
    private readonly inspectService;
    private readonly healthService;
    private readonly logger;
    private readonly retentionService;
    private readonly timelineService;
    private readonly configGovernance;
    constructor(inspectService: InspectService, healthService: HealthService, logger: StructuredLogger, retentionService?: ObservabilityRetentionService | null);
    /**
     * Builds a comprehensive diagnostic snapshot for a task including inspect view,
     * timeline entries, recent logs, health status, system info, and context summary.
     * @param taskId - The ID of the task to snapshot
     * @returns Complete diagnostic snapshot for the task
     */
    buildTaskSnapshot(taskId: string): DiagnosticSnapshot;
    /**
     * Builds a debug dump containing state snapshots, event tail, provider status,
     * backpressure metrics, and generated warnings for troubleshooting task issues.
     * @param taskId - The ID of the task to debug
     * @returns Debug dump with all relevant troubleshooting information
     */
    buildDebugDump(taskId: string): DebugDump;
    /**
     * Builds a minimal reproduction bundle for sharing task context with support
     * or reproducing issues. Contains task input, relevant messages, tool usage,
     * sanitized artifacts, and configuration subset with a sensitivity warning.
     * @param taskId - The ID of the task to bundle
     * @returns Minimal repro bundle with sanitized data for sharing
     */
    buildMinimalReproBundle(taskId: string): MinimalReproBundle;
    buildIncidentTimelineReport(taskId: string): IncidentTimelineReport;
    buildRemoteTimelineReport(taskId: string): RemoteTimelineReport;
    /**
     * Safely loads the configuration bundle, returning null if loading fails.
     * Used to include configuration metadata in diagnostic snapshots.
     * @returns The config bundle or null if unavailable
     */
    private safeLoadConfigBundle;
    private collectIncidentLogs;
}
