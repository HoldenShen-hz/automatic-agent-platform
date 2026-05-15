/**
 * Golden Test: MissionControl Service Output Structure
 *
 * Verifies mission control service produces consistent snapshot, cockpit,
 * stability panel, and admin takeover console views for UI wireframes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { MetricsService } from "../../src/platform/shared/observability/metrics-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { MissionControlService } from "../../src/platform/five-plane-interface/api/mission-control-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: mission control getSnapshot has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-mission-control-");

  const dbPath = `${workspace}/mission-control.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const inspectService = new InspectService(store);
  const service = new MissionControlService(store, healthService, metricsService, inspectService);

  // Create tasks for snapshot data
  seedTaskAndExecution(db, store, {
    taskId: "mc_snapshot_task_001",
    executionId: "mc_snapshot_exec_001",
    traceId: "mc-trace-1",
  });
  seedTaskAndExecution(db, store, {
    taskId: "mc_snapshot_task_002",
    executionId: "mc_snapshot_exec_002",
    traceId: "mc-trace-2",
  });

  const snapshot = service.getSnapshot();

  // Verify top-level structure per UI spec §4.7.7
  assert.ok(snapshot, "Snapshot should exist");
  assert.ok(snapshot.generatedAt, "Should have generatedAt");
  assert.ok(snapshot.health, "Should have health");
  assert.ok(snapshot.metrics, "Should have metrics");
  assert.ok(Array.isArray(snapshot.taskBoard), "taskBoard should be array");
  assert.ok(Array.isArray(snapshot.pendingApprovals), "pendingApprovals should be array");
  assert.ok(Array.isArray(snapshot.divisions), "divisions should be array");
  assert.ok(snapshot.productSignals, "Should have productSignals");

  // Verify UI spec Dashboard wireframe fields
  assert.ok(typeof snapshot.metrics.taskMetrics.successRate === "number", "successRate should be number");
  assert.ok(typeof snapshot.avgDurationMs === "number" || snapshot.avgDurationMs === null, "avgDurationMs should be number or null");
  assert.ok(typeof snapshot.activeAgents === "number", "activeAgents should be number");
  assert.ok(typeof snapshot.queueDepth === "number", "queueDepth should be number");
  assert.ok(typeof snapshot.errorRate === "number", "errorRate should be number");
  assert.ok(typeof snapshot.p50LatencyMs === "number" || snapshot.p50LatencyMs === null, "p50LatencyMs should be number or null");
  assert.ok(typeof snapshot.p99LatencyMs === "number" || snapshot.p99LatencyMs === null, "p99LatencyMs should be number or null");
  assert.ok(typeof snapshot.budgetUtilizationPercent === "number" || snapshot.budgetUtilizationPercent === null, "budgetUtilizationPercent should be number or null");
  assert.ok(typeof snapshot.uptimePercent === "number", "uptimePercent should be number");

  assertGolden("mission-control-snapshot-structure", {
    generatedAt: snapshot.generatedAt,
    taskBoardCount: snapshot.taskBoard.length,
    pendingApprovalsCount: snapshot.pendingApprovals.length,
    divisionsCount: snapshot.divisions.length,
    hasProductSignals: snapshot.productSignals !== undefined,
    successRate: snapshot.metrics.taskMetrics.successRate,
    avgDurationMs: snapshot.avgDurationMs,
    activeAgents: snapshot.activeAgents,
    queueDepth: snapshot.queueDepth,
    errorRate: snapshot.errorRate,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: mission control getTaskCockpit has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-mission-control-cockpit-");

  const dbPath = `${workspace}/mission-control-cockpit.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const inspectService = new InspectService(store);
  const service = new MissionControlService(store, healthService, metricsService, inspectService);

  const taskId = "mc_cockpit_task_001";
  seedTaskAndExecution(db, store, {
    taskId,
    executionId: "mc_cockpit_exec_001",
    traceId: "mc-cockpit-trace",
  });

  const cockpit = service.getTaskCockpit(taskId);

  // Verify cockpit structure
  assert.ok(cockpit, "Cockpit should exist");
  assert.ok(cockpit.snapshot !== undefined, "Should have snapshot");
  assert.ok(cockpit.inspect !== undefined, "Should have inspect");
  assert.ok(cockpit.timeline !== undefined, "Should have timeline");

  assertGolden("mission-control-task-cockpit", {
    taskId,
    hasSnapshot: cockpit.snapshot !== null,
    hasInspect: cockpit.inspect !== undefined,
    hasTimeline: cockpit.timeline !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: mission control getStabilityPanel has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-mission-control-stability-");

  const dbPath = `${workspace}/mission-control-stability.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const inspectService = new InspectService(store);
  const service = new MissionControlService(store, healthService, metricsService, inspectService);

  // Create tasks for stability panel
  seedTaskAndExecution(db, store, {
    taskId: "mc_stability_task_001",
    executionId: "mc_stability_exec_001",
    traceId: "mc-stability-trace",
  });

  const panel = service.getStabilityPanel(25);

  // Verify panel structure per UI spec
  assert.ok(panel, "Panel should exist");
  assert.ok(panel.generatedAt, "Should have generatedAt");
  assert.ok(panel.health, "Should have health");
  assert.ok(typeof panel.activeTaskCount === "number", "activeTaskCount should be number");
  assert.ok(typeof panel.queuedTaskCount === "number", "queuedTaskCount should be number");
  assert.ok(typeof panel.blockedTaskCount === "number", "blockedTaskCount should be number");
  assert.ok(Array.isArray(panel.activeTasks), "activeTasks should be array");
  assert.ok(Array.isArray(panel.queuedTasks), "queuedTasks should be array");
  assert.ok(Array.isArray(panel.blockedTasks), "blockedTasks should be array");
  assert.ok(Array.isArray(panel.workflows), "workflows should be array");
  assert.ok(Array.isArray(panel.pendingApprovals), "pendingApprovals should be array");
  assert.ok(typeof panel.pendingApprovalCount === "number", "pendingApprovalCount should be number");
  assert.ok(Array.isArray(panel.workers), "workers should be array");
  assert.ok(typeof panel.workerCount === "number", "workerCount should be number");
  assert.ok(Array.isArray(panel.findings), "findings should be array");
  assert.ok(typeof panel.findingsCount === "number", "findingsCount should be number");

  assertGolden("mission-control-stability-panel", {
    generatedAt: panel.generatedAt,
    activeTaskCount: panel.activeTaskCount,
    queuedTaskCount: panel.queuedTaskCount,
    blockedTaskCount: panel.blockedTaskCount,
    pendingApprovalCount: panel.pendingApprovalCount,
    workerCount: panel.workerCount,
    findingsCount: panel.findingsCount,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: mission control listApprovalQueue has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-mission-control-approvals-");

  const dbPath = `${workspace}/mission-control-approvals.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const inspectService = new InspectService(store);
  const service = new MissionControlService(store, healthService, metricsService, inspectService);

  seedTaskAndExecution(db, store, {
    taskId: "mc_approval_task_001",
    executionId: "mc_approval_exec_001",
    traceId: "mc-approval-trace",
  });

  const approvals = service.listApprovalQueue(25);

  assert.ok(Array.isArray(approvals), "Approvals should be array");

  assertGolden("mission-control-approval-queue", {
    count: approvals.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: mission control listWorkflowCockpits has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-mission-control-workflows-");

  const dbPath = `${workspace}/mission-control-workflows.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);
  const metricsService = new MetricsService(db, healthService);
  const inspectService = new InspectService(store);
  const service = new MissionControlService(store, healthService, metricsService, inspectService);

  // Create tasks with workflow state
  seedTaskAndExecution(db, store, {
    taskId: "mc_workflow_task_001",
    executionId: "mc_workflow_exec_001",
    traceId: "mc-workflow-trace",
  });

  const workflows = service.listWorkflowCockpits(25);

  assert.ok(Array.isArray(workflows), "Workflows should be array");

  assertGolden("mission-control-workflow-cockpits", {
    count: workflows.length,
  });

  db.close();
  cleanupPath(workspace);
});