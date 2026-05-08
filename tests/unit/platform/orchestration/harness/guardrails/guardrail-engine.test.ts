import assert from "node:assert/strict";
import test from "node:test";

import type {
  GuardrailSeverity,
  GuardrailFinding,
  GuardrailAssessment,
  GuardrailAssessmentInput,
} from "../../../../../../src/platform/orchestration/harness/guardrails/guardrail-engine.js";
import { GuardrailEngine } from "../../../../../../src/platform/orchestration/harness/guardrails/guardrail-engine.js";

// Mock toolbelt for testing
function createMockToolbelt(overrides: {
  blockedTools?: string[];
  requiredEvidence?: string[];
} = {}): any {
  return {
    blockedTools: overrides.blockedTools ?? [],
    requiredEvidence: overrides.requiredEvidence ?? [],
    tools: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GuardrailSeverity tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailSeverity accepts info value", () => {
  const severity: GuardrailSeverity = "info";
  assert.equal(severity, "info");
});

test("GuardrailSeverity accepts warn value", () => {
  const severity: GuardrailSeverity = "warn";
  assert.equal(severity, "warn");
});

test("GuardrailSeverity accepts block value", () => {
  const severity: GuardrailSeverity = "block";
  assert.equal(severity, "block");
});

// ─────────────────────────────────────────────────────────────────────────────
// GuardrailFinding structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailFinding with policy layer", () => {
  const finding: GuardrailFinding = {
    layer: "policy",
    severity: "info",
    code: "test.code",
    message: "Test message",
  };
  assert.equal(finding.layer, "policy");
  assert.equal(finding.severity, "info");
});

test("GuardrailFinding with risk layer", () => {
  const finding: GuardrailFinding = {
    layer: "risk",
    severity: "warn",
    code: "risk.code",
    message: "Risk warning",
  };
  assert.equal(finding.layer, "risk");
  assert.equal(finding.severity, "warn");
});

test("GuardrailFinding with tool layer", () => {
  const finding: GuardrailFinding = {
    layer: "tool",
    severity: "block",
    code: "tool.blocked",
    message: "Tool blocked",
  };
  assert.equal(finding.layer, "tool");
  assert.equal(finding.severity, "block");
});

test("GuardrailFinding with evidence layer", () => {
  const finding: GuardrailFinding = {
    layer: "evidence",
    severity: "warn",
    code: "evidence.missing",
    message: "Evidence missing",
  };
  assert.equal(finding.layer, "evidence");
});

test("GuardrailFinding with budget layer", () => {
  const finding: GuardrailFinding = {
    layer: "budget",
    severity: "block",
    code: "budget.exceeded",
    message: "Budget exceeded",
  };
  assert.equal(finding.layer, "budget");
});

// ─────────────────────────────────────────────────────────────────────────────
// GuardrailAssessment structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailAssessment passed structure", () => {
  const assessment: GuardrailAssessment = {
    passed: true,
    requiresHuman: false,
    suggestedAction: "proceed",
    findings: [],
  };
  assert.ok(assessment.passed);
  assert.ok(!assessment.requiresHuman);
  assert.equal(assessment.suggestedAction, "proceed");
});

test("GuardrailAssessment with findings", () => {
  const assessment: GuardrailAssessment = {
    passed: false,
    requiresHuman: true,
    suggestedAction: "escalate_to_human",
    findings: [
      { layer: "risk", severity: "warn", code: "risk.high", message: "High risk detected" },
    ],
  };
  assert.ok(!assessment.passed);
  assert.ok(assessment.requiresHuman);
  assert.equal(assessment.findings.length, 1);
});

test("GuardrailAssessment suggestedAction abort", () => {
  const assessment: GuardrailAssessment = {
    passed: false,
    requiresHuman: false,
    suggestedAction: "abort",
    findings: [
      { layer: "tool", severity: "block", code: "blocked", message: "Blocked" },
    ],
  };
  assert.equal(assessment.suggestedAction, "abort");
});

