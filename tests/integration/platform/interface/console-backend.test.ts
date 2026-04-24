// @ts-nocheck
/**
 * Integration Test: Console Backend Module
 *
 * Tests the OperatorConsoleBackendService which provides
 * operator console snapshots, action planning, and tenant filtering.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../helpers/integration-context.js";
import {
  OperatorConsoleBackendService,
  type OperatorIdentity,
  type ConsoleTaskSummary,
  type ConsoleApprovalSummary,
  type ConsoleWorkerSummary,
  type ConsoleIncidentSummary,
} from "../../../src/platform/interface/console-backend/index.js";

test("OperatorConsoleBackendService builds snapshot with empty data sources", () => {
  const ctx = createIntegrationContext("aa-console-empty-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    const snapshot = service.buildSnapshot(operator);

    assert.equal(snapshot.operator.operatorId, "op-1");
    assert.ok(snapshot.generatedAt.length > 0);
    assert.deepEqual(snapshot.taskBoard, []);
    assert.deepEqual(snapshot.approvalQueue, []);
    assert.deepEqual(snapshot.workerPanel, []);
    assert.deepEqual(snapshot.tenantPanel, []);
    assert.deepEqual(snapshot.incidentTimeline, []);
    assert.deepEqual(snapshot.findings, []);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService filters task board by tenant scope", () => {
  const ctx = createIntegrationContext("aa-console-taskfilter-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () => [
        { taskId: "task-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        { taskId: "task-2", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        { taskId: "task-3", tenantId: "tenant-a", workspaceId: null, status: "blocked", riskLevel: "medium", updatedAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    // Operator with tenant scope should only see their tenant's tasks
    const scopedOperator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"], tenantId: "tenant-a" };
    const scopedSnapshot = service.buildSnapshot(scopedOperator);

    assert.equal(scopedSnapshot.taskBoard.length, 2);
    assert.ok(scopedSnapshot.taskBoard.every((t) => t.tenantId === "tenant-a"));

    // Global operator sees all tasks
    const globalOperator: OperatorIdentity = { operatorId: "op-2", roles: ["admin"] };
    const globalSnapshot = service.buildSnapshot(globalOperator);

    assert.equal(globalSnapshot.taskBoard.length, 3);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService filters approval queue by tenant scope", () => {
  const ctx = createIntegrationContext("aa-console-approvalfilter-");
  try {
    const service = new OperatorConsoleBackendService({
      listPendingApprovals: () => [
        { approvalId: "appr-1", taskId: "task-1", tenantId: "tenant-a", riskLevel: "high", reason: "High risk action", createdAt: "2026-04-23T00:00:00.000Z" },
        { approvalId: "appr-2", taskId: "task-2", tenantId: "tenant-b", riskLevel: "medium", reason: "Medium risk", createdAt: "2026-04-23T00:00:00.000Z" },
        { approvalId: "appr-3", taskId: "task-3", tenantId: "tenant-a", riskLevel: "critical", reason: "Critical action", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    const scopedOperator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"], tenantId: "tenant-b" };
    const scopedSnapshot = service.buildSnapshot(scopedOperator);

    assert.equal(scopedSnapshot.approvalQueue.length, 1);
    assert.equal(scopedSnapshot.approvalQueue[0]?.approvalId, "appr-2");

    const globalOperator: OperatorIdentity = { operatorId: "op-2", roles: ["admin"] };
    const globalSnapshot = service.buildSnapshot(globalOperator);

    assert.equal(globalSnapshot.approvalQueue.length, 3);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService builds module coverage correctly", () => {
  const ctx = createIntegrationContext("aa-console-modulecov-");
  try {
    const service = new OperatorConsoleBackendService({
      listWorkers: () => [
        { workerId: "w-1", status: "online", activeExecutionCount: 2, queueDepth: 5 },
        { workerId: "w-2", status: "draining", activeExecutionCount: 0, queueDepth: 0 },
      ],
      listTasks: () => [
        { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
      ],
      listPendingApprovals: () => [
        { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "low", reason: "test", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
      listIncidents: () => [
        { incidentId: "i-1", taskId: "t-1", tenantId: null, severity: "info", summary: "test", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
      listTenants: () => [
        { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "standard" },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    const moduleCoverage = snapshot.moduleCoverage;

    // Worker management should be available (workers exist)
    const workerModule = moduleCoverage.find((m) => m.moduleId === "worker_management");
    assert.ok(workerModule != null);
    assert.equal(workerModule?.status, "available");

    // Queue management should be available (w-1 has queueDepth > 0)
    const queueModule = moduleCoverage.find((m) => m.moduleId === "queue_management");
    assert.ok(queueModule != null);
    assert.equal(queueModule?.status, "available");

    // Approval management should be available
    const approvalModule = moduleCoverage.find((m) => m.moduleId === "approval_management");
    assert.ok(approvalModule != null);
    assert.equal(approvalModule?.status, "available");

    // Incident timeline should be available
    const incidentModule = moduleCoverage.find((m) => m.moduleId === "incident_timeline");
    assert.ok(incidentModule != null);
    assert.equal(incidentModule?.status, "available");

    // Tenant management should be available
    const tenantModule = moduleCoverage.find((m) => m.moduleId === "tenant_management");
    assert.ok(tenantModule != null);
    assert.equal(tenantModule?.status, "available");

    // OAPEFLIR loop management should be available (taskBoard has tasks)
    const oapeflirModule = moduleCoverage.find((m) => m.moduleId === "oapeflir_loop_management");
    assert.ok(oapeflirModule != null);
    assert.equal(oapeflirModule?.status, "available");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService module coverage shows empty when no data", () => {
  const ctx = createIntegrationContext("aa-console-moduleempty-");
  try {
    const service = new OperatorConsoleBackendService({
      listWorkers: () => [],
      listTasks: () => [],
      listPendingApprovals: () => [],
      listIncidents: () => [],
      listTenants: () => [],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    const moduleCoverage = snapshot.moduleCoverage;

    // All modules should be empty
    assert.ok(moduleCoverage.every((m) => m.status === "empty"));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService generates critical findings for critical approvals", () => {
  const ctx = createIntegrationContext("aa-console-critical-");
  try {
    const service = new OperatorConsoleBackendService({
      listPendingApprovals: () => [
        { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "critical", reason: "Critical action", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.ok(snapshot.findings.some((f) => f.includes("critical approval waiting for operator decision")));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService generates findings for offline worker with active executions", () => {
  const ctx = createIntegrationContext("aa-console-offline-");
  try {
    const service = new OperatorConsoleBackendService({
      listWorkers: () => [
        { workerId: "w-offline", status: "offline", activeExecutionCount: 3, queueDepth: 0 },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.ok(snapshot.findings.some((f) => f.includes("offline worker still owns active executions")));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService generates findings for critical incidents", () => {
  const ctx = createIntegrationContext("aa-console-incident-");
  try {
    const service = new OperatorConsoleBackendService({
      listIncidents: () => [
        { incidentId: "i-1", taskId: "t-1", tenantId: null, severity: "critical", summary: "System down", createdAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.ok(snapshot.findings.some((f) => f.includes("critical incident requires takeover review")));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService generates findings for blocked tasks", () => {
  const ctx = createIntegrationContext("aa-console-blocked-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () => [
        { taskId: "t-blocked", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks exist in operator scope")));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService plans human takeover action", () => {
  const ctx = createIntegrationContext("aa-console-takeover-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    const plan = service.planHumanTakeoverAction({
      actionId: "action-1",
      actionType: "take_over_task",
      taskId: "task-123",
      operator,
      reasonCode: "manual_intervention_needed",
    });

    assert.equal(plan.actionId, "action-1");
    assert.equal(plan.actionType, "take_over_task");
    assert.equal(plan.taskId, "task-123");
    assert.equal(plan.operatorId, "op-1");
    assert.equal(plan.requiresPolicyEvaluation, false);
    assert.equal(plan.requiresBreakGlass, false);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService flags high-risk actions requiring policy evaluation", () => {
  const ctx = createIntegrationContext("aa-console-highrisk-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    const highRiskActions: Array<"switch_worker" | "attach_artifact" | "advance_rollout" | "rollback_rollout" | "finish_task"> = [
      "switch_worker",
      "attach_artifact",
      "advance_rollout",
      "rollback_rollout",
      "finish_task",
    ];

    for (const actionType of highRiskActions) {
      const plan = service.planHumanTakeoverAction({
        actionId: `action-${actionType}`,
        actionType,
        taskId: "task-123",
        operator,
        reasonCode: "test",
      });
      assert.equal(plan.requiresPolicyEvaluation, true, `${actionType} should require policy evaluation`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService flags break-glass actions without break_glass role", () => {
  const ctx = createIntegrationContext("aa-console-breakglass-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] }; // No break_glass role

    const breakGlassActions: Array<"skip_step" | "switch_worker" | "finish_task" | "rollback_rollout"> = [
      "skip_step",
      "switch_worker",
      "finish_task",
      "rollback_rollout",
    ];

    for (const actionType of breakGlassActions) {
      const plan = service.planHumanTakeoverAction({
        actionId: `action-${actionType}`,
        actionType,
        taskId: "task-123",
        operator,
        reasonCode: "test",
      });
      assert.equal(plan.requiresBreakGlass, true, `${actionType} should require break-glass`);
    }

    // With break_glass role, should not require break-glass
    const authorizedOperator: OperatorIdentity = { operatorId: "op-2", roles: ["viewer", "break_glass"] };
    const plan = service.planHumanTakeoverAction({
      actionId: "action-skip",
      actionType: "skip_step",
      taskId: "task-123",
      operator: authorizedOperator,
      reasonCode: "test",
    });
    assert.equal(plan.requiresBreakGlass, false);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService validates task id required", () => {
  const ctx = createIntegrationContext("aa-console-taskid-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    assert.throws(
      () =>
        service.planHumanTakeoverAction({
          actionId: "a-1",
          actionType: "take_over_task",
          taskId: "",
          operator,
          reasonCode: "test",
        }),
      (error) =>
        error instanceof Error
        && "code" in error
        && error.code === "console.task_id_required"
        && error.message === "Operator action requires a task id.",
    );
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService validates reason required", () => {
  const ctx = createIntegrationContext("aa-console-reason-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    assert.throws(
      () =>
        service.planHumanTakeoverAction({
          actionId: "a-1",
          actionType: "take_over_task",
          taskId: "task-123",
          operator,
          reasonCode: "",
        }),
      (error) =>
        error instanceof Error
        && "code" in error
        && error.code === "console.reason_required"
        && error.message === "Operator action requires a reason code.",
    );
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService validates operator id required", () => {
  const ctx = createIntegrationContext("aa-console-operatorid-");
  try {
    const service = new OperatorConsoleBackendService({});

    assert.throws(
      () =>
        service.buildSnapshot({
          operatorId: "",
          roles: ["viewer"],
        }),
      (error) =>
        error instanceof Error
        && "code" in error
        && error.code === "console.operator_id_required"
        && error.message === "Operator id is required.",
    );
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService sorts incident timeline by recency (newest first)", () => {
  const ctx = createIntegrationContext("aa-console-sort-");
  try {
    const service = new OperatorConsoleBackendService({
      listIncidents: () => [
        { incidentId: "i-old", taskId: null, tenantId: null, severity: "info", summary: "Old incident", createdAt: "2026-04-20T00:00:00.000Z" },
        { incidentId: "i-new", taskId: null, tenantId: null, severity: "info", summary: "New incident", createdAt: "2026-04-23T00:00:00.000Z" },
        { incidentId: "i-mid", taskId: null, tenantId: null, severity: "info", summary: "Mid incident", createdAt: "2026-04-22T00:00:00.000Z" },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.equal(snapshot.incidentTimeline[0]?.incidentId, "i-new");
    assert.equal(snapshot.incidentTimeline[1]?.incidentId, "i-mid");
    assert.equal(snapshot.incidentTimeline[2]?.incidentId, "i-old");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService limits incident timeline to 50 entries", () => {
  const ctx = createIntegrationContext("aa-console-limit-");
  try {
    const service = new OperatorConsoleBackendService({
      listIncidents: () =>
        Array.from({ length: 100 }, (_, i) => ({
          incidentId: `i-${i}`,
          taskId: null,
          tenantId: null,
          severity: "info" as const,
          summary: `Incident ${i}`,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.ok(snapshot.incidentTimeline.length <= 50);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService includes tenant info from data source", () => {
  const ctx = createIntegrationContext("aa-console-tenant-");
  try {
    const service = new OperatorConsoleBackendService({
      listTenants: () => [
        { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "standard" },
        { tenantId: "tenant-2", organizationId: "org-2", isolationMode: "isolated" },
      ],
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.equal(snapshot.tenantPanel.length, 2);
    assert.ok(snapshot.tenantPanel.some((t) => t.tenantId === "tenant-1"));
    assert.ok(snapshot.tenantPanel.some((t) => t.tenantId === "tenant-2"));
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService filters tenants by operator tenant scope", () => {
  const ctx = createIntegrationContext("aa-console-tenantfilter-");
  try {
    const service = new OperatorConsoleBackendService({
      listTenants: () => [
        { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "standard" },
        { tenantId: "tenant-2", organizationId: "org-2", isolationMode: "isolated" },
        { tenantId: "tenant-3", organizationId: "org-3", isolationMode: "standard" },
      ],
    });

    const scopedOperator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"], tenantId: "tenant-2" };
    const scopedSnapshot = service.buildSnapshot(scopedOperator);

    assert.equal(scopedSnapshot.tenantPanel.length, 1);
    assert.equal(scopedSnapshot.tenantPanel[0]?.tenantId, "tenant-2");

    const globalOperator: OperatorIdentity = { operatorId: "op-2", roles: ["admin"] };
    const globalSnapshot = service.buildSnapshot(globalOperator);

    assert.equal(globalSnapshot.tenantPanel.length, 3);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService does not require break-glass for non break-glass actions", () => {
  const ctx = createIntegrationContext("aa-console-nonbreakglass-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    const nonBreakGlassActions: Array<"take_over_task" | "modify_next_input" | "retry_step" | "switch_model" | "inject_feedback" | "create_improvement_candidate"> = [
      "take_over_task",
      "modify_next_input",
      "retry_step",
      "switch_model",
      "inject_feedback",
      "create_improvement_candidate",
    ];

    for (const actionType of nonBreakGlassActions) {
      const plan = service.planHumanTakeoverAction({
        actionId: `action-${actionType}`,
        actionType,
        taskId: "task-123",
        operator,
        reasonCode: "test",
      });
      assert.equal(plan.requiresBreakGlass, false, `${actionType} should not require break-glass`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService workerPanel is not filtered by tenant", () => {
  const ctx = createIntegrationContext("aa-console-worker-");
  try {
    const service = new OperatorConsoleBackendService({
      listWorkers: () => [
        { workerId: "w-1", status: "online", activeExecutionCount: 2, queueDepth: 5 },
      ],
    });

    const scopedOperator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"], tenantId: "tenant-a" };
    const snapshot = service.buildSnapshot(scopedOperator);

    // Workers are not filtered by tenant scope
    assert.equal(snapshot.workerPanel.length, 1);
    assert.equal(snapshot.workerPanel[0]?.workerId, "w-1");
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService handles missing data source functions gracefully", () => {
  const ctx = createIntegrationContext("aa-console-missing-");
  try {
    const service = new OperatorConsoleBackendService({
      listTasks: () => [{ taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" }],
      // Other sources not provided
    });

    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);

    assert.equal(snapshot.taskBoard.length, 1);
    assert.deepEqual(snapshot.approvalQueue, []);
    assert.deepEqual(snapshot.workerPanel, []);
    assert.deepEqual(snapshot.tenantPanel, []);
    assert.deepEqual(snapshot.incidentTimeline, []);
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService action plan includes audit payload", () => {
  const ctx = createIntegrationContext("aa-console-audit-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    const plan = service.planHumanTakeoverAction({
      actionId: "action-audit",
      actionType: "retry_step",
      taskId: "task-456",
      operator,
      reasonCode: "user_requested",
      beforeStateRef: "step_1",
      afterStateRef: "step_2",
    });

    assert.deepEqual(plan.auditPayload, {
      actionType: "retry_step",
      reasonCode: "user_requested",
      beforeStateRef: "step_1",
      afterStateRef: "step_2",
    });
  } finally {
    ctx.cleanup();
  }
});

test("OperatorConsoleBackendService action plan includes tenant and workspace when provided", () => {
  const ctx = createIntegrationContext("aa-console-scope-");
  try {
    const service = new OperatorConsoleBackendService({});
    const operator: OperatorIdentity = { operatorId: "op-1", roles: ["viewer"] };

    const plan = service.planHumanTakeoverAction({
      actionId: "action-scope",
      actionType: "take_over_task",
      taskId: "task-789",
      tenantId: "tenant-xyz",
      workspaceId: "workspace-abc",
      operator,
      reasonCode: "test",
    });

    assert.equal(plan.tenantId, "tenant-xyz");
    assert.equal(plan.workspaceId, "workspace-abc");
  } finally {
    ctx.cleanup();
  }
});
