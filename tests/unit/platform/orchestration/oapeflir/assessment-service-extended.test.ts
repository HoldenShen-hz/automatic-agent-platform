/**
 * Assessment Service Unit Tests - Extended Coverage
 *
 * Tests for AssessmentService business logic.
 *
 * Architecture: §10 OAPEFLIR - Assessment Phase
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AssessmentService } from "../../../../../src/platform/orchestration/oapeflir/assessment-service.js";

function createMinimalSituation(overrides: any = {}) {
  return {
    taskId: "task_min",
    timestamp: Date.now(),
    objective: "test objective",
    currentPhase: "planning",
    userIntent: { raw: "test", normalized: "test", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: { rootPath: "/tmp", fileCount: 1, relevantFiles: [] },
    environmentContext: { nodeVersion: "22.0", platform: "darwin", workingDirectory: "/tmp", availableTools: [] },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [] },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource Allocation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService assigns small model for trivial complexity", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: [],
    blockers: [],
  }));

  assert.equal(result.resourceAllocation.modelClass, "small");
  assert.equal(result.resourceAllocation.maxTokens, 3000);
  assert.equal(result.resourceAllocation.timeoutMs, 60000);
});

test("AssessmentService assigns medium model for moderate complexity", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: ["file1.ts", "file2.ts"],
    blockers: [],
  }));

  assert.equal(result.resourceAllocation.modelClass, "medium");
  assert.equal(result.resourceAllocation.maxTokens, 5000);
});

test("AssessmentService assigns large model for complex complexity", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: Array.from({ length: 10 }, (_, i) => `file${i}.ts`),
    blockers: [{ description: "blocker1", severity: "high" }],
  }));

  assert.equal(result.resourceAllocation.modelClass, "large");
  assert.equal(result.resourceAllocation.maxTokens, 8000);
  assert.equal(result.resourceAllocation.timeoutMs, 120000);
});

test("AssessmentService assigns large model for critical complexity", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: Array.from({ length: 20 }, (_, i) => `file${i}.ts`),
    blockers: [],
  }));

  assert.equal(result.resourceAllocation.modelClass, "large");
  assert.equal(result.resourceAllocation.maxTokens, 12000);
  assert.equal(result.resourceAllocation.timeoutMs, 180000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggested Actions Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService suggests produce_explicit_plan for non-trivial", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: ["file1.ts", "file2.ts"],
  }));

  assert.ok(result.suggestedActions.includes("produce_explicit_plan"));
});

test("AssessmentService does not suggest produce_explicit_plan for trivial", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: [],
    blockers: [],
  }));

  assert.ok(!result.suggestedActions.includes("produce_explicit_plan"));
});

test("AssessmentService suggests request_approval for high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "high risk blocker", severity: "high" }],
  }));

  assert.ok(result.suggestedActions.includes("request_approval"));
});

test("AssessmentService suggests request_approval for critical risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "critical issue", severity: "critical" }],
  }));

  assert.ok(result.suggestedActions.includes("request_approval"));
});

test("AssessmentService suggests resolve for each blocker", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [
      { description: "missing auth token", severity: "high" },
      { description: "invalid config", severity: "medium" },
    ],
  }));

  assert.ok(result.suggestedActions.some(a => a.includes("resolve:missing auth token")));
  assert.ok(result.suggestedActions.some(a => a.includes("resolve:invalid config")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Mode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService returns auto execution mode for low risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: [],
    blockers: [],
  }));

  assert.equal(result.executionMode, "auto");
});

test("AssessmentService returns supervised execution mode for high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "high risk", severity: "high" }],
  }));

  assert.equal(result.executionMode, "supervised");
});

test("AssessmentService returns manual execution mode for critical risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "critical issue", severity: "critical" }],
  }));

  assert.equal(result.executionMode, "manual");
});

// ─────────────────────────────────────────────────────────────────────────────
// High Risk Tools Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService detects apply_patch as high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    environmentContext: {
      nodeVersion: "22.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: ["read", "apply_patch"],
    },
  }));

  assert.ok(result.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService detects shell as high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    environmentContext: {
      nodeVersion: "22.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: ["read", "shell"],
    },
  }));

  assert.ok(result.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService detects deploy as high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    environmentContext: {
      nodeVersion: "22.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: ["read", "deploy"],
    },
  }));

  assert.ok(result.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService does not flag safe tools", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    environmentContext: {
      nodeVersion: "22.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: ["read", "grep", "glob"],
    },
  }));

  assert.ok(!result.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService custom high risk tools via options", () => {
  const service = new AssessmentService({
    highRiskTools: ["custom_dangerous_tool"],
  });
  const result = service.assess(createMinimalSituation({
    environmentContext: {
      nodeVersion: "22.0",
      platform: "darwin",
      workingDirectory: "/tmp",
      availableTools: ["read", "custom_dangerous_tool"],
    },
  }));

  assert.ok(result.riskAssessment.factors.includes("high_risk_tooling"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval Policy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService requires admin approval for critical risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "critical", severity: "critical" }],
  }));

  assert.equal(result.approvalPolicy.required, true);
  assert.equal(result.approvalPolicy.level, "admin");
});

test("AssessmentService requires user approval for high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "high", severity: "high" }],
  }));

  assert.equal(result.approvalPolicy.required, true);
  assert.equal(result.approvalPolicy.level, "user");
});

test("AssessmentService does not require approval for low risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: [],
    blockers: [],
  }));

  assert.equal(result.approvalPolicy.required, false);
  assert.equal(result.approvalPolicy.level, "none");
});

// ─────────────────────────────────────────────────────────────────────────────
// Low Intent Confidence Detection
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService detects low intent confidence", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    userIntent: { raw: "maybe do something", normalized: "maybe do something", confidence: 0.5 },
  }));

  assert.ok(result.riskAssessment.factors.includes("low_intent_confidence"));
});

test("AssessmentService does not flag high intent confidence", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    userIntent: { raw: "definitely do this", normalized: "definitely do this", confidence: 0.9 },
  }));

  assert.ok(!result.riskAssessment.factors.includes("low_intent_confidence"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval Pending Detection
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService detects approval pending", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    metrics: { approvalPending: 1 },
  }));

  assert.ok(result.riskAssessment.factors.includes("approval_pending"));
});

test("AssessmentService does not flag when no approval pending", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    metrics: { approvalPending: 0 },
  }));

  assert.ok(!result.riskAssessment.factors.includes("approval_pending"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Blockers Severity Detection
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService detects critical blocker", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "system failure", severity: "critical" }],
  }));

  assert.ok(result.riskAssessment.factors.includes("critical_blocker"));
});

test("AssessmentService detects high blocker", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "data inconsistency", severity: "high" }],
  }));

  assert.ok(result.riskAssessment.factors.includes("high_blocker"));
});

test("AssessmentService flags multiple blocker severities", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [
      { description: "critical issue", severity: "critical" },
      { description: "high issue", severity: "high" },
    ],
  }));

  assert.ok(result.riskAssessment.factors.includes("critical_blocker"));
  assert.ok(result.riskAssessment.factors.includes("high_blocker"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Routing Decision Tests
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService sets single-step workflow for trivial complexity", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: [],
    blockers: [],
  }));

  assert.equal(result.routingDecision.workflow, "single-step");
});

test("AssessmentService sets multi-step workflow for non-trivial complexity", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: ["file1.ts", "file2.ts"],
  }));

  assert.equal(result.routingDecision.workflow, "multi-step");
});

test("AssessmentService routing decision includes complexity and risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: ["file1.ts"],
    blockers: [],
  }));

  assert.ok(result.routingDecision.rationale.includes("complexity="));
  assert.ok(result.routingDecision.rationale.includes("risk="));
});

test("AssessmentService routing decision includes file count", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: ["file1.ts", "file2.ts", "file3.ts"],
    blockers: [],
  }));

  assert.ok(result.routingDecision.rationale.includes("files=3"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Complexity Derivation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("AssessmentService derives critical complexity from risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "critical risk", severity: "critical" }],
  }));

  assert.equal(result.complexity, "critical");
});

test("AssessmentService derives complex complexity from high risk", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    blockers: [{ description: "high risk", severity: "high" }],
  }));

  assert.equal(result.complexity, "complex");
});

test("AssessmentService derives moderate complexity from memory", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: [],
    relevantMemory: ["memory_entry_1"],
    blockers: [],
  }));

  assert.equal(result.complexity, "moderate");
});

test("AssessmentService derives simple complexity from file count", () => {
  const service = new AssessmentService();
  const result = service.assess(createMinimalSituation({
    fileRefs: ["file1.ts", "file2.ts"],
    blockers: [],
  }));

  assert.equal(result.complexity, "simple");
});