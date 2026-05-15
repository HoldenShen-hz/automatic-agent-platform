/**
 * Unit tests for Console Backend types
 * Tests src/platform/five-plane-interface/console-backend/index.ts types
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

test("ConsoleModuleId accepts all valid variants", () => {
  const ids: ConsoleModuleId[] = [
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

  assert.equal(ids.length, 10);
});

test("OperatorControlActionType accepts all valid variants", () => {
  const actions: OperatorControlActionType[] = [
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

  assert.equal(actions.length, 12);
});

test("OperatorIdentity structure", () => {
  const identity: OperatorIdentity = {
    operatorId: "op-123",
    roles: ["operator", "admin"],
    tenantId: "tenant-abc",
    workspaceId: "workspace-xyz",
  };

  assert.equal(identity.operatorId, "op-123");
  assert.equal(identity.roles.length, 2);
  assert.equal(identity.tenantId, "tenant-abc");
  assert.equal(identity.workspaceId, "workspace-xyz");
});

test("OperatorIdentity allows null tenant and workspace", () => {
  const identity: OperatorIdentity = {
    operatorId: "op-456",
    roles: ["viewer"],
    tenantId: null,
    workspaceId: null,
  };

  assert.equal(identity.tenantId, null);
  assert.equal(identity.workspaceId, null);
});

test("ConsoleTaskSummary structure", () => {
  const task: ConsoleTaskSummary = {
    taskId: "task-001",
    tenantId: "tenant-001",
    workspaceId: "workspace-001",
    status: "running",
    riskLevel: "high",
    updatedAt: "2026-04-01T10:00:00.000Z",
  };

  assert.equal(task.taskId, "task-001");
  assert.equal(task.status, "running");
  assert.equal(task.riskLevel, "high");
});

test("ConsoleTaskSummary riskLevel variants", () => {
  const riskLevels: Array<ConsoleTaskSummary["riskLevel"]> = ["low", "medium", "high", "critical"];
  for (const riskLevel of riskLevels) {
    const task: ConsoleTaskSummary = {
      taskId: `task-${riskLevel}`,
      tenantId: null,
      workspaceId: null,
      status: "pending",
      riskLevel,
      updatedAt: "2026-04-01T10:00:00.000Z",
    };
    assert.equal(task.riskLevel, riskLevel);
  }
});

test("ConsoleApprovalSummary structure", () => {
  const approval: ConsoleApprovalSummary = {
    approvalId: "approval-001",
    taskId: "task-approval",
    tenantId: "tenant-001",
    riskLevel: "critical",
    reason: "Deploy to production requires approval",
    createdAt: "2026-04-01T09:00:00.000Z",
  };

  assert.equal(approval.approvalId, "approval-001");
  assert.equal(approval.riskLevel, "critical");
});

test("ConsoleWorkerSummary structure", () => {
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

test("ConsoleWorkerSummary status variants", () => {
  const statuses: Array<ConsoleWorkerSummary["status"]> = ["online", "draining", "offline", "unknown"];
  for (const status of statuses) {
    const worker: ConsoleWorkerSummary = {
      workerId: `worker-${status}`,
      status,
      activeExecutionCount: 0,
      queueDepth: 0,
    };
    assert.equal(worker.status, status);
  }
});

test("ConsoleIncidentSummary structure", () => {
  const incident: ConsoleIncidentSummary = {
    incidentId: "incident-001",
    taskId: "task-incident",
    tenantId: "tenant-001",
    severity: "critical",
    summary: "System outage detected",
    createdAt: "2026-04-01T08:00:00.000Z",
  };

  assert.equal(incident.incidentId, "incident-001");
  assert.equal(incident.severity, "critical");
});

test("ConsoleIncidentSummary severity variants", () => {
  const severities: Array<ConsoleIncidentSummary["severity"]> = ["info", "warning", "critical"];
  for (const severity of severities) {
    const incident: ConsoleIncidentSummary = {
      incidentId: `incident-${severity}`,
      taskId: null,
      tenantId: null,
      severity,
      summary: "Test incident",
      createdAt: "2026-04-01T08:00:00.000Z",
    };
    assert.equal(incident.severity, severity);
  }
});

test("ConsoleDataSources structure with all optional methods", () => {
  const sources: ConsoleDataSources = {
    listTasks: () => [],
    listPendingApprovals: () => [],
    listWorkers: () => [],
    listIncidents: () => [],
    listTenants: () => [],
  };

  assert.equal(typeof sources.listTasks, "function");
  assert.equal(typeof sources.listPendingApprovals, "function");
  assert.equal(typeof sources.listWorkers, "function");
  assert.equal(typeof sources.listIncidents, "function");
  assert.equal(typeof sources.listTenants, "function");
});

test("ConsoleDataSources allows empty object", () => {
  const sources: ConsoleDataSources = {};
  assert.equal(sources.listTasks, undefined);
  assert.equal(sources.listPendingApprovals, undefined);
});

test("OperatorActionPlan structure", () => {
  const plan: OperatorActionPlan = {
    actionId: "action-001",
    actionType: "take_over_task",
    taskId: "task-action",
    tenantId: "tenant-001",
    workspaceId: "workspace-001",
    operatorId: "op-action",
    requiresPolicyEvaluation: false,
    requiresBreakGlass: false,
    auditPayload: { reasonCode: "user_request" },
  };

  assert.equal(plan.actionId, "action-001");
  assert.equal(plan.actionType, "take_over_task");
  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("OperatorActionPlan with requiresPolicyEvaluation true", () => {
  const plan: OperatorActionPlan = {
    actionId: "action-002",
    actionType: "switch_worker",
    taskId: "task-switch",
    tenantId: null,
    workspaceId: null,
    operatorId: "op-002",
    requiresPolicyEvaluation: true,
    requiresBreakGlass: false,
    auditPayload: {},
  };

  assert.equal(plan.requiresPolicyEvaluation, true);
});

test("OperatorActionPlan with requiresBreakGlass true", () => {
  const plan: OperatorActionPlan = {
    actionId: "action-003",
    actionType: "skip_step",
    taskId: "task-skip",
    tenantId: null,
    workspaceId: null,
    operatorId: "op-003",
    requiresPolicyEvaluation: false,
    requiresBreakGlass: true,
    auditPayload: { reason: "break_glass_approval" },
  };

  assert.equal(plan.requiresBreakGlass, true);
});

test("OperatorConsoleSnapshot structure", () => {
  const snapshot: OperatorConsoleSnapshot = {
    generatedAt: "2026-04-01T12:00:00.000Z",
    operator: {
      operatorId: "op-snapshot",
      roles: ["operator"],
      tenantId: null,
      workspaceId: null,
    },
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

  assert.equal(snapshot.generatedAt, "2026-04-01T12:00:00.000Z");
  assert.equal(snapshot.moduleCoverage.length, 2);
  assert.equal(snapshot.findings.length, 0);
});
