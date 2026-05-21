import assert from "node:assert/strict";
import test from "node:test";

import type {
  PolicyAction,
  PolicyRiskCategory,
  PolicyMode,
  PolicyStageViewRef,
  PolicyDecisionExplain,
  PolicyAuditRecord,
  PolicyDecisionRequest,
  PolicyDecisionResult,
  PolicyEngineOptions,
  PolicyAuditEvent,
  PolicyAuditService,
  PolicyCacheInvalidationHandler,
  PolicyFingerprint,
  PolicyCacheEntry,
} from "../../../../../src/platform/five-plane-control-plane/iam/policy-engine-model.js";

test("PolicyAction includes all expected action types", () => {
  const actions: PolicyAction[] = [
    "invoke_model",
    "invoke_tool",
    "write_file",
    "exec_command",
    "network_access",
    "install_extension",
    "org_change",
    "dispatch_execution",
    "set_isolation_level",
    "promote_improvement",
    "advance_rollout",
    "modify_knowledge_trust",
    "promote_memory_layer",
  ];

  for (const action of actions) {
    assert.ok(typeof action === "string");
  }
});

test("PolicyRiskCategory includes all expected categories", () => {
  const categories: PolicyRiskCategory[] = [
    "destructive",
    "irreversible",
    "prod_affecting",
    "cost_sensitive",
    "org_changing",
    "sensitive_data",
    "strategy_affecting",
    "governance_sensitive",
  ];

  for (const category of categories) {
    assert.ok(typeof category === "string");
  }
});

test("PolicyStageViewRef includes all lifecycle stage references", () => {
  const stages: PolicyStageViewRef[] = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
  ];

  for (const stage of stages) {
    assert.ok(typeof stage === "string");
  }
});

test("PolicyDecisionExplain structure is well-formed", () => {
  const explain: PolicyDecisionExplain = {
    decisionId: "decision-001",
    summary: "Access granted with constraints",
    factors: ["budget_available", "role_valid", "mode_allowed"],
    policyPaths: ["policy-001", "policy-002"],
    traceRefs: ["trace-001", "trace-002"],
    ruleSources: ["rule-source-001"],
    remediationHint: "Consider upgrading plan for higher limits",
  };

  assert.equal(explain.decisionId, "decision-001");
  assert.equal(explain.summary, "Access granted with constraints");
  assert.equal(explain.factors.length, 3);
  assert.equal(explain.policyPaths.length, 2);
  assert.ok(explain.remediationHint?.startsWith("Consider"));
});

test("PolicyAuditRecord structure is well-formed", () => {
  const record: PolicyAuditRecord = {
    auditId: "audit-001",
    decisionId: "decision-001",
    policyBundleId: "bundle-001",
    policyVersion: "1.0.0",
    inputSnapshotRef: "input-snapshot-001",
    decisionSnapshotRef: "decision-snapshot-001",
    evaluatedAt: "2026-05-21T10:00:00.000Z",
    latencyMs: 15,
  };

  assert.equal(record.auditId, "audit-001");
  assert.equal(record.decisionId, "decision-001");
  assert.equal(record.latencyMs, 15);
  assert.ok(record.evaluatedAt.includes("2026"));
});

test("PolicyDecisionRequest can be constructed with all required fields", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "decision-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["tool_executor", "agent"],
    subjectCapabilities: ["tool:invoke"],
    resourceRef: "resource-001",
    stageViewRef: "execute",
    estimatedCostUsd: 0.5,
    metadata: { environment: "production" },
  };

  assert.equal(request.decisionId, "decision-001");
  assert.equal(request.action, "invoke_tool");
  assert.equal(request.subjectType, "agent");
  assert.equal(request.estimatedCostUsd, 0.5);
  assert.ok(request.metadata?.environment === "production");
});

test("PolicyDecisionRequest with optional execution context fields", () => {
  const request: PolicyDecisionRequest = {
    decisionId: "decision-001",
    taskId: "task-001",
    subjectType: "user",
    subjectId: "user-001",
    action: "org_change",
    riskCategory: "org_changing",
    mode: "supervised",
    executionId: "exec-001",
    harnessRunId: "harness-001",
    nodeRunId: "node-001",
    attemptId: "attempt-001",
    sessionId: "session-001",
    subjectRoles: ["org_admin"],
    subjectCapabilities: ["org:change"],
  };

  assert.equal(request.executionId, "exec-001");
  assert.equal(request.harnessRunId, "harness-001");
  assert.equal(request.nodeRunId, "node-001");
  assert.equal(request.attemptId, "attempt-001");
  assert.equal(request.sessionId, "session-001");
});

