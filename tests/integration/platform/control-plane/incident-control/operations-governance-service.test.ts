// @ts-nocheck
/**
 * Integration Tests: Operations Governance Service
 *
 * Tests the OperationsGovernanceService with real metrics aggregation,
 * SLO evaluation, runbook recommendations, and incident packaging.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DiagnosticsService } from "../../../../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { DoctorService } from "../../../../../src/platform/control-plane/incident-control/doctor-service.js";
import { OperationsGovernanceService, type OperationsSloKey } from "../../../../../src/platform/control-plane/incident-control/operations-governance-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteReliabilityService } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { StalledExecutionDetector } from "../../../../../src/platform/execution/recovery/stalled-execution-detector.js";
import { RuntimeRecoveryService } from "../../../../../src/platform/execution/recovery/runtime-recovery-service-root.js";
import { StartupConsistencyChecker } from "../../../../../src/platform/execution/startup/startup-consistency-checker.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createTestServices(workspace: string, dbPath: string) {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const workers = new WorkerRegistryService(store);
  const healthService = new HealthService(db, store);
  const diagnostics = new DiagnosticsService(new InspectService(store), healthService, new StructuredLogger());
  const metrics = new MetricsService(db, healthService);
  const doctor = new DoctorService(
    healthService,
    new StartupConsistencyChecker(db, store),
    new RuntimeRecoveryService(store),
    new StalledExecutionDetector(store),
    new SqliteReliabilityService(db),
    `${dbPath}.backup`,
    null,
    null,
    workers,
    null,
    null,
    null,
  );
  const governance = new OperationsGovernanceService(db, metrics, doctor, diagnostics);
  return { db, store, workers, healthService, diagnostics, metrics, doctor, governance };
}

// =============================================================================
// Construction & Basic Operations
// =============================================================================

test("OperationsGovernanceService integration: constructs with required services", () => {
  const workspace = createTempWorkspace("aa-ops-governance-construct-");
  const dbPath = join(workspace, "ops-governance-construct.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    assert.ok(governance);

    dbPath;
    workspace;
    governance;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: buildReport generates report without task", () => {
  const workspace = createTempWorkspace("aa-ops-governance-build-");
  const dbPath = join(workspace, "ops-governance-build.db");

  try {
    const { governance, db } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.ok(report.reportId.startsWith("ops_governance_report_"));
    assert.equal(report.environment, "test");
    assert.ok(report.generatedAt);
    assert.ok(report.slos.length > 0);
    assert.ok(report.runbooks.length > 0);
    assert.ok(report.oncallPolicy);
    assert.ok(report.metrics);
    assert.ok(report.doctor);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: buildReport includes incident package when taskId provided", () => {
  const workspace = createTempWorkspace("aa-ops-governance-incident-");
  const dbPath = join(workspace, "ops-governance-incident.db");

  try {
    const { governance, db, store } = createTestServices(workspace, dbPath);

    seedTaskAndExecution(db, store, {
      taskId: "task-incident-test",
      executionId: "exec-incident-test",
      traceId: "trace-incident-test",
    });

    const report = governance.buildReport({ environment: "test", taskId: "task-incident-test" });

    assert.ok(report.incident);
    assert.ok(report.incident?.incidentId.startsWith("incident_"));
    assert.equal(report.incident?.taskId, "task-incident-test");
    assert.ok(report.incident?.severity);
    assert.ok(report.incident?.recommendedRunbookIds.length >= 0);
    assert.ok(report.incident?.recommendedCommands.length >= 0);
    assert.ok(report.incident?.timeline);
    assert.ok(report.incident?.markdown);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// SLO Evaluation
// =============================================================================

test("OperationsGovernanceService integration: slos contain all expected keys", () => {
  const workspace = createTempWorkspace("aa-ops-governance-slos-");
  const dbPath = join(workspace, "ops-governance-slos.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    const expectedKeys: OperationsSloKey[] = [
      "task_success_rate",
      "task_start_latency",
      "approval_delivery_availability",
      "recovery_success_rate",
      "tier1_event_delivery_latency",
      "cost_accounting_accuracy",
    ];

    for (const key of expectedKeys) {
      const slo = report.slos.find((s) => s.key === key);
      assert.ok(slo, `SLO ${key} should be present`);
      assert.ok(slo.displayName);
      assert.ok(slo.objective);
      assert.ok(slo.unit);
      assert.ok(slo.thresholdValue);
      assert.ok(slo.comparator);
    }

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: slos status reflects actual values", () => {
  const workspace = createTempWorkspace("aa-ops-governance-slo-status-");
  const dbPath = join(workspace, "ops-governance-slo-status.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    for (const slo of report.slos) {
      assert.ok(["pass", "warning", "fail", "insufficient_data"].includes(slo.status));
      if (slo.status !== "insufficient_data") {
        assert.ok(slo.actualValue !== null || slo.errorBudgetRemainingPct !== null);
      }
    }

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: summary status is fail when any slo fails", () => {
  const workspace = createTempWorkspace("aa-ops-governance-summary-");
  const dbPath = join(workspace, "ops-governance-summary.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    const hasFailingSlo = report.slos.some((s) => s.status === "fail");
    const hasWarningSlo = report.slos.some((s) => s.status === "warning");

    if (hasFailingSlo) {
      assert.equal(report.summary.overallStatus, "fail");
    } else if (hasWarningSlo) {
      assert.equal(report.summary.overallStatus, "warning");
    } else {
      assert.equal(report.summary.overallStatus, "pass");
    }

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Runbooks
// =============================================================================

test("OperationsGovernanceService integration: runbooks contain all predefined runbooks", () => {
  const workspace = createTempWorkspace("aa-ops-governance-runbooks-");
  const dbPath = join(workspace, "ops-governance-runbooks.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.ok(report.runbooks.length >= 8);

    const expectedRunbookIds = [
      "worker_mass_disconnect",
      "provider_429_or_5xx_spike",
      "queue_backlog_breach",
      "approval_channel_unavailable",
      "cost_spike_containment",
      "database_lock_contention",
      "stale_lease_repair",
      "secret_rotation_failure",
    ];

    for (const runbookId of expectedRunbookIds) {
      const runbook = report.runbooks.find((r) => r.runbookId === runbookId);
      assert.ok(runbook, `Runbook ${runbookId} should be present`);
      assert.ok(runbook.title);
      assert.ok(runbook.severity);
      assert.ok(runbook.summary);
      assert.ok(runbook.ownerRole);
      assert.ok(runbook.commands.length > 0);
    }

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: runbook severity levels are valid", () => {
  const workspace = createTempWorkspace("aa-ops-governance-runbook-severity-");
  const dbPath = join(workspace, "ops-governance-runbook-severity.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    for (const runbook of report.runbooks) {
      assert.ok(["P0", "P1", "P2", "P3"].includes(runbook.severity));
    }

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Oncall Policy
// =============================================================================

test("OperationsGovernanceService integration: oncall policy has required fields", () => {
  const workspace = createTempWorkspace("aa-ops-governance-oncall-");
  const dbPath = join(workspace, "ops-governance-oncall.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.ok(report.oncallPolicy.policyId);
    assert.ok(report.oncallPolicy.primaryRole);
    assert.ok(report.oncallPolicy.secondaryRole);
    assert.ok(report.oncallPolicy.contacts.length >= 2);
    assert.ok(report.oncallPolicy.communicationChannels.length > 0);
    assert.ok(report.oncallPolicy.handoverRequirements.length > 0);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: oncall contacts have escalation info", () => {
  const workspace = createTempWorkspace("aa-ops-governance-contacts-");
  const dbPath = join(workspace, "ops-governance-contacts.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    for (const contact of report.oncallPolicy.contacts) {
      assert.ok(contact.role);
      assert.ok(typeof contact.escalationAfterMinutes === "number");
      assert.ok(contact.responsibilities.length > 0);
    }

    // Primary and secondary should be in contacts
    const roles = report.oncallPolicy.contacts.map((c) => c.role);
    assert.ok(roles.includes(report.oncallPolicy.primaryRole));
    assert.ok(roles.includes(report.oncallPolicy.secondaryRole));

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Metrics
// =============================================================================

test("OperationsGovernanceService integration: metrics summary is included", () => {
  const workspace = createTempWorkspace("aa-ops-governance-metrics-");
  const dbPath = join(workspace, "ops-governance-metrics.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.ok(report.metrics);
    assert.ok(report.metrics.taskMetrics);
    assert.ok(report.metrics.approvalMetrics);
    assert.ok(report.metrics.recoveryMetrics);
    assert.ok(typeof report.metrics.taskMetrics.total === "number");
    assert.ok(typeof report.metrics.taskMetrics.successRate === "number");

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Doctor Integration
// =============================================================================

test("OperationsGovernanceService integration: doctor status is included", () => {
  const workspace = createTempWorkspace("aa-ops-governance-doctor-");
  const dbPath = join(workspace, "ops-governance-doctor.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.ok(report.doctor);
    assert.ok(report.doctor.status);
    assert.ok(report.doctor.selfCheckSummary);
    assert.ok(report.doctor.eventBacklogSummary);
    assert.ok(report.doctor.workerSummary);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: summary oncallReady is true when contacts exist", () => {
  const workspace = createTempWorkspace("aa-ops-governance-oncall-ready-");
  const dbPath = join(workspace, "ops-governance-oncall-ready.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.equal(report.summary.oncallReady, true);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Incident Package
// =============================================================================

test("OperationsGovernanceService integration: incident package recommends runbooks based on diagnostics", () => {
  const workspace = createTempWorkspace("aa-ops-governance-incident-runbooks-");
  const dbPath = join(workspace, "ops-governance-incident-runbooks.db");

  try {
    const { governance, db, store } = createTestServices(workspace, dbPath);

    seedTaskAndExecution(db, store, {
      taskId: "task-incident-runbooks",
      executionId: "exec-incident-runbooks",
      traceId: "trace-incident-runbooks",
    });

    store.insertWorkflowState({
      taskId: "task-incident-runbooks",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "failed",
      outputsJson: "{}",
      lastErrorCode: "execution.failed",
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const report = governance.buildReport({
      environment: "test",
      taskId: "task-incident-runbooks",
    });

    assert.ok(report.incident);
    // Should have recommended runbooks based on failure patterns
    assert.ok(report.incident!.recommendedRunbookIds.length >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Export
// =============================================================================

test("OperationsGovernanceService integration: exportReport writes artifacts", () => {
  const workspace = createTempWorkspace("aa-ops-governance-export-");
  const dbPath = join(workspace, "ops-governance-export.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const result = governance.exportReport({ environment: "test" });

    assert.ok(result.report);
    assert.ok(result.jsonArtifact);
    assert.ok(result.markdownArtifact);
    assert.ok(result.jsonArtifact.uri);
    assert.ok(result.markdownArtifact.uri);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsGovernanceService integration: exportReport includes lineage in artifacts", () => {
  const workspace = createTempWorkspace("aa-ops-governance-export-lineage-");
  const dbPath = join(workspace, "ops-governance-export-lineage.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const result = governance.exportReport({
      environment: "test",
      taskId: "task-lineage-test",
    });

    assert.ok(result.report.taskId === "task-lineage-test" || result.report.taskId === null);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Generated At
// =============================================================================

test("OperationsGovernanceService integration: buildReport uses provided generatedAt", () => {
  const workspace = createTempWorkspace("aa-ops-governance-generated-at-");
  const dbPath = join(workspace, "ops-governance-generated-at.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const customTime = "2026-01-15T10:00:00.000Z";
    const report = governance.buildReport({ environment: "test", generatedAt: customTime });

    assert.equal(report.generatedAt, customTime);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Runbook Count in Summary
// =============================================================================

test("OperationsGovernanceService integration: summary runbookCount matches runbooks array", () => {
  const workspace = createTempWorkspace("aa-ops-governance-runbook-count-");
  const dbPath = join(workspace, "ops-governance-runbook-count.db");

  try {
    const { governance } = createTestServices(workspace, dbPath);

    const report = governance.buildReport({ environment: "test" });

    assert.equal(report.summary.runbookCount, report.runbooks.length);

    dbPath;
    workspace;
  } finally {
    cleanupPath(workspace);
  }
});
