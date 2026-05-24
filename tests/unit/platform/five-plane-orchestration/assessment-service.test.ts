import assert from "node:assert/strict";
import test from "node:test";

import { AssessmentService } from "../../../../src/platform/five-plane-orchestration/oapeflir/assessment-service.js";
import type { ConstraintPack } from "../../../../src/platform/five-plane-orchestration/harness/constraint-pack.js";
import type { TaskSituation } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";

function makeSituation(overrides: Partial<TaskSituation> = {}): TaskSituation {
  return {
    taskId: overrides.taskId ?? "task-1",
    timestamp: overrides.timestamp ?? 1_717_000_000_000,
    objective: overrides.objective ?? "fix deployment rollback",
    currentPhase: overrides.currentPhase ?? "planning",
    userIntent: overrides.userIntent ?? {
      raw: "rollback the failed deploy",
      normalized: "rollback deploy",
      confidence: 0.92,
    },
    blockers: overrides.blockers ?? [],
    codebaseSnapshot: overrides.codebaseSnapshot ?? {
      rootPath: "/workspace",
      fileCount: 1,
      relevantFiles: [],
    },
    environmentContext: overrides.environmentContext ?? {
      nodeVersion: "22",
      platform: "darwin",
      workingDirectory: "/workspace",
      availableTools: ["git"],
    },
    historicalContext: overrides.historicalContext ?? {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    relevantMemory: overrides.relevantMemory ?? [],
    fileRefs: overrides.fileRefs ?? ["src/index.ts"],
    metrics: overrides.metrics ?? {},
  };
}

function makeConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: overrides.policyIds ?? ["policy-1"],
    approvalMode: overrides.approvalMode ?? "none",
    autonomyMode: overrides.autonomyMode ?? "semi_auto",
    tool_policy: overrides.tool_policy ?? { allowedTools: ["git"] },
    risk_policy: overrides.risk_policy ?? { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    output_policy: overrides.output_policy ?? { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: overrides.budgetEnvelope ?? { maxSteps: 10, maxCost: 10_000, maxDurationMs: 60_000 },
    sandboxRequirement: overrides.sandboxRequirement ?? {
      sandboxMode: "ephemeral",
      timeoutMs: 60_000,
    },
    approvalRequirement: overrides.approvalRequirement ?? {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 30_000,
    },
  };
}

test("AssessmentService produces low-risk trivial assessments for straightforward tasks", () => {
  const service = new AssessmentService();

  const result = service.assess(makeSituation(), makeConstraintPack());

  assert.equal(result.riskAssessment.level, "low");
  assert.equal(result.assessment.complexity, "trivial");
  assert.equal(result.assessment.routingDecision.division, "ops");
  assert.equal(result.assessment.routingDecision.workflow, "single-step");
});

test("AssessmentService escalates approval-required situations into medium risk factors", () => {
  const service = new AssessmentService();

  const result = service.assess(
    makeSituation({
      environmentContext: {
        nodeVersion: "22",
        platform: "darwin",
        workingDirectory: "/workspace",
        availableTools: ["apply_patch", "git"],
      },
      metrics: { approvalPending: 1 },
    }),
    makeConstraintPack({ approvalMode: "required" }),
  );

  assert.equal(result.riskAssessment.level, "high");
  assert.ok(result.riskAssessment.factors.includes("approval_mode_required"));
  assert.ok(result.riskAssessment.factors.includes("approval_pending"));
  assert.ok(result.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService derives critical complexity from severe blockers and budget infeasibility", () => {
  const service = new AssessmentService();

  const result = service.assess(
    makeSituation({
      blockers: [{ description: "production outage", severity: "critical" }],
      codebaseSnapshot: { rootPath: "/workspace", fileCount: 25, relevantFiles: [] },
      fileRefs: Array.from({ length: 25 }, (_, index) => `file-${index}.ts`),
    }),
    makeConstraintPack({
      budgetEnvelope: { maxSteps: 5, maxCost: 100, maxDurationMs: 1_000 },
    }),
  );

  assert.equal(result.riskAssessment.level, "critical");
  assert.equal(result.assessment.complexity, "critical");
  assert.ok(result.riskAssessment.factors.includes("critical_blocker"));
  assert.ok(result.riskAssessment.factors.includes("budget_exceeds_feasibility_threshold"));
  assert.ok(result.riskAssessment.factors.includes("steps_exceed_feasibility_threshold"));
});

test("AssessmentService accepts wrapped inputs and effective policy snapshots", () => {
  const service = new AssessmentService();

  const result = service.assess({
    taskSituation: makeSituation({
      environmentContext: {
        nodeVersion: "22",
        platform: "darwin",
        workingDirectory: "/workspace",
        availableTools: ["security_scan"],
      },
      objective: "run oauth security audit",
    }),
    constraintPack: makeConstraintPack({ approvalMode: "supervised" }),
    effectivePolicySnapshot: {
      policyIds: ["policy-1"],
      blockedTools: ["security_scan"],
      appliedPolicies: [{ policyId: "policy-1", version: "v1", constraints: ["high_risk"] }],
      autonomyLevel: "suggestion",
      approvalMode: "supervised",
    },
    inheritedRiskAssessment: {
      factors: ["legacy_incident"],
    },
  });

  assert.equal(result.assessment.routingDecision.division, "security");
  assert.ok(result.riskAssessment.factors.includes("policy_suggestion_mode"));
  assert.ok(result.riskAssessment.factors.includes("blocked_tools:security_scan"));
  assert.ok(result.riskAssessment.factors.includes("policy_constraint:policy-1"));
  assert.ok(result.riskAssessment.factors.includes("inherited:legacy_incident"));
});
