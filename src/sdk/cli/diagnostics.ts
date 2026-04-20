/**
 * Diagnostics CLI
 *
 * This module provides a command-line interface for generating various diagnostic
 * reports about tasks and system health. It supports snapshots, debug dumps,
 * incident timelines, repro bundles, stalled execution escalations, and metrics.
 *
 * Environment Variables (via loadDiagnosticsCliEnv):
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *   - AA_DIAGNOSTICS_KIND: Type of diagnostic to generate (required)
 *   - AA_TASK_ID: Target task identifier (required for most diagnostics)
 *   - AA_ARTIFACT_ROOT: Root directory for artifact export
 *
 * Kinds:
 *   - snapshot: Build a task state snapshot
 *   - debug: Build a debug dump with full context
 *   - incident: Build an incident timeline report
 *   - remote-timeline: Build a remote timeline report
 *   - repro: Build a minimal repro bundle
 *   - export: Export minimal repro bundle to disk
 *   - stalled-escalation: List stalled execution escalation packages
 *   - stalled-escalation-export: Export stalled escalations to disk
 *   - incident-export: Export incident timeline to disk
 *   - metrics: Build system metrics summary
 *
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for diagnostics architecture
 * @see {@link docs_zh/contracts/observability_contract.md} for health and diagnostics contracts
 */

import { withCliStorage } from "./authoritative-storage.js";
import { bootstrapGovernanceServices } from "./governance-bootstrap.js";
import { loadDiagnosticsCliEnv } from "../../platform/control-plane/config-center/diagnostics-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { DiagnosticsExportService } from "../../platform/shared/observability/diagnostics-export-service.js";
import { MetricsService } from "../../platform/shared/observability/metrics-service.js";
import { StalledExecutionEscalationService } from "../../platform/execution/recovery/stalled-execution-escalation-service.js";

/**
 * Validates and returns the task ID from environment.
 *
 * @param taskId - The task ID to validate
 * @returns The validated task ID string
 * @throws ValidationError if task ID is null
 */
function requireTaskId(taskId: string | null): string {
  if (taskId == null) {
    throw new ValidationError("missing_env:AA_TASK_ID", "missing_env:AA_TASK_ID");
  }
  return taskId;
}

/**
 * Main entry point for the diagnostics CLI.
 *
 * Initializes the database and services, generates the requested diagnostic report
 * based on AA_DIAGNOSTICS_KIND, and outputs the result as formatted JSON.
 */
function main(): void {
  const envConfig = loadDiagnosticsCliEnv();
  const output = withCliStorage((storage) => {
    const dbPath = storage.sql.filePath;
    // Call bootstrap once and reuse all services
    const { diagnostics, health, stalledDetector } = bootstrapGovernanceServices({ storage, dbPath });

    const stalledEscalationService = new StalledExecutionEscalationService(
      stalledDetector,
      diagnostics,
    );
    const taskIdFilter = envConfig.taskId;
    const stalledEscalations = taskIdFilter == null
      ? stalledEscalationService.buildPackages()
      : stalledEscalationService.buildPackages().filter((item) => item.taskId === taskIdFilter);

    switch (envConfig.kind) {
      case "snapshot":
        return diagnostics.buildTaskSnapshot(requireTaskId(envConfig.taskId));
      case "debug":
        return diagnostics.buildDebugDump(requireTaskId(envConfig.taskId));
      case "incident":
        return diagnostics.buildIncidentTimelineReport(requireTaskId(envConfig.taskId));
      case "remote-timeline":
        return diagnostics.buildRemoteTimelineReport(requireTaskId(envConfig.taskId));
      case "repro":
        return diagnostics.buildMinimalReproBundle(requireTaskId(envConfig.taskId));
      case "export":
        return new DiagnosticsExportService(diagnostics, storage.store, {
          rootDir: envConfig.artifactRoot,
        }).exportMinimalReproBundle(requireTaskId(envConfig.taskId));
      case "stalled-escalation":
        return stalledEscalations;
      case "stalled-escalation-export":
        return new DiagnosticsExportService(diagnostics, storage.store, {
          rootDir: envConfig.artifactRoot,
        }).exportStalledExecutionEscalations(stalledEscalations);
      case "incident-export":
        return new DiagnosticsExportService(diagnostics, storage.store, {
          rootDir: envConfig.artifactRoot,
        }).exportIncidentTimeline(requireTaskId(envConfig.taskId));
      case "metrics":
        return new MetricsService(storage.sql, health).buildSummary();
      default:
        throw new ValidationError(`unknown_diagnostics_kind:${envConfig.kind}`, `unknown_diagnostics_kind:${envConfig.kind}`);
    }
  }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
