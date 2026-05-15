/**
 * Unit tests for console-backend type definitions
 * Tests all exported types from src/platform/five-plane-interface/console-backend/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  ConsoleModuleId,
  OperatorControlActionType,
  OperatorIdentity,
  ConsoleTaskSummary,
  ConsoleApprovalSummary,
  ConsoleWorkerSummary,
  ConsoleIncidentSummary,
  ConsoleDataSources,
  OperatorConsoleSnapshot,
  OperatorActionPlan,
} from "../../../../../src/platform/five-plane-interface/console-backend/index.js";

test("ConsoleModuleId type accepts all valid module identifiers", () => {
  const moduleIds: ConsoleModuleId[] = [
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
  assert.equal(moduleIds.length, 10);
});

test("OperatorControlActionType type accepts all valid action types", () => {
  const actionTypes: OperatorControlActionType[] = [
    "take_over_task",
    "modify_next_input",
    "skip_step",
    "retry_step",
    "switch_model",
    "switch_worker",
    "attach_artifact",
    "inject_feedback",
    "create_improvement_candidate",
    "advance_rollout",
    "rollback_rollout",
    "finish_task",
  ];
  assert.equal(actionTypes.length, 12);
});

test("OperatorIdentity type accepts complete identity object", () => {
  const identity: OperatorIdentity = {
    operatorId: "op-123",
    roles: ["operator", "admin"],
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
  };
  assert.equal(identity.operatorId, "op-123");
  assert.ok(identity.roles.includes("admin"));
  assert.equal(identity.tenantId, "tenant-1");
  assert.equal(identity.workspaceId, "workspace-1");
});

test("OperatorIdentity type allows null tenantId and workspaceId", () => {
  const identity: OperatorIdentity = {
    operatorId: "op-123",
    roles: ["operator"],
    tenantId: null,
    workspaceId: null,
  };
  assert.equal(identity.tenantId, null);
  assert.equal(identity.workspaceId, null);
});

test("OperatorIdentity type allows undefined optional fields", () => {
  const identity: OperatorIdentity = {
    operatorId: "op-123",
    roles: ["operator"],
  };
  assert.equal(identity.tenantId, undefined);
  assert.equal(identity.workspaceId, undefined);
});

test("ConsoleTaskSummary type accepts valid task summary", () => {
  const task: ConsoleTaskSummary = {
    taskId: "task-001",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    status: "running",
    riskLevel: "medium",
    updatedAt: "2026-04-20T10:00:00.000Z",
  };
  assert.equal(task.taskId, "task-001");
  assert.equal(task.status, "running");
  assert.equal(task.riskLevel, "medium");
});

test("ConsoleTaskSummary type accepts null tenantId and workspaceId", () => {
  const task: ConsoleTaskSummary = {
    taskId: "task-001",
    tenantId: null,
    workspaceId: null,
    status: "pending",
    riskLevel: "low",
    updatedAt: "2026-04-20T10:00:00.000Z",
  };
  assert.equal(task.tenantId, null);
  assert.equal(task.workspaceId, null);
});

test("ConsoleTaskSummary riskLevel accepts all valid levels", () => {
  const riskLevels: ConsoleTaskSummary["riskLevel"][] = ["low", "medium", "high", "critical"];
  assert.equal(riskLevels.length, 4);
});

test("ConsoleApprovalSummary type accepts valid approval summary", () => {
  const approval: ConsoleApprovalSummary = {
    approvalId: "approval-001",
    taskId: "task-001",
    tenantId: "tenant-1",
    riskLevel: "high",
    reason: "high risk operation",
    createdAt: "2026-04-20T10:00:00.000Z",
  };
  assert.equal(approval.approvalId, "approval-001");
  assert.equal(approval.riskLevel, "high");
});

test("ConsoleWorkerSummary type accepts valid worker summary", () => {
  const worker: ConsoleWorkerSummary = {
    workerId: "worker-001",
    status: "online",
    activeExecutionCount: 5,
    queueDepth: 10,
  };
  assert.equal(worker.workerId, "worker-001");
  assert.equal(worker.status, "online");
  assert.equal(worker.activeExecutionCount, 5);
  assert.equal(worker.queueDepth, 10);
});

test("ConsoleWorkerSummary status accepts all valid statuses", () => {
  const statuses: ConsoleWorkerSummary["status"][] = ["online", "draining", "offline", "unknown"];
  assert.equal(statuses.length, 4);
});

test("ConsoleIncidentSummary type accepts valid incident summary", () => {
  const incident: ConsoleIncidentSummary = {
    incidentId: "incident-001",
    taskId: "task-001",
    tenantId: "tenant-1",
    severity: "critical",
    summary: "Critical system failure",
    createdAt: "2026-04-20T10:00:00.000Z",
  };
  assert.equal(incident.incidentId, "incident-001");
  assert.equal(incident.severity, "critical");
});

test("ConsoleIncidentSummary severity accepts all valid levels", () => {
  const severities: ConsoleIncidentSummary["severity"][] = ["info", "warning", "critical"];
  assert.equal(severities.length, 3);
});

test("ConsoleDataSources type accepts empty object", () => {
  const sources: ConsoleDataSources = {};
  assert.equal(sources.listTasks, undefined);
  assert.equal(sources.listPendingApprovals, undefined);
});

test("ConsoleDataSources type accepts all optional data source functions", () => {
  const sources: ConsoleDataSources = {
    listTasks: () => [],
    listPendingApprovals: () => [],
    listWorkers: () => [],
    listIncidents: () => [],
    listTenants: () => [],
  };
  assert.ok(sources.listTasks !== undefined);
  assert.ok(sources.listPendingApprovals !== undefined);
  assert.ok(sources.listWorkers !== undefined);
  assert.ok(sources.listIncidents !== undefined);
  assert.ok(sources.listTenants !== undefined);
});

test("OperatorConsoleSnapshot type structure is correct", () => {
  const snapshot: OperatorConsoleSnapshot = {
    generatedAt: "2026-04-20T10:00:00.000Z",
    operator: { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null },
    moduleCoverage: [
      { moduleId: "worker_management", status: "available" },
      { moduleId: "approval_management", status: "empty" },
    ],
    taskBoard: [],
    approvalQueue: [],
    workerPanel: [],
    tenantPanel: [],
    incidentTimeline: [],
    findings: [],
  };
  assert.equal(snapshot.generatedAt, "2026-04-20T10:00:00.000Z");
  assert.equal(snapshot.moduleCoverage.length, 2);
  assert.equal(snapshot.findings.length, 0);
});

test("OperatorActionPlan type structure is correct", () => {
  const plan: OperatorActionPlan = {
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-001",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    operatorId: "op-1",
    requiresPolicyEvaluation: false,
    requiresBreakGlass: false,
    auditPayload: { reasonCode: "operator_override" },
  };
  assert.equal(plan.actionId, "action-1");
  assert.equal(plan.actionType, "take_over_task");
  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
  assert.deepEqual(plan.auditPayload, { reasonCode: "operator_override" });
});

test("OperatorActionPlan allows null tenantId and workspaceId", () => {
  const plan: OperatorActionPlan = {
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-001",
    tenantId: null,
    workspaceId: null,
    operatorId: "op-1",
    requiresPolicyEvaluation: false,
    requiresBreakGlass: false,
    auditPayload: {},
  };
  assert.equal(plan.tenantId, null);
  assert.equal(plan.workspaceId, null);
});

test("ConsoleModuleId module statuses are available and empty", () => {
  const statuses: Array<{ moduleId: ConsoleModuleId; status: "available" | "empty" }> = [
    { moduleId: "worker_management", status: "available" },
    { moduleId: "queue_management", status: "empty" },
  ];
  assert.equal(statuses[0]!.status, "available");
  assert.equal(statuses[1]!.status, "empty");
});
