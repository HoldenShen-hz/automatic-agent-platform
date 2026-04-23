import test from "node:test";
import assert from "node:assert/strict";
import { GuardrailEngine, type GuardrailAssessmentInput } from "../../../../../src/platform/orchestration/harness/guardrails/guardrail-engine.js";
import type { HarnessToolbelt } from "../../../../../src/platform/orchestration/harness/toolbelt-assembler.js";

// Helper to create a minimal toolbelt
function createToolbelt(overrides: Partial<{
  allowedTools: string[];
  grantedTools: string[];
  blockedTools: string[];
  requiredEvidence: string[];
}> = {}): HarnessToolbelt {
  return {
    allowedTools: overrides.allowedTools ?? [],
    grantedTools: overrides.grantedTools ?? [],
    blockedTools: overrides.blockedTools ?? [],
    requiredEvidence: overrides.requiredEvidence ?? [],
  };
}

// Helper to create assessment input
function createInput(overrides: Partial<{
  toolbelt: HarnessToolbelt;
  evidenceRefs: string[];
  riskScore: number;
  maxRiskScore: number;
  escalationThreshold: number;
  currentStepCount: number;
  maxSteps: number;
}> = {}): GuardrailAssessmentInput {
  return {
    toolbelt: overrides.toolbelt ?? createToolbelt(),
    evidenceRefs: overrides.evidenceRefs ?? [],
    riskScore: overrides.riskScore ?? 0,
    maxRiskScore: overrides.maxRiskScore ?? 100,
    escalationThreshold: overrides.escalationThreshold ?? 80,
    currentStepCount: overrides.currentStepCount ?? 0,
    maxSteps: overrides.maxSteps ?? 10,
  };
}

test("GuardrailEngine.assess passes when no issues found", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ blockedTools: [], requiredEvidence: [] }),
    evidenceRefs: [],
    riskScore: 50,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 5,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true);
  assert.strictEqual(assessment.requiresHuman, false);
  assert.strictEqual(assessment.suggestedAction, "proceed");
  assert.deepEqual(assessment.findings, []);
});

test("GuardrailEngine.assess blocks when blocked tools requested", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ blockedTools: ["dangerous_tool"] }),
    evidenceRefs: [],
    riskScore: 0,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, false);
  assert.strictEqual(assessment.suggestedAction, "abort");
  assert.ok(assessment.findings.some((f) => f.code === "harness.guardrail.blocked_tool_requested"));
  assert.ok(assessment.findings.some((f) => f.layer === "tool"));
  assert.ok(assessment.findings.some((f) => f.severity === "block"));
});

test("GuardrailEngine.assess warns when required evidence missing", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ requiredEvidence: ["evidence_required"] }),
    evidenceRefs: [], // missing required evidence
    riskScore: 0,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true); // still passes, just warns
  assert.strictEqual(assessment.requiresHuman, true);
  assert.strictEqual(assessment.suggestedAction, "escalate_to_human");
  assert.ok(assessment.findings.some((f) => f.code === "harness.guardrail.required_evidence_missing"));
  assert.ok(assessment.findings.some((f) => f.layer === "evidence"));
  assert.ok(assessment.findings.some((f) => f.severity === "warn"));
});

test("GuardrailEngine.assess blocks when risk score exceeds max", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    riskScore: 101,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, false);
  assert.strictEqual(assessment.suggestedAction, "abort");
  assert.ok(assessment.findings.some((f) => f.code === "harness.guardrail.max_risk_exceeded"));
  assert.ok(assessment.findings.some((f) => f.layer === "risk"));
  assert.ok(assessment.findings.some((f) => f.severity === "block"));
});

test("GuardrailEngine.assess warns when risk score reaches escalation threshold", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    riskScore: 80, // equal to escalation threshold
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true);
  assert.strictEqual(assessment.requiresHuman, true);
  assert.strictEqual(assessment.suggestedAction, "escalate_to_human");
  assert.ok(assessment.findings.some((f) => f.code === "harness.guardrail.risk_requires_human"));
});

