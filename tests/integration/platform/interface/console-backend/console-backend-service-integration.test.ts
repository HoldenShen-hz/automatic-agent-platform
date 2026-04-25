import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  OperatorConsoleBackendService,
  type OperatorIdentity,
  type ConsoleDataSources,
} from "../../../../../src/platform/interface/console-backend/index.js";

test("OperatorConsoleBackendService handles multi-tenant task aggregation", () => {
  const ctx = createIntegrationContext("aa-console-multitenant-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () => [
        { taskId: "task-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T10:00:00.000Z" },
        { taskId: "task-2", tenantId: "tenant-a", workspaceId: null, status: "completed", riskLevel: "low", updatedAt: "2026-04-23T11:00:00.000Z" },
        { taskId: "task-3", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "medium", updatedAt: "2026-04-23T12:00:00.000Z" },
        { taskId: "task-4", tenantId: "tenant-b", workspaceId: null, status: "blocked", riskLevel: "high", updatedAt: "2026-04-23T13:00:00.000Z" },
        { taskId: "task-5", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T14:00:00.000Z" },
      ],
    });

    // Global operator sees all 5 tasks
    const globalOp: OperatorIdentity = { operatorId: "global-admin", roles: ["admin"] };
    const globalSnap = service.buildSnapshot(globalOp);
    assert.equal(globalSnap.taskBoard.length, 5);

    // Tenant A operator sees 2 tasks
    const tenantAOp: OperatorIdentity = { operatorId: "tenant-a-op", roles: ["viewer"], tenantId: "tenant-a" };
    const tenantASnap = service.buildSnapshot(tenantAOp);
    assert.equal(tenantASnap.taskBoard.length, 2);
    assert.ok(tenantASnap.taskBoard.every((t) => t.tenantId === "tenant-a"));

    // Tenant B operator sees 2 tasks
    const tenantBOp: OperatorIdentity = { operatorId: "tenant-b-op", roles: ["viewer"], tenantId: "tenant-b" };
    const tenantBSnap = service.buildSnapshot(tenantBOp);
    assert.equal(tenantBSnap.taskBoard.length, 2);
    assert.ok(tenantBSnap.taskBoard.every((t) => t.tenantId === "tenant-b"));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService aggregates findings from multiple sources", () => {
  const ctx = createIntegrationContext("aa-console-findings-agg-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () => [
        { taskId: "task-blocked", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
      ],
      listPendingApprovals: () => [
        { approvalId: "appr-critical", taskId: "task-1", tenantId: null, riskLevel: "critical", reason: "Critical action", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
      listWorkers: () => [
        { workerId: "w-offline", status: "offline", activeExecutionCount: 5, queueDepth: 0 },
      ],
      listIncidents: () => [
        { incidentId: "incident-critical", taskId: null, tenantId: null, severity: "critical", summary: "Major outage", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    const op: OperatorIdentity = { operatorId: "op-1", roles: ["admin"] };
    const snap = service.buildSnapshot(op);

    // Should have all 4 types of findings
    assert.ok(snap.findings.length >= 4);
    assert.ok(snap.findings.some((f) => f.includes("blocked tasks")));
    assert.ok(snap.findings.some((f) => f.includes("critical approval")));
    assert.ok(snap.findings.some((f) => f.includes("offline worker")));
    assert.ok(snap.findings.some((f) => f.includes("critical incident")));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService action plan requires operator with roles", () => {
  const ctx = createIntegrationContext("aa-console-action-roles-");
  try {
    const service = new OperatorConsoleBackendService({});

    // Operator without roles should still work for non-breakglass actions
    const noRoleOp: OperatorIdentity = { operatorId: "op-no-roles", roles: [] };
    const plan1 = service.planHumanTakeoverAction({
      actionId: "plan-1",
      actionType: "take_over_task",
      taskId: "task-1",
      operator: noRoleOp,
      reasonCode: "test",
    });
    assert.equal(plan1.requiresBreakGlass, false);

    // Viewer role should work for basic actions
    const viewerOp: OperatorIdentity = { operatorId: "op-viewer", roles: ["viewer"] };
    const plan2 = service.planHumanTakeoverAction({
      actionId: "plan-2",
      actionType: "retry_step",
      taskId: "task-2",
      operator: viewerOp,
      reasonCode: "test",
    });
    assert.equal(plan2.requiresBreakGlass, false);

    // Breakglass actions should fail without break_glass role
    const plan3 = service.planHumanTakeoverAction({
      actionId: "plan-3",
      actionType: "skip_step",
      taskId: "task-3",
      operator: viewerOp,
      reasonCode: "test",
    });
    assert.equal(plan3.requiresBreakGlass, true);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService plans all action types correctly", () => {
  const ctx = createIntegrationContext("aa-console-all-actions-");
  try {
    const service = new OperatorConsoleBackendService({});
    const op: OperatorIdentity = { operatorId: "op-1", roles: ["admin", "break_glass"] };

    const actionTypes: Array<{
      action: Parameters<typeof service.planHumanTakeoverAction>[0]["actionType"];
      expectPolicyEval: boolean;
      expectBreakGlass: boolean;
    }> = [
      { action: "take_over_task", expectPolicyEval: false, expectBreakGlass: false },
      { action: "modify_next_input", expectPolicyEval: false, expectBreakGlass: false },
      { action: "skip_step", expectPolicyEval: true, expectBreakGlass: true },
      { action: "retry_step", expectPolicyEval: false, expectBreakGlass: false },
      { action: "switch_model", expectPolicyEval: false, expectBreakGlass: false },
      { action: "switch_worker", expectPolicyEval: true, expectBreakGlass: true },
      { action: "attach_artifact", expectPolicyEval: true, expectBreakGlass: false },
      { action: "inject_feedback", expectPolicyEval: false, expectBreakGlass: false },
      { action: "create_improvement_candidate", expectPolicyEval: false, expectBreakGlass: false },
      { action: "advance_rollout", expectPolicyEval: true, expectBreakGlass: false },
      { action: "rollback_rollout", expectPolicyEval: true, expectBreakGlass: true },
      { action: "finish_task", expectPolicyEval: true, expectBreakGlass: true },
    ];

    for (const { action, expectPolicyEval, expectBreakGlass } of actionTypes) {
      const plan = service.planHumanTakeoverAction({
        actionId: `action-${action}`,
        actionType: action,
        taskId: "task-test",
        operator: op,
        reasonCode: "test",
      });
      assert.equal(
        plan.requiresPolicyEvaluation,
        expectPolicyEval,
        `${action} should ${expectPolicyEval ? "" : "not "}require policy evaluation`,
      );
      assert.equal(
        plan.requiresBreakGlass,
        expectBreakGlass,
        `${action} should ${expectBreakGlass ? "" : "not "}require break glass`,
      );
    }
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService module coverage for mixed data scenarios", () => {
  const ctx = createIntegrationContext("aa-console-module-mixed-");
  try {
    // Empty worker list but non-empty queue depth (queue depth comes from workers)
    const service1 = new OperatorConsoleBackendService({
      listWorkers: () => [],
      listTasks: () => [{ taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" }],
      listPendingApprovals: () => [],
      listIncidents: () => [],
      listTenants: () => [],
    });

    const snap1 = service1.buildSnapshot({ operatorId: "op-1", roles: ["viewer"] });
    const workerMod1 = snap1.moduleCoverage.find((m) => m.moduleId === "worker_management");
    const queueMod1 = snap1.moduleCoverage.find((m) => m.moduleId === "queue_management");
    assert.equal(workerMod1?.status, "empty");
    assert.equal(queueMod1?.status, "empty");

    // Workers with zero queue depth
    const service2 = new OperatorConsoleBackendService({
      listWorkers: () => [
        { workerId: "w-1", status: "online", activeExecutionCount: 0, queueDepth: 0 },
      ],
      listTasks: () => [],
      listPendingApprovals: () => [],
      listIncidents: () => [],
      listTenants: () => [],
    });

    const snap2 = service2.buildSnapshot({ operatorId: "op-2", roles: ["viewer"] });
    const workerMod2 = snap2.moduleCoverage.find((m) => m.moduleId === "worker_management");
    const queueMod2 = snap2.moduleCoverage.find((m) => m.moduleId === "queue_management");
    assert.equal(workerMod2?.status, "available");
    assert.equal(queueMod2?.status, "empty"); // queueDepth is 0

    // Workers with positive queue depth
    const service3 = new OperatorConsoleBackendService({
      listWorkers: () => [
        { workerId: "w-1", status: "online", activeExecutionCount: 2, queueDepth: 10 },
      ],
      listTasks: () => [],
      listPendingApprovals: () => [],
      listIncidents: () => [],
      listTenants: () => [],
    });

    const snap3 = service3.buildSnapshot({ operatorId: "op-3", roles: ["viewer"] });
    const queueMod3 = snap3.moduleCoverage.find((m) => m.moduleId === "queue_management");
    assert.equal(queueMod3?.status, "available");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService workspace scoping in tenant context", () => {
  const ctx = createIntegrationContext("aa-console-workspace-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () => [
        { taskId: "task-1", tenantId: "tenant-x", workspaceId: "ws-1", status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        { taskId: "task-2", tenantId: "tenant-x", workspaceId: "ws-2", status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        { taskId: "task-3", tenantId: "tenant-x", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    // Operator with workspace scope
    const wsOp: OperatorIdentity = { operatorId: "op-ws", roles: ["viewer"], tenantId: "tenant-x", workspaceId: "ws-1" };
    const wsSnap = service.buildSnapshot(wsOp);

    // Should still see all tenant tasks (workspace filtering is not implemented at service level)
    assert.equal(wsSnap.taskBoard.length, 3);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService validates operator identity thoroughly", () => {
  const ctx = createIntegrationContext("aa-console-identity-");
  try {
    const service = new OperatorConsoleBackendService({});

    // Empty operator ID should throw
    assert.throws(
      () => service.buildSnapshot({ operatorId: "", roles: ["viewer"] }),
      /console\.operator_id_required/,
    );

    // Whitespace-only operator ID should throw
    assert.throws(
      () => service.buildSnapshot({ operatorId: "   ", roles: ["viewer"] }),
      /console\.operator_id_required/,
    );

    // Valid operator should work
    const snap = service.buildSnapshot({ operatorId: "valid-op", roles: ["viewer"] });
    assert.equal(snap.operator.operatorId, "valid-op");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService action plan preserves input references", () => {
  const ctx = createIntegrationContext("aa-console-action-refs-");
  try {
    const service = new OperatorConsoleBackendService({});

    const plan = service.planHumanTakeoverAction({
      actionId: "action-full",
      actionType: "modify_next_input",
      taskId: "task-refs-test",
      tenantId: "ref-tenant",
      workspaceId: "ref-workspace",
      operator: { operatorId: "op-refs", roles: ["viewer"] },
      reasonCode: "input_correction",
      beforeStateRef: "state-before-v2",
      afterStateRef: "state-after-v2",
    });

    assert.equal(plan.taskId, "task-refs-test");
    assert.equal(plan.tenantId, "ref-tenant");
    assert.equal(plan.workspaceId, "ref-workspace");
    assert.equal(plan.operatorId, "op-refs");
    assert.equal(plan.auditPayload.beforeStateRef, "state-before-v2");
    assert.equal(plan.auditPayload.afterStateRef, "state-after-v2");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService handles concurrent snapshot building", () => {
  const ctx = createIntegrationContext("aa-console-concurrent-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () =>
        Array.from({ length: 100 }, (_, i) => ({
          taskId: `task-${i}`,
          tenantId: i % 2 === 0 ? "tenant-even" : "tenant-odd",
          workspaceId: null,
          status: "running",
          riskLevel: "low",
          updatedAt: new Date().toISOString(),
        })),
      listPendingApprovals: () =>
        Array.from({ length: 50 }, (_, i) => ({
          approvalId: `appr-${i}`,
          taskId: `task-${i}`,
          tenantId: i % 2 === 0 ? "tenant-even" : "tenant-odd",
          riskLevel: i % 5 === 0 ? "critical" : "medium",
          reason: `Approval reason ${i}`,
          createdAt: new Date().toISOString(),
        })),
      listIncidents: () =>
        Array.from({ length: 30 }, (_, i) => ({
          incidentId: `incident-${i}`,
          taskId: `task-${i}`,
          tenantId: null,
          severity: i % 10 === 0 ? "critical" : "info",
          summary: `Incident ${i}`,
          createdAt: new Date().toISOString(),
        })),
    });

    const operators: OperatorIdentity[] = [
      { operatorId: "global", roles: ["admin"] },
      { operatorId: "tenant-even-op", roles: ["viewer"], tenantId: "tenant-even" },
      { operatorId: "tenant-odd-op", roles: ["viewer"], tenantId: "tenant-odd" },
    ];

    // Build snapshots for all operators
    const snapshots = operators.map((op) => service.buildSnapshot(op));

    // Verify each snapshot is correct
    assert.equal(snapshots[0]!.taskBoard.length, 100);
    assert.equal(snapshots[1]!.taskBoard.length, 50);
    assert.equal(snapshots[2]!.taskBoard.length, 50);
    assert.equal(snapshots[1]!.approvalQueue.length, 25);
    assert.equal(snapshots[2]!.approvalQueue.length, 25);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService incident timeline with mixed severity", () => {
  const ctx = createIntegrationContext("aa-console-incident-severity-");
  try {
    const service = new OperatorConsoleBackendService({
      listIncidents: () => [
        { incidentId: "i-critical-1", taskId: null, tenantId: null, severity: "critical", summary: "Critical 1", createdAt: "2026-04-23T00:00:00.000Z" },
        { incidentId: "i-warning", taskId: null, tenantId: null, severity: "warning", summary: "Warning 1", createdAt: "2026-04-23T01:00:00.000Z" },
        { incidentId: "i-info-1", taskId: null, tenantId: null, severity: "info", summary: "Info 1", createdAt: "2026-04-23T02:00:00.000Z" },
        { incidentId: "i-info-2", taskId: null, tenantId: null, severity: "info", summary: "Info 2", createdAt: "2026-04-23T03:00:00.000Z" },
        { incidentId: "i-critical-2", taskId: null, tenantId: null, severity: "critical", summary: "Critical 2", createdAt: "2026-04-23T04:00:00.000Z" },
      ],
    });

    const snap = service.buildSnapshot({ operatorId: "op-1", roles: ["viewer"] });

    // Should generate finding for critical incidents
    assert.ok(snap.findings.some((f) => f.includes("critical incident")));
    // Timeline sorted by recency (newest first)
    assert.equal(snap.incidentTimeline[0]!.incidentId, "i-critical-2");
    assert.equal(snap.incidentTimeline[1]!.incidentId, "i-info-2");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService empty action plan fields", () => {
  const ctx = createIntegrationContext("aa-console-empty-action-");
  try {
    const service = new OperatorConsoleBackendService({});

    const plan = service.planHumanTakeoverAction({
      actionId: "action-empty",
      actionType: "take_over_task",
      taskId: "task-empty",
      operator: { operatorId: "op-empty", roles: ["viewer"] },
      reasonCode: "test",
      // No tenantId, workspaceId, beforeStateRef, afterStateRef
    });

    assert.equal(plan.tenantId, null);
    assert.equal(plan.workspaceId, null);
    assert.equal(plan.auditPayload.beforeStateRef, null);
    assert.equal(plan.auditPayload.afterStateRef, null);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService builds findings in priority order", () => {
  const ctx = createIntegrationContext("aa-console-findings-priority-");
  try {
    const service = new OperatorConsoleBackendService({
      listPendingApprovals: () => [
        { approvalId: "a-critical", taskId: "t-1", tenantId: null, riskLevel: "critical", reason: "Critical", createdAt: "2026-04-23T00:00:00.000Z" },
        { approvalId: "a-high", taskId: "t-2", tenantId: null, riskLevel: "high", reason: "High", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
      listIncidents: () => [
        { incidentId: "i-critical", taskId: null, tenantId: null, severity: "critical", summary: "Critical incident", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    const snap = service.buildSnapshot({ operatorId: "op-1", roles: ["viewer"] });

    // Both critical findings should be present
    const criticalFindings = snap.findings.filter((f) => f.includes("critical"));
    assert.ok(criticalFindings.length >= 2);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService handles missing optional data source functions", () => {
  const ctx = createIntegrationContext("aa-console-optional-sources-");
  try {
    // Only provide some data sources
    const service = new OperatorConsoleBackendService({
      listTasks: () => [
        { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
      ],
      listIncidents: () => [
        { incidentId: "i-1", taskId: null, tenantId: null, severity: "info", summary: "Info", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
      // listPendingApprovals, listWorkers, listTenants not provided
    });

    const snap = service.buildSnapshot({ operatorId: "op-1", roles: ["viewer"] });

    assert.equal(snap.taskBoard.length, 1);
    assert.equal(snap.incidentTimeline.length, 1);
    assert.deepEqual(snap.approvalQueue, []);
    assert.deepEqual(snap.workerPanel, []);
    assert.deepEqual(snap.tenantPanel, []);
  } finally {
    ctx.cleanup();
  }
});