test("PolicyDecisionResult structure for allow decision", () => {
  const result: PolicyDecisionResult = {
    decision: "allow",
    reasonCode: "policy.allowed",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: false,
    auditPayload: { timestamp: "2026-05-21T10:00:00.000Z" },
    evaluatedPolicyVersion: "1.0.0",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["rule-001", "rule-002"],
    explainSummary: "Access allowed",
    explain: {
      decisionId: "decision-001",
      summary: "Access allowed based on policy evaluation",
      factors: ["role_valid", "budget_available"],
      policyPaths: ["policy-001"],
    },
  };

  assert.equal(result.decision, "allow");
  assert.equal(result.reasonCode, "policy.allowed");
  assert.equal(result.requiresApproval, false);
  assert.equal(result.killSwitchApplied, false);
  assert.equal(result.decisionTtlMs, 5000);
});

test("PolicyDecisionResult structure for deny decision", () => {
  const result: PolicyDecisionResult = {
    decision: "deny",
    reasonCode: "budget.task_limit_exceeded",
    requiresApproval: false,
    enforcedConstraints: {},
    killSwitchApplied: false,
    auditPayload: { reason: "Task budget exceeded" },
    evaluatedPolicyVersion: "1.0.0",
    decisionTtlMs: null,
    matchedRuleRefs: [],
    explainSummary: "Access denied due to budget constraints",
  };

  assert.equal(result.decision, "deny");
  assert.ok(result.reasonCode.includes("budget"));
});

test("PolicyDecisionResult structure for allow_with_constraints decision", () => {
  const result: PolicyDecisionResult = {
    decision: "allow_with_constraints",
    reasonCode: "policy.constrained",
    requiresApproval: true,
    enforcedConstraints: {
      maxCostUsd: 5,
      requiresApproval: true,
    },
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "1.0.0",
    decisionTtlMs: 3000,
    matchedRuleRefs: ["rule-constrained-001"],
    explainSummary: "Access allowed with constraints",
  };

  assert.equal(result.decision, "allow_with_constraints");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.enforcedConstraints.maxCostUsd, 5);
});

test("PolicyDecisionResult structure for escalate_for_approval decision", () => {
  const result: PolicyDecisionResult = {
    decision: "escalate_for_approval",
    reasonCode: "policy.escalation_required",
    requiresApproval: true,
    enforcedConstraints: { approvalThresholdUsd: 100 },
    killSwitchApplied: false,
    auditPayload: { escalatedAt: "2026-05-21T10:00:00.000Z" },
    evaluatedPolicyVersion: "1.0.0",
    decisionTtlMs: null,
    matchedRuleRefs: ["rule-escalate-001"],
    explainSummary: "Escalated for human approval",
  };

  assert.equal(result.decision, "escalate_for_approval");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.enforcedConstraints.approvalThresholdUsd, 100);
});

test("PolicyEngineOptions structure with all fields", () => {
  const mockAuditService: PolicyAuditService = {
    recordPolicyDecision(event: PolicyAuditEvent) {
      assert.ok(event.id);
      assert.ok(event.timestamp);
    },
  };

  const mockCacheHandler: PolicyCacheInvalidationHandler = (reason: string) => {
    assert.ok(typeof reason === "string");
  };

  const options: PolicyEngineOptions = {
    budgetPolicy: {
      maxTaskCostUsd: 10,
      maxDailyCostUsd: 100,
      maxMonthlyCostUsd: 1000,
      warnAtRatio: 0.8,
      mode: "auto",
    },
    killSwitchEnabled: true,
    auditService: mockAuditService,
    cacheInvalidationHandler: mockCacheHandler,
    decisionCacheTtlMs: 5000,
    decisionCacheMaxEntries: 500,
    policyVersion: "2.0.0",
  };

  assert.equal(options.killSwitchEnabled, true);
  assert.equal(options.decisionCacheTtlMs, 5000);
  assert.equal(options.decisionCacheMaxEntries, 500);
  assert.equal(options.policyVersion, "2.0.0");
});

test("PolicyAuditEvent structure is well-formed", () => {
  const event: PolicyAuditEvent = {
    id: "event-001",
    timestamp: "2026-05-21T10:00:00.000Z",
    decisionId: "decision-001",
    taskId: "task-001",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    decision: "allow",
    reasonCode: "policy.allowed",
    killSwitchApplied: false,
    estimatedCostUsd: 0.5,
    matchedRuleRefs: ["rule-001"],
  };

  assert.equal(event.id, "event-001");
  assert.equal(event.decisionId, "decision-001");
  assert.equal(event.action, "invoke_tool");
  assert.equal(event.decision, "allow");
  assert.equal(event.estimatedCostUsd, 0.5);
  assert.equal(event.matchedRuleRefs.length, 1);
});

test("PolicyFingerprint structure is well-formed", () => {
  const fingerprint: PolicyFingerprint = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
    maxPlatformCostUsd: 10000,
    maxPackCostUsd: 1000,
    maxStepCostUsd: 50,
    stageBudgets: [
      { stage: "plan", maxCostUsd: 1, warnAtRatio: 0.9 },
      { stage: "execute", maxCostUsd: 5, approvalThresholdUsd: 20 },
    ],
    costEstimationTemplates: [
      { templateId: "template-001", description: "Standard task", confidence: "high", multiplier: 1.0 },
    ],
  };

  assert.equal(fingerprint.maxTaskCostUsd, 10);
  assert.equal(fingerprint.mode, "auto");
  assert.equal(fingerprint.stageBudgets?.length, 2);
  assert.equal(fingerprint.costEstimationTemplates?.length, 1);
});