test("GuardrailEngine.assess no warning when risk below escalation threshold", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    riskScore: 79,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.requiresHuman, false);
  assert.ok(!assessment.findings.some((f) => f.code === "harness.guardrail.risk_requires_human"));
});

test("GuardrailEngine.assess blocks when step budget exhausted", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    currentStepCount: 10,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, false);
  assert.strictEqual(assessment.suggestedAction, "abort");
  assert.ok(assessment.findings.some((f) => f.code === "harness.guardrail.step_budget_exhausted"));
  assert.ok(assessment.findings.some((f) => f.layer === "budget"));
  assert.ok(assessment.findings.some((f) => f.severity === "block"));
});

test("GuardrailEngine.assess proceeds when step budget not exhausted", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    currentStepCount: 9,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true);
  assert.ok(!assessment.findings.some((f) => f.code === "harness.guardrail.step_budget_exhausted"));
});

test("GuardrailEngine.assess combines multiple findings", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ blockedTools: ["bad_tool"], requiredEvidence: ["required"] }),
    evidenceRefs: [], // missing required evidence
    riskScore: 101, // exceeds max
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 10, // exhausted budget
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, false);
  assert.strictEqual(assessment.findings.length, 4); // blocked tool, missing evidence, max risk, budget
  assert.strictEqual(assessment.suggestedAction, "abort"); // blocked wins
});

test("GuardrailEngine.assess escalation requires human only for risk and evidence warnings", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ requiredEvidence: ["required"] }),
    evidenceRefs: [], // only missing evidence, no blocking issues
    riskScore: 50,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true);
  assert.strictEqual(assessment.requiresHuman, true);
  assert.strictEqual(assessment.suggestedAction, "escalate_to_human");
});

test("GuardrailEngine.assess reports multiple blocked tools", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ blockedTools: ["tool_a", "tool_b", "tool_c"] }),
  });

  const assessment = engine.assess(input);

  const blockedFinding = assessment.findings.find((f) => f.code === "harness.guardrail.blocked_tool_requested");
  assert.ok(blockedFinding);
  assert.ok(blockedFinding.message.includes("tool_a"));
  assert.ok(blockedFinding.message.includes("tool_b"));
  assert.ok(blockedFinding.message.includes("tool_c"));
});

test("GuardrailEngine.assess reports multiple missing evidence", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ requiredEvidence: ["evidence_a", "evidence_b"] }),
    evidenceRefs: [], // none present
  });

  const assessment = engine.assess(input);

  const missingFindings = assessment.findings.filter((f) => f.code === "harness.guardrail.required_evidence_missing");
  assert.strictEqual(missingFindings.length, 2);
  assert.ok(missingFindings.some((f) => f.message.includes("evidence_a")));
  assert.ok(missingFindings.some((f) => f.message.includes("evidence_b")));
});

test("GuardrailEngine.assess returns readonly findings array", () => {
  const engine = new GuardrailEngine();
  const input = createInput();

  const assessment = engine.assess(input);

  assert.ok(Array.isArray(assessment.findings));
  assert.ok(Object.isFrozen(assessment.findings));
});

test("GuardrailEngine.assess handles empty allowedTools in toolbelt", () => {
  const engine = new GuardrailEngine();
  const input = createInput({
    toolbelt: createToolbelt({ allowedTools: [], blockedTools: [] }),
    riskScore: 0,
    maxRiskScore: 100,
    escalationThreshold: 80,
    currentStepCount: 0,
    maxSteps: 10,
  });

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true);
  assert.deepEqual(assessment.findings, []);
});

test("GuardrailEngine.assess uses default constructor without arguments", () => {
  const engine = new GuardrailEngine();
  const input = createInput();

  const assessment = engine.assess(input);

  assert.strictEqual(assessment.passed, true);
});