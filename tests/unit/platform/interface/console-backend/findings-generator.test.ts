/**
 * Unit tests for buildFindings function
 * Tests src/platform/five-plane-interface/console-backend/index.ts findings generation
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

test("buildSnapshot with critical approval generates finding", () => {
  const approvals = [
    { approvalId: "ap-1", taskId: "task-1", tenantId: null, riskLevel: "critical", reason: "high risk", createdAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listPendingApprovals: () => approvals });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical approval waiting")));
});

test("buildSnapshot with no critical approvals does not generate critical finding", () => {
  const approvals = [
    { approvalId: "ap-1", taskId: "task-1", tenantId: null, riskLevel: "low", reason: "low risk", createdAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listPendingApprovals: () => approvals });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(!snapshot.findings.some((f) => f.includes("critical approval")));
});

test("buildSnapshot with offline worker owning active executions generates finding", () => {
  const workers = [
    { workerId: "w-1", status: "offline" as const, activeExecutionCount: 3, queueDepth: 0 },
    { workerId: "w-2", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 },
  ];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("offline worker still owns active executions")));
});

test("buildSnapshot with offline worker but no active executions does not generate finding", () => {
  const workers = [
    { workerId: "w-1", status: "offline" as const, activeExecutionCount: 0, queueDepth: 0 },
  ];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(!snapshot.findings.some((f) => f.includes("offline worker")));
});

test("buildSnapshot with critical incident generates finding", () => {
  const incidents = [
    { incidentId: "inc-1", taskId: "task-1", tenantId: null, severity: "critical" as const, summary: "major outage", createdAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical incident requires takeover review")));
});

test("buildSnapshot with warning incident does not generate critical finding", () => {
  const incidents = [
    { incidentId: "inc-1", taskId: "task-1", tenantId: null, severity: "warning" as const, summary: "minor issue", createdAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(!snapshot.findings.some((f) => f.includes("critical incident")));
});

test("buildSnapshot with blocked tasks generates finding", () => {
  const tasks = [
    { taskId: "t-1", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "medium" as const, updatedAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks exist")));
});

test("buildSnapshot with no blocked tasks does not generate blocked finding", () => {
  const tasks = [
    { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(!snapshot.findings.some((f) => f.includes("blocked tasks")));
});

test("buildSnapshot with multiple findings generates all of them", () => {
  const tasks = [{ taskId: "t-1", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "medium" as const, updatedAt: "2024-01-01" }];
  const approvals = [{ approvalId: "ap-1", taskId: "task-1", tenantId: null, riskLevel: "critical", reason: "high", createdAt: "2024-01-01" }];
  const workers = [{ workerId: "w-1", status: "offline" as const, activeExecutionCount: 2, queueDepth: 0 }];
  const incidents = [{ incidentId: "inc-1", taskId: null, tenantId: null, severity: "critical" as const, summary: "outage", createdAt: "2024-01-01" }];

  const service = new OperatorConsoleBackendService({
    listTasks: () => tasks,
    listPendingApprovals: () => approvals,
    listWorkers: () => workers,
    listIncidents: () => incidents,
  });
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
  assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
  assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
  assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});

test("buildSnapshot with no findings returns empty array", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = createOperator();
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.findings.length, 0);
});