import assert from "node:assert/strict";
import test from "node:test";

import { AssessmentService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/assessment-service.js";
import type { TaskSituation } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";

function makeTaskSituation(overrides: Partial<TaskSituation> = {}): TaskSituation {
  const now = Date.now();
  return {
    taskId: "test-task-001",
    timestamp: now,
    objective: "Test objective",
    currentPhase: "planning",
    userIntent: { raw: "Test raw intent", normalized: "test normalized", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: { rootPath: ".", fileCount: 5, relevantFiles: [] },
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/tmp", availableTools: ["shell", "read"] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
    ...overrides,
  };
}

test("assess returns UnifiedAssessment with correct structure", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation();
  const result = service.assess(situation);

  assert.equal(result.taskId, "test-task-001");
  assert.ok(result.timestamp > 0);
  assert.ok(result.situationRef.startsWith("task_situation:"));
  assert.equal(result.phase, "pre-execution");
  assert.ok(["trivial", "simple", "moderate", "complex", "critical"].includes(result.complexity));
  assert.ok(["low", "medium", "high", "critical"].includes(result.risk));
  assert.ok(result.routingDecision.division.length > 0);
  assert.ok(result.routingDecision.workflow.length > 0);
  assert.ok(result.resourceAllocation.modelClass.length > 0);
  assert.ok(result.resourceAllocation.maxTokens > 0);
  assert.ok(result.resourceAllocation.timeoutMs > 0);
});

test("assess identifies critical blocker elevates to critical risk", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    blockers: [{ severity: "critical", description: "System unavailable" }],
  });
  const result = service.assess(situation);
  assert.equal(result.risk, "critical");
  assert.ok(result.riskAssessment.factors.includes("critical_blocker"));
});

test("assess identifies low intent confidence as risk factor", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    userIntent: { raw: "unclear", normalized: "maybe", confidence: 0.4 },
  });
  const result = service.assess(situation);
  assert.ok(result.riskAssessment.factors.includes("low_intent_confidence"));
});

test("assess identifies high risk tooling", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/tmp", availableTools: ["shell", "deploy"] },
  });
  const result = service.assess(situation);
  assert.ok(result.riskAssessment.factors.includes("high_risk_tooling"));
});

test("assess identifies approval pending as risk factor", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    metrics: { approvalPending: 2 },
  });
  const result = service.assess(situation);
  assert.ok(result.riskAssessment.factors.includes("approval_pending"));
});

test("assess with ConstraintPack approval mode required", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation();
  const result = service.assess({
    taskSituation: situation,
    constraintPack: { policyIds: ["p1"], approvalMode: "required", budgetEnvelope: { maxSteps: 5, maxCost: 10, maxDurationMs: 60000 }, autonomyMode: "semi_auto", toolPolicy: { allowedTools: [] } },
  });
  assert.ok(result.riskAssessment.factors.includes("approval_mode_required"));
});

test("assess with ConstraintPack supervised mode", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation();
  const result = service.assess({
    taskSituation: situation,
    constraintPack: { policyIds: ["p1"], approvalMode: "supervised", budgetEnvelope: { maxSteps: 5, maxCost: 10, maxDurationMs: 60000 }, autonomyMode: "semi_auto", toolPolicy: { allowedTools: [] } },
  });
  assert.ok(result.riskAssessment.factors.includes("approval_mode_supervised"));
});

test("assess with tight budget envelope", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation();
  const result = service.assess({
    taskSituation: situation,
    constraintPack: { policyIds: ["p1"], approvalMode: "none", budgetEnvelope: { maxSteps: 1, maxCost: 0.1, maxDurationMs: 60000 }, autonomyMode: "semi_auto", toolPolicy: { allowedTools: [] } },
  });
  assert.ok(result.riskAssessment.factors.includes("tight_budget_envelope"));
});

test("assess with effectivePolicySnapshot blocking tools", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    environmentContext: { nodeVersion: "20.0.0", platform: "darwin", workingDirectory: "/tmp", availableTools: ["shell", "read", "apply_patch"] },
  });
  const result = service.assess({
    taskSituation: situation,
    effectivePolicySnapshot: { snapshotId: "snap1", blockedTools: ["apply_patch"] },
  });
  assert.ok(result.riskAssessment.factors.some(f => f.startsWith("blocked_tools:")));
});

test("assess with inheritedRiskAssessment", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation();
  const result = service.assess({
    taskSituation: situation,
    inheritedRiskAssessment: { level: "high", factors: ["previous_failure"] },
  });
  assert.ok(result.riskAssessment.factors.some(f => f.startsWith("inherited:previous_failure")));
});