test("GuardrailAssessment suggestedAction retry_same_plan", () => {
  const assessment: GuardrailAssessment = {
    passed: true,
    requiresHuman: false,
    suggestedAction: "retry_same_plan",
    findings: [],
  };
  assert.equal(assessment.suggestedAction, "retry_same_plan");
});

// ─────────────────────────────────────────────────────────────────────────────
// GuardrailAssessmentInput structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailAssessmentInput structure", () => {
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt(),
    evidenceRefs: [],
    riskScore: 10,
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };
  assert.equal(input.riskScore, 10);
  assert.equal(input.maxRiskScore, 50);
  assert.equal(input.currentStepCount, 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// GuardrailEngine.assess() tests
// ─────────────────────────────────────────────────────────────────────────────

test("GuardrailEngine assess passes with no issues", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt(),
    evidenceRefs: ["evidence1"],
    riskScore: 10,
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(result.passed);
  assert.ok(!result.requiresHuman);
  assert.equal(result.suggestedAction, "proceed");
  assert.equal(result.findings.length, 0);
});

test("GuardrailEngine assess blocks when blocked tools requested", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt({ blockedTools: ["delete_file", "format_disk"] }),
    evidenceRefs: [],
    riskScore: 10,
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(!result.passed);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]!.layer, "tool");
  assert.equal(result.findings[0]!.severity, "block");
  assert.equal(result.findings[0]!.code, "harness.guardrail.blocked_tool_requested");
});

test("GuardrailEngine assess warns when required evidence missing", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt({ requiredEvidence: ["audit_log", "approval_record"] }),
    evidenceRefs: ["audit_log"], // missing approval_record
    riskScore: 10,
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(result.passed); // still passes but with warning
  assert.ok(result.requiresHuman);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]!.layer, "evidence");
  assert.equal(result.findings[0]!.severity, "warn");
});

test("GuardrailEngine assess blocks when risk exceeds max", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt(),
    evidenceRefs: [],
    riskScore: 75,
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(!result.passed);
  assert.ok(!result.requiresHuman);
  assert.equal(result.suggestedAction, "abort");
  const riskFinding = result.findings.find((f) => f.layer === "risk");
  assert.ok(riskFinding);
  assert.equal(riskFinding!.code, "harness.guardrail.max_risk_exceeded");
});

test("GuardrailEngine assess warns and requires human when risk reaches threshold", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt(),
    evidenceRefs: [],
    riskScore: 35, // between escalationThreshold(30) and maxRiskScore(50)
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(result.passed); // not blocked but warning
  assert.ok(result.requiresHuman);
  assert.equal(result.suggestedAction, "escalate_to_human");
});

test("GuardrailEngine assess blocks when step budget exhausted", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt(),
    evidenceRefs: [],
    riskScore: 10,
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 100, // equals maxSteps
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(!result.passed);
  const budgetFinding = result.findings.find((f) => f.layer === "budget");
  assert.ok(budgetFinding);
  assert.equal(budgetFinding!.severity, "block");
  assert.equal(budgetFinding!.code, "harness.guardrail.step_budget_exhausted");
});

test("GuardrailEngine assess combines multiple findings", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt({
      blockedTools: ["dangerous_tool"],
      requiredEvidence: ["missing_evidence"],
    }),
    evidenceRefs: [],
    riskScore: 75, // exceeds max
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 100, // at budget
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(!result.passed);
  assert.ok(result.findings.length >= 3); // blocked tool + missing evidence + risk exceeded + budget
});

test("GuardrailEngine assess requires human when evidence and risk warnings combined", () => {
  const engine = new GuardrailEngine();
  const input: GuardrailAssessmentInput = {
    toolbelt: createMockToolbelt({ requiredEvidence: ["missing"] }),
    evidenceRefs: [],
    riskScore: 35, // at escalation threshold
    maxRiskScore: 50,
    escalationThreshold: 30,
    currentStepCount: 5,
    maxSteps: 100,
  };

  const result = engine.assess(input);

  assert.ok(result.passed);
  assert.ok(result.requiresHuman); // combination of evidence warn + risk warn
  assert.equal(result.suggestedAction, "escalate_to_human");
});
