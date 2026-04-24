import test from "node:test";
import assert from "node:assert/strict";

import { AssessmentService } from "../../../../../src/platform/orchestration/oapeflir/assessment-service.js";

function createMinimalSituation(overrides: Partial<{
  taskId: string;
  objective: string;
  confidence: number;
  blockers: Array<{ severity: "critical" | "high" | "medium" | "low"; description: string }>;
  availableTools: string[];
  fileCount: number;
  fileRefs: string[];
  relevantMemory: string[];
  approvalPending: number;
}> = {}) {
  const taskId = overrides.taskId ?? "task-test";
  const objective = overrides.objective ?? "Test task";
  return {
    taskId,
    timestamp: Date.now(),
    objective,
    currentPhase: "planning" as const,
    userIntent: {
      raw: objective,
      normalized: objective,
      confidence: overrides.confidence ?? 0.85,
    },
    blockers: overrides.blockers ?? [],
    codebaseSnapshot: {
      rootPath: "/test",
      fileCount: overrides.fileCount ?? 5,
      relevantFiles: [],
    },
    environmentContext: {
      nodeVersion: "22.0.0",
      platform: "darwin",
      workingDirectory: "/test",
      availableTools: overrides.availableTools ?? ["read", "write", "grep"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
      lastExecutionOutcome: undefined,
    },
    relevantMemory: overrides.relevantMemory ?? [],
    fileRefs: overrides.fileRefs ?? [],
    metrics: overrides.approvalPending !== undefined ? { approvalPending: overrides.approvalPending } : {},
  };
}

test("AssessmentService assessment structure is valid for minimal input", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation());

  assert.ok(typeof assessment.taskId === "string");
  assert.ok(typeof assessment.timestamp === "number");
  assert.ok(assessment.situationRef.startsWith("assessment:task-test:"));
  assert.equal(assessment.phase, "pre-execution");
});

test("AssessmentService critical severity blocker triggers critical risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "critical", description: "database unavailable" }],
  }));

  assert.equal(assessment.risk, "critical");
  assert.equal(assessment.approvalPolicy.required, true);
  assert.equal(assessment.approvalPolicy.level, "admin");
  assert.ok(assessment.riskAssessment.factors.includes("critical_blocker"));
});

test("AssessmentService high severity blocker triggers high risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "high", description: "auth service down" }],
  }));

  assert.equal(assessment.risk, "high");
  assert.equal(assessment.approvalPolicy.required, true);
  assert.ok(assessment.riskAssessment.factors.includes("high_blocker"));
});

test("AssessmentService approval pending triggers high risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ approvalPending: 3 }));

  assert.equal(assessment.risk, "high");
  assert.ok(assessment.riskAssessment.factors.includes("approval_pending"));
});

test("AssessmentService low intent confidence triggers risk factor", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ confidence: 0.4 }));

  assert.ok(assessment.riskAssessment.factors.includes("low_intent_confidence"));
});

test("AssessmentService high-risk tooling triggers risk factor for apply_patch", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    availableTools: ["read", "apply_patch"],
  }));

  assert.ok(assessment.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService high-risk tooling triggers risk factor for shell", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    availableTools: ["shell", "read"],
  }));

  assert.ok(assessment.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService high-risk tooling triggers risk factor for deploy", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    availableTools: ["deploy", "read"],
  }));

  assert.ok(assessment.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService custom high risk tools option works", () => {
  const service = new AssessmentService({
    highRiskTools: ["custom_dangerous_tool"],
  });
  const assessment = service.assess(createMinimalSituation({
    availableTools: ["custom_dangerous_tool"],
  }));

  assert.ok(assessment.riskAssessment.factors.includes("high_risk_tooling"));
});

test("AssessmentService trivial complexity derives from empty codebase", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 0 }));

  assert.equal(assessment.complexity, "trivial");
  assert.equal(assessment.routingDecision.workflow, "single-step");
});

test("AssessmentService simple complexity derives from 2 files", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 2 }));

  assert.equal(assessment.complexity, "simple");
});

