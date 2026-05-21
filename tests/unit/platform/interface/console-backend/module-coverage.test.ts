/**
 * Unit tests for buildModuleCoverage function
 * Tests src/platform/five-plane-interface/console-backend/index.ts module coverage logic
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OperatorConsoleBackendService } from "../../../../../src/platform/five-plane-interface/console-backend/index.js";

function createOperator(overrides: Partial<{ operatorId: string; roles: string[]; tenantId: string | null; workspaceId: string | null }> = {}) {
  return {
    operatorId: "test-operator",
    roles: ["operator"],
    tenantId: null,
    workspaceId: null,
    ...overrides,
  };
}

test("buildSnapshot returns all 10 module IDs in moduleCoverage", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const expectedModules = [
    "worker_management",
    "queue_management",
    "tenant_management",
    "approval_management",
    "audit_search",
    "feature_flag_management",
    "incident_timeline",
    "oapeflir_loop_management",
    "rollout_management",
    "feedback_learning_management",
  ];

  assert.equal(snapshot.moduleCoverage.length, 10);
  for (const expected of expectedModules) {
    assert.ok(snapshot.moduleCoverage.some((m) => m.moduleId === expected), `Missing module: ${expected}`);
  }
});

test("buildSnapshot worker_management available when workers exist", () => {
  const workers = [{ workerId: "w-1", status: "online" as const, activeExecutionCount: 1, queueDepth: 0 }];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.equal(workerModule?.status, "available");
});

test("buildSnapshot worker_management empty when no workers", () => {
  const service = new OperatorConsoleBackendService({ listWorkers: () => [] });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.equal(workerModule?.status, "empty");
});

test("buildSnapshot queue_management available when worker has queue depth", () => {
  const workers = [
    { workerId: "w-1", status: "online" as const, activeExecutionCount: 0, queueDepth: 5 },
    { workerId: "w-2", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 },
  ];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const queueModule = snapshot.moduleCoverage.find((m) => m.moduleId === "queue_management");
  assert.equal(queueModule?.status, "available");
});

test("buildSnapshot queue_management empty when all workers have zero queue depth", () => {
  const workers = [{ workerId: "w-1", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 }];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const queueModule = snapshot.moduleCoverage.find((m) => m.moduleId === "queue_management");
  assert.equal(queueModule?.status, "empty");
});

test("buildSnapshot tenant_management available when tenants exist", () => {
  const tenants = [{ tenantId: "tenant-1", organizationId: "org-1", isolationMode: "shared" }];
  const service = new OperatorConsoleBackendService({ listTenants: () => tenants });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const tenantModule = snapshot.moduleCoverage.find((m) => m.moduleId === "tenant_management");
  assert.equal(tenantModule?.status, "available");
});

test("buildSnapshot tenant_management empty when no tenants", () => {
  const service = new OperatorConsoleBackendService({ listTenants: () => [] });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const tenantModule = snapshot.moduleCoverage.find((m) => m.moduleId === "tenant_management");
  assert.equal(tenantModule?.status, "empty");
});

test("buildSnapshot approval_management available when approvals exist", () => {
  const approvals = [{ approvalId: "ap-1", taskId: "task-1", tenantId: null, riskLevel: "low", reason: "test", createdAt: "2024-01-01" }];
  const service = new OperatorConsoleBackendService({ listPendingApprovals: () => approvals });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const approvalModule = snapshot.moduleCoverage.find((m) => m.moduleId === "approval_management");
  assert.equal(approvalModule?.status, "available");
});

test("buildSnapshot approval_management empty when no approvals", () => {
  const service = new OperatorConsoleBackendService({ listPendingApprovals: () => [] });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const approvalModule = snapshot.moduleCoverage.find((m) => m.moduleId === "approval_management");
  assert.equal(approvalModule?.status, "empty");
});

test("buildSnapshot incident_timeline available when incidents exist", () => {
  const incidents = [{ incidentId: "inc-1", taskId: null, tenantId: null, severity: "info" as const, summary: "info", createdAt: "2024-01-01" }];
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const incidentModule = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
  assert.equal(incidentModule?.status, "available");
});

test("buildSnapshot incident_timeline empty when no incidents", () => {
  const service = new OperatorConsoleBackendService({ listIncidents: () => [] });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const incidentModule = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
  assert.equal(incidentModule?.status, "empty");
});

test("buildSnapshot oapeflir_loop_management available when tasks exist", () => {
  const tasks = [{ taskId: "task-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" }];
  const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const oapeflirModule = snapshot.moduleCoverage.find((m) => m.moduleId === "oapeflir_loop_management");
  assert.equal(oapeflirModule?.status, "available");
});

test("buildSnapshot oapeflir_loop_management empty when no tasks", () => {
  const service = new OperatorConsoleBackendService({ listTasks: () => [] });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const oapeflirModule = snapshot.moduleCoverage.find((m) => m.moduleId === "oapeflir_loop_management");
  assert.equal(oapeflirModule?.status, "empty");
});

test("buildSnapshot audit_search always returns empty status", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const auditModule = snapshot.moduleCoverage.find((m) => m.moduleId === "audit_search");
  assert.equal(auditModule?.status, "empty");
});

test("buildSnapshot feature_flag_management always returns empty status", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const featureModule = snapshot.moduleCoverage.find((m) => m.moduleId === "feature_flag_management");
  assert.equal(featureModule?.status, "empty");
});

test("buildSnapshot rollout_management always returns empty status", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const rolloutModule = snapshot.moduleCoverage.find((m) => m.moduleId === "rollout_management");
  assert.equal(rolloutModule?.status, "empty");
});

test("buildSnapshot feedback_learning_management always returns empty status", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  const feedbackModule = snapshot.moduleCoverage.find((m) => m.moduleId === "feedback_learning_management");
  assert.equal(feedbackModule?.status, "empty");
});