test("PolicyCacheEntry structure is well-formed", () => {
  const entry: PolicyCacheEntry<string> = {
    value: "cached_result",
    cachedAt: Date.now(),
    ttlMs: 5000,
    policyFingerprint: "fingerprint-abc123",
  };

  assert.equal(entry.value, "cached_result");
  assert.ok(entry.cachedAt > 0);
  assert.equal(entry.ttlMs, 5000);
  assert.ok(entry.policyFingerprint.startsWith("fingerprint"));
});

test("PolicyCacheEntry can store complex objects", () => {
  interface DecisionValue {
    decision: string;
    reasonCode: string;
  }

  const entry: PolicyCacheEntry<DecisionValue> = {
    value: { decision: "allow", reasonCode: "policy.allowed" },
    cachedAt: Date.now(),
    ttlMs: 3000,
    policyFingerprint: "fingerprint-xyz789",
  };

  assert.equal(entry.value.decision, "allow");
  assert.equal(entry.value.reasonCode, "policy.allowed");
});

test("PolicyDecisionRequest subjectType validation values", () => {
  const subjectTypes: ("user" | "agent" | "system")[] = ["user", "agent", "system"];

  for (const subjectType of subjectTypes) {
    const request: PolicyDecisionRequest = {
      decisionId: "decision-001",
      taskId: "task-001",
      subjectType,
      subjectId: `${subjectType}-001`,
      action: "invoke_model",
      riskCategory: "cost_sensitive",
      mode: "auto",
    };
    assert.equal(request.subjectType, subjectType);
  }
});

test("PolicyMode accepts unified runtime modes and supervised/auto", () => {
  const modes: PolicyMode[] = [
    "auto",
    "supervised",
    "supervised_auto",
    "human_in_the_loop",
    "full_automation",
  ];

  for (const mode of modes) {
    const request: PolicyDecisionRequest = {
      decisionId: "decision-001",
      taskId: "task-001",
      subjectType: "agent",
      subjectId: "agent-001",
      action: "invoke_model",
      riskCategory: "cost_sensitive",
      mode,
    };
    assert.equal(request.mode, mode);
  }
});

test("PolicyAuditService interface contract", () => {
  const recordedEvents: PolicyAuditEvent[] = [];

  const mockAuditService: PolicyAuditService = {
    recordPolicyDecision(event: PolicyAuditEvent) {
      recordedEvents.push(event);
    },
  };

  mockAuditService.recordPolicyDecision({
    id: "event-001",
    timestamp: "2026-05-21T10:00:00.000Z",
    decisionId: "decision-001",
    taskId: "task-001",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    decision: "allow",
    reasonCode: "policy.allowed",
    killSwitchApplied: false,
    estimatedCostUsd: 0.5,
    matchedRuleRefs: [],
  });

  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0].id, "event-001");
});

test("PolicyCacheInvalidationHandler interface contract", () => {
  let lastReason = "";

  const handler: PolicyCacheInvalidationHandler = (reason: string) => {
    lastReason = reason;
  };

  handler("policy_changed");
  assert.equal(lastReason, "policy_changed");

  handler("cache_expired");
  assert.equal(lastReason, "cache_expired");
});

test("PolicyDecisionResult with audit record", () => {
  const result: PolicyDecisionResult = {
    decision: "allow_with_constraints",
    reasonCode: "policy.constrained",
    requiresApproval: true,
    enforcedConstraints: {},
    killSwitchApplied: false,
    auditPayload: {},
    evaluatedPolicyVersion: "1.0.0",
    decisionTtlMs: 5000,
    matchedRuleRefs: ["rule-001"],
    explainSummary: "Allowed with constraints",
    auditRecord: {
      auditId: "audit-001",
      decisionId: "decision-001",
      policyBundleId: "bundle-001",
      policyVersion: "1.0.0",
      inputSnapshotRef: "input-ref-001",
      decisionSnapshotRef: "decision-ref-001",
      evaluatedAt: "2026-05-21T10:00:00.000Z",
      latencyMs: 12,
    },
  };

  assert.ok(result.auditRecord);
  assert.equal(result.auditRecord?.auditId, "audit-001");
  assert.equal(result.auditRecord?.latencyMs, 12);
});

test("PolicyFingerprint with undefined optional fields", () => {
  const fingerprint: PolicyFingerprint = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
  };

  assert.equal(fingerprint.maxPlatformCostUsd, undefined);
  assert.equal(fingerprint.maxPackCostUsd, undefined);
  assert.equal(fingerprint.maxStepCostUsd, undefined);
  assert.equal(fingerprint.stageBudgets, undefined);
  assert.equal(fingerprint.costEstimationTemplates, undefined);
});