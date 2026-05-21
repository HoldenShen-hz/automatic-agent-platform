/**
 * Unit tests for filterByOperatorScope method
 * Tests src/platform/five-plane-interface/console-backend/index.ts tenant scoping
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

test("buildSnapshot with null tenantId returns all tasks", () => {
  const tasks = [
    { taskId: "t-1", tenantId: "tenant-A", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    { taskId: "t-2", tenantId: "tenant-B", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    { taskId: "t-3", tenantId: "tenant-C", workspaceId: null, status: "completed", riskLevel: "medium" as const, updatedAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
  const operator = createOperator({ tenantId: null });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 3);
});

test("buildSnapshot with specific tenantId returns only matching tasks", () => {
  const tasks = [
    { taskId: "t-1", tenantId: "tenant-A", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    { taskId: "t-2", tenantId: "tenant-B", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    { taskId: "t-3", tenantId: "tenant-A", workspaceId: null, status: "completed", riskLevel: "medium" as const, updatedAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
  const operator = createOperator({ tenantId: "tenant-A" });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
  assert.ok(snapshot.taskBoard.every((t) => t.tenantId === "tenant-A"));
});

test("buildSnapshot approval queue is filtered by tenantId", () => {
  const approvals = [
    { approvalId: "ap-1", taskId: "task-1", tenantId: "tenant-A", riskLevel: "low", reason: "test", createdAt: "2024-01-01" },
    { approvalId: "ap-2", taskId: "task-2", tenantId: "tenant-B", riskLevel: "medium", reason: "test", createdAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listPendingApprovals: () => approvals });
  const operator = createOperator({ tenantId: "tenant-A" });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.approvalQueue[0].tenantId, "tenant-A");
});

test("buildSnapshot incident timeline is filtered by tenantId", () => {
  const incidents = [
    { incidentId: "inc-1", taskId: "task-1", tenantId: "tenant-A", severity: "warning" as const, summary: "test", createdAt: "2024-01-01" },
    { incidentId: "inc-2", taskId: "task-2", tenantId: "tenant-B", severity: "critical" as const, summary: "test", createdAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator = createOperator({ tenantId: "tenant-B" });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline.length, 1);
  assert.equal(snapshot.incidentTimeline[0].tenantId, "tenant-B");
});

test("buildSnapshot tenant panel is filtered by operator tenantId", () => {
  const tenants = [
    { tenantId: "tenant-A", organizationId: "org-1", isolationMode: "shared" },
    { tenantId: "tenant-B", organizationId: "org-1", isolationMode: "dedicated" },
  ];
  const service = new OperatorConsoleBackendService({ listTenants: () => tenants });
  const operator = createOperator({ tenantId: "tenant-A" });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.tenantPanel.length, 1);
  assert.equal(snapshot.tenantPanel[0].tenantId, "tenant-A");
});

test("buildSnapshot with null operator tenantId shows all tenants", () => {
  const tenants = [
    { tenantId: "tenant-A", organizationId: "org-1", isolationMode: "shared" },
    { tenantId: "tenant-B", organizationId: "org-1", isolationMode: "dedicated" },
  ];
  const service = new OperatorConsoleBackendService({ listTenants: () => tenants });
  const operator = createOperator({ tenantId: null });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.tenantPanel.length, 2);
});

test("buildSnapshot incident timeline is sorted by createdAt descending", () => {
  const incidents = [
    { incidentId: "inc-old", taskId: null, tenantId: null, severity: "info" as const, summary: "old", createdAt: "2024-01-01" },
    { incidentId: "inc-new", taskId: null, tenantId: null, severity: "warning" as const, summary: "new", createdAt: "2024-12-31" },
    { incidentId: "inc-mid", taskId: null, tenantId: null, severity: "critical" as const, summary: "mid", createdAt: "2024-06-15" },
  ];
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator = createOperator({ tenantId: null });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline[0].incidentId, "inc-new");
  assert.equal(snapshot.incidentTimeline[1].incidentId, "inc-mid");
  assert.equal(snapshot.incidentTimeline[2].incidentId, "inc-old");
});

test("buildSnapshot incident timeline limits to 50 entries", () => {
  const incidents = Array.from({ length: 100 }, (_, i) => ({
    incidentId: `inc-${i}`,
    taskId: null,
    tenantId: null,
    severity: "info" as const,
    summary: `incident ${i}`,
    createdAt: `2024-01-${String(i % 30 + 1).padStart(2, "0")}`,
  }));
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator = createOperator({ tenantId: null });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline.length, 50);
});

test("buildSnapshot worker panel is not filtered by tenant", () => {
  const workers = [
    { workerId: "w-1", status: "online" as const, activeExecutionCount: 1, queueDepth: 0 },
    { workerId: "w-2", status: "draining" as const, activeExecutionCount: 0, queueDepth: 5 },
  ];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator = createOperator({ tenantId: "tenant-A" });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.workerPanel.length, 2);
});

test("buildSnapshot with mixed tenant data returns correct filtered results", () => {
  const tasks = [
    { taskId: "t-1", tenantId: "tenant-A", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    { taskId: "t-2", tenantId: "tenant-A", workspaceId: null, status: "blocked", riskLevel: "high" as const, updatedAt: "2024-01-01" },
    { taskId: "t-3", tenantId: "tenant-B", workspaceId: null, status: "running", riskLevel: "medium" as const, updatedAt: "2024-01-01" },
  ];
  const approvals = [
    { approvalId: "ap-1", taskId: "t-1", tenantId: "tenant-A", riskLevel: "critical", reason: "high risk", createdAt: "2024-01-01" },
    { approvalId: "ap-2", taskId: "t-3", tenantId: "tenant-B", riskLevel: "low", reason: "low risk", createdAt: "2024-01-01" },
  ];
  const incidents = [
    { incidentId: "inc-1", taskId: "t-1", tenantId: "tenant-A", severity: "critical" as const, summary: "issue", createdAt: "2024-01-01" },
    { incidentId: "inc-2", taskId: "t-3", tenantId: "tenant-B", severity: "warning" as const, summary: "warning", createdAt: "2024-01-01" },
  ];

  const service = new OperatorConsoleBackendService({
    listTasks: () => tasks,
    listPendingApprovals: () => approvals,
    listIncidents: () => incidents,
  });
  const operator = createOperator({ tenantId: "tenant-A" });
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.incidentTimeline.length, 1);
  assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
  assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});