test("AssessmentService moderate complexity derives from 4 files", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 4 }));

  assert.equal(assessment.complexity, "moderate");
});

test("AssessmentService complex complexity derives from 10 files", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 10 }));

  assert.equal(assessment.complexity, "complex");
});

test("AssessmentService critical complexity derives from 20 files", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 20 }));

  assert.equal(assessment.complexity, "critical");
});

test("AssessmentService critical complexity derives from 3+ blockers regardless of file count", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    fileCount: 1,
    blockers: [
      { severity: "medium", description: "blocker 1" },
      { severity: "medium", description: "blocker 2" },
      { severity: "low", description: "blocker 3" },
    ],
  }));

  assert.equal(assessment.complexity, "critical");
});

test("AssessmentService execution mode is manual for critical risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "critical", description: "critical" }],
  }));

  assert.equal(assessment.executionMode, "manual");
});

test("AssessmentService execution mode is supervised for high risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "high", description: "high" }],
  }));

  assert.equal(assessment.executionMode, "supervised");
});

test("AssessmentService execution mode is auto for low risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    fileCount: 0,
    blockers: [],
  }));

  assert.equal(assessment.executionMode, "auto");
});

test("AssessmentService resource allocation uses large model for critical complexity", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 20 }));

  assert.equal(assessment.resourceAllocation.modelClass, "large");
  assert.equal(assessment.resourceAllocation.maxTokens, 12000);
  assert.equal(assessment.resourceAllocation.timeoutMs, 180000);
});

test("AssessmentService resource allocation uses large model for complex complexity", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 12 }));

  assert.equal(assessment.resourceAllocation.modelClass, "large");
  assert.equal(assessment.resourceAllocation.maxTokens, 8000);
  assert.equal(assessment.resourceAllocation.timeoutMs, 120000);
});

test("AssessmentService resource allocation uses medium model for moderate complexity", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 5 }));

  assert.equal(assessment.resourceAllocation.modelClass, "medium");
  assert.equal(assessment.resourceAllocation.maxTokens, 5000);
  assert.equal(assessment.resourceAllocation.timeoutMs, 60000);
});

test("AssessmentService resource allocation uses small model for trivial/simple complexity", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 1 }));

  assert.equal(assessment.resourceAllocation.modelClass, "small");
  assert.equal(assessment.resourceAllocation.maxTokens, 3000);
  assert.equal(assessment.resourceAllocation.timeoutMs, 60000);
});

test("AssessmentService suggested actions include resolve for blockers", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "high", description: "auth error" }],
  }));

  assert.ok(assessment.suggestedActions.some(a => a.startsWith("resolve:auth error")));
});

test("AssessmentService suggested actions include request_approval when required", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "critical", description: "critical" }],
  }));

  assert.ok(assessment.suggestedActions.includes("request_approval"));
});

test("AssessmentService suggested actions include produce_explicit_plan for non-trivial", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 5 }));

  assert.ok(assessment.suggestedActions.includes("produce_explicit_plan"));
});

test("AssessmentService suggested actions exclude produce_explicit_plan for trivial", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({ fileCount: 0 }));

  assert.ok(!assessment.suggestedActions.includes("produce_explicit_plan"));
});

test("AssessmentService routingDecision contains division coding", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation());

  assert.equal(assessment.routingDecision.division, "coding");
});

test("AssessmentService routingDecision rationale contains complexity and risk", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    fileCount: 5,
    blockers: [{ severity: "high", description: "blocker" }],
  }));

  assert.ok(assessment.routingDecision.rationale.includes("complexity="));
  assert.ok(assessment.routingDecision.rationale.includes("risk="));
});

test("AssessmentService combines multiple risk factors correctly", () => {
  const service = new AssessmentService();
  const assessment = service.assess(createMinimalSituation({
    blockers: [{ severity: "high", description: "blocker" }],
    approvalPending: 2,
    confidence: 0.5,
    availableTools: ["apply_patch"],
  }));

  assert.ok(assessment.riskAssessment.factors.length >= 3);
  assert.equal(assessment.risk, "high");
});
