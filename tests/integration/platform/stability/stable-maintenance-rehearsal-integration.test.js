import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableMaintenanceRehearsal,
  writeStableMaintenanceRehearsalReport,
  type StableMaintenanceRehearsalReport,
} from "../../../../../src/platform/stability/stable-maintenance-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("runStableMaintenanceRehearsal passes drain and handover scenarios and produces artifacts", async () => {
  const workspace = createTempWorkspace("aa-maintenance-rehearsal-");

  try {
    const report = await runStableMaintenanceRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-maintenance-report.json");
    writeStableMaintenanceRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 2);
    assert.equal(report.passedScenarios, 2);
    assert.equal(report.failedScenarios, 0);
    assert.ok(report.scenarios.every((s) => s.passed));

    const drainScenario = report.scenarios.find((s) => s.scenarioId === "draining_worker_rejects_new_dispatches");
    assert.ok(drainScenario);
    assert.equal(drainScenario.passed, true);
    assert.ok(drainScenario.durationMs >= 0);
    assert.ok(drainScenario.summary.length > 0);

    const handoverScenario = report.scenarios.find((s) => s.scenarioId === "step_boundary_handover_preserves_execution_lineage");
    assert.ok(handoverScenario);
    assert.equal(handoverScenario.passed, true);
    assert.ok(handoverScenario.durationMs >= 0);
    assert.ok(handoverScenario.summary.length > 0);

    // Artifacts exist
    assert.equal(existsSync(report.artifacts.reportPath), true);
    assert.equal(existsSync(report.artifacts.playbookPath), true);

    // Playbook structure
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));
    assert.equal(playbook.maintenanceOwner, "runtime_reliability_oncall");
    assert.ok(playbook.maintenanceWindow.includes("step-boundary"));
    assert.ok(playbook.drainPolicy.length >= 3);
    assert.ok(playbook.replacementReadinessChecks.length >= 4);
    assert.ok(playbook.handoverProcedure.length >= 4);
    assert.ok(playbook.healthValidation.length >= 4);
    assert.ok(playbook.rollbackTriggers.length >= 3);
    assert.ok(playbook.auditRequirements.length >= 4);
    assert.deepEqual(
      playbook.targets.map((t) => t.targetId),
      ["maintenance_window", "worker_pool", "active_leases", "dispatch_policy"],
    );
    assert.ok(playbook.runtimeVersionSnapshot);
    assert.equal(playbook.scenarioEvidence.length, 2);

    // Report persisted correctly
    const saved = JSON.parse(readFileSync(reportPath, "utf8")) as StableMaintenanceRehearsalReport;
    assert.equal(saved.totalScenarios, 2);
    assert.equal(saved.passedScenarios, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableMaintenanceRehearsal drain scenario validates draining worker rejects new dispatches", async () => {
  const workspace = createTempWorkspace("aa-maintenance-drain-");

  try {
    const report = await runStableMaintenanceRehearsal({ outputDir: workspace });
    const drainScenario = report.scenarios.find((s) => s.scenarioId === "draining_worker_rejects_new_dispatches");
    assert.ok(drainScenario);
    assert.equal(drainScenario.passed, true);

    // Details capture dispatch behavior
    assert.ok(drainScenario.details);
    const dispatched = drainScenario.details.dispatched as { outcome: string; workerId: string | null };
    assert.equal(dispatched.outcome, "dispatched");
    assert.equal(dispatched.workerId, "worker-maintenance-replacement");

    // Draining worker explicitly rejected
    const drainingEval = drainScenario.details.drainingEvaluation as { rejectionReason: string } | null;
    assert.ok(drainingEval);
    assert.equal(drainingEval.rejectionReason, "worker_draining");

    // Active lease remains with draining worker until handover
    const activeLeaseAfter = drainScenario.details.activeLeaseAfterDispatch as { workerId: string; status: string };
    assert.equal(activeLeaseAfter.workerId, "worker-maintenance-draining");
    assert.equal(activeLeaseAfter.status, "active");
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableMaintenanceRehearsal handover scenario validates step-boundary lease transfer and fencing", async () => {
  const workspace = createTempWorkspace("aa-maintenance-handover-");

  try {
    const report = await runStableMaintenanceRehearsal({ outputDir: workspace });
    const handoverScenario = report.scenarios.find((s) => s.scenarioId === "step_boundary_handover_preserves_execution_lineage");
    assert.ok(handoverScenario);
    assert.equal(handoverScenario.passed, true);

    // Handover details validate fence token advancement
    const handover = handoverScenario.details.handover as { outcome: string; previousLease: { reasonCode: string } };
    assert.equal(handover.outcome, "handed_over");
    assert.equal(handover.previousLease.reasonCode, "maintenance_drain_handover");

    // Stale write from old worker is rejected
    const staleWrite = handoverScenario.details.staleWrite as { allowed: boolean; reasonCode: string };
    assert.equal(staleWrite.allowed, false);
    assert.equal(staleWrite.reasonCode, "stale_fencing_token");

    // Valid write from new worker succeeds
    const validWrite = handoverScenario.details.validWrite as { allowed: boolean };
    assert.equal(validWrite.allowed, true);

    // Execution now owned by replacement worker
    const execAgentId = handoverScenario.details.executionAgentId as string;
    assert.equal(execAgentId, "worker-maintenance-target");

    // Audit trail captures handover event
    const auditEvents = handoverScenario.details.auditEvents as Array<{ eventType: string; reasonCode: string }>;
    assert.ok(auditEvents.some((e) => e.eventType === "lease_handover" && e.reasonCode === "maintenance_drain_handover"));

    // Event log includes handover record
    const eventTypes = handoverScenario.details.eventTypes as string[];
    assert.ok(eventTypes.includes("lease:handover_recorded"));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableMaintenanceRehearsal playbook contains correct target guardrails and health validation", async () => {
  const workspace = createTempWorkspace("aa-maintenance-playbook-");

  try {
    const report = await runStableMaintenanceRehearsal({ outputDir: workspace });
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));

    const workerPoolTarget = playbook.targets.find((t) => t.targetId === "worker_pool");
    assert.ok(workerPoolTarget);
    assert.equal(workerPoolTarget.owner, "runtime_reliability_oncall");
    assert.ok(workerPoolTarget.guardrails.length >= 2);
    assert.ok(workerPoolTarget.healthValidation.length >= 2);

    const dispatchPolicyTarget = playbook.targets.find((t) => t.targetId === "dispatch_policy");
    assert.ok(dispatchPolicyTarget);
    assert.ok(dispatchPolicyTarget.guardrails.some((g) => g.includes("fail closed")));
    assert.ok(dispatchPolicyTarget.guardrails.some((g) => g.includes("rejection traces")));

    const activeLeasesTarget = playbook.targets.find((t) => t.targetId === "active_leases");
    assert.ok(activeLeasesTarget);
    assert.ok(activeLeasesTarget.guardrails.some((g) => g.includes("step boundary")));
    assert.ok(activeLeasesTarget.guardrails.some((g) => g.includes("fencing token")));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableMaintenanceRehearsal report contains correct metadata and timestamps", async () => {
  const workspace = createTempWorkspace("aa-maintenance-metadata-");

  try {
    const report = await runStableMaintenanceRehearsal({ outputDir: workspace });

    assert.ok(report.startedAt.length > 0);
    assert.ok(report.finishedAt.length > 0);
    assert.ok(new Date(report.startedAt) <= new Date(report.finishedAt));
    assert.equal(report.outputDir, workspace);
    assert.equal(report.artifacts.reportPath, join(workspace, "stable-maintenance-report.json"));
    assert.equal(report.artifacts.playbookPath, join(workspace, "stable-maintenance-playbook.json"));
  } finally {
    cleanupPath(workspace);
  }
});