test("assess sets correct executionMode based on risk", () => {
  const serviceLow = new AssessmentService();
  const lowRisk = serviceLow.assess(makeTaskSituation({ blockers: [] }));
  assert.equal(lowRisk.executionMode, "auto");

  const serviceHigh = new AssessmentService();
  const highBlocker = makeTaskSituation({ blockers: [{ severity: "high", description: "test" }] });
  const highRisk = serviceHigh.assess(highBlocker);
  assert.ok(highRisk.executionMode === "supervised" || highRisk.executionMode === "auto");

  const serviceCritical = new AssessmentService();
  const criticalSituation = makeTaskSituation({ blockers: [{ severity: "critical", description: "test" }] });
  const criticalRisk = serviceCritical.assess(criticalSituation);
  assert.equal(criticalRisk.executionMode, "manual");
});

test("assess sets workflow to single-step for trivial/simple complexity", () => {
  const service = new AssessmentService();
  // trivial complexity: very few files, no blockers
  const situation = makeTaskSituation({ fileRefs: [], codebaseSnapshot: { rootPath: ".", fileCount: 0, relevantFiles: [] } });
  const result = service.assess(situation);
  assert.equal(result.routingDecision.workflow, "single-step");
});

test("assess sets workflow to multi-step for moderate+ complexity", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    fileRefs: ["a.ts", "b.ts", "c.ts"],
    codebaseSnapshot: { rootPath: ".", fileCount: 30, relevantFiles: [{ path: "a.ts" }, { path: "b.ts" }, { path: "c.ts" }] },
    blockers: [{ severity: "high", description: "test" }],
  });
  const result = service.assess(situation);
  assert.equal(result.routingDecision.workflow, "multi-step");
});

test("assess complexity scoring - trivial threshold", () => {
  const service = new AssessmentService();
  // Score must be < 8 for trivial (0 files * 0.5 = 0, 0 blockers = 0, 0 memory * 0.5 = 0, risk = 0 = low)
  const situation = makeTaskSituation({
    fileRefs: [],
    blockers: [],
    relevantMemory: [],
    codebaseSnapshot: { rootPath: ".", fileCount: 0, relevantFiles: [] },
    userIntent: { raw: "simple task", normalized: "simple task", confidence: 0.9 }
  });
  const result = service.assess(situation);
  // Trivial: score < 8, Simple: score >= 8
  assert.ok(result.complexity === "trivial" || result.complexity === "simple", `Expected trivial or simple, got ${result.complexity}`);
});

test("assess complexity scoring - critical with many files and critical blocker", () => {
  const service = new AssessmentService();
  const files = Array.from({ length: 50 }, (_, i) => ({ path: `file${i}.ts` }));
  const situation = makeTaskSituation({
    fileRefs: files.map(f => f.path),
    blockers: [{ severity: "critical", description: "system down" }],
    relevantMemory: Array.from({ length: 30 }, (_, i) => `mem${i}`),
    codebaseSnapshot: { rootPath: ".", fileCount: 100, relevantFiles: files },
  });
  const result = service.assess(situation);
  assert.equal(result.complexity, "critical");
});

test("assess resource allocation sizes correctly", () => {
  const service = new AssessmentService();
  const files = Array.from({ length: 50 }, (_, i) => ({ path: `f${i}.ts` }));
  const critical = makeTaskSituation({
    fileRefs: files.map(f => f.path),
    blockers: [{ severity: "critical", description: "test" }],
    codebaseSnapshot: { rootPath: ".", fileCount: 80, relevantFiles: files },
  });
  const result = service.assess(critical);
  assert.equal(result.resourceAllocation.modelClass, "large");
  assert.equal(result.resourceAllocation.maxTokens, 12000);
  assert.equal(result.resourceAllocation.timeoutMs, 180000);
});

test("assess suggestedActions includes resolve for blockers", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    blockers: [{ severity: "high", description: "config missing" }],
  });
  const result = service.assess(situation);
  assert.ok(result.suggestedActions.some(a => a.startsWith("resolve:")));
});

test("assess suggestedActions includes request_approval when required", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    blockers: [{ severity: "critical", description: "test" }],
  });
  const result = service.assess(situation);
  assert.ok(result.suggestedActions.includes("request_approval"));
});

test("assess suggestedActions includes produce_explicit_plan for non-trivial", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation({
    fileRefs: ["a.ts", "b.ts"],
    codebaseSnapshot: { rootPath: ".", fileCount: 20, relevantFiles: [{ path: "a.ts" }, { path: "b.ts" }] },
  });
  const result = service.assess(situation);
  assert.ok(result.suggestedActions.includes("produce_explicit_plan"));
});

test("AssessmentService constructor accepts options", () => {
  const service = new AssessmentService({
    highRiskTools: ["custom_tool"],
  });
  // @ts-ignore - accessing private
  assert.ok(service.highRiskTools.has("custom_tool"));
});

test("assess works with AssessmentInput wrapper", () => {
  const service = new AssessmentService();
  const situation = makeTaskSituation();
  const input = {
    taskSituation: situation,
    constraintPack: { policyIds: ["p1"], approvalMode: "none", budgetEnvelope: { maxSteps: 5, maxCost: 10, maxDurationMs: 60000 }, autonomyMode: "semi_auto", toolPolicy: { allowedTools: [] } as const },
  };
  const result = service.assess(input);
  assert.equal(result.taskId, "test-task-001");
});