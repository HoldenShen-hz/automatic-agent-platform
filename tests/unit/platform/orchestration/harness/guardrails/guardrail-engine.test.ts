import test from "node:test";
import assert from "node:assert/strict";

import {
  GuardrailEngine,
  type GuardrailAssessment,
  type GuardrailAssessmentInput,
  type GuardrailFinding,
} from "../../../../../../src/platform/orchestration/harness/guardrails/guardrail-engine.js";
import type { HarnessToolbelt } from "../../../../../../src/platform/orchestration/harness/toolbelt-assembler.js";

function createMockToolbelt(overrides: Partial<HarnessToolbelt> = {}): HarnessToolbelt {
  return {
    allowedTools: ["read", "write"],
    grantedTools: ["read", "write"],
    blockedTools: [],
    requiredEvidence: [],
    ...overrides,
  };
}

function createAssessmentInput(overrides: Partial<GuardrailAssessmentInput> = {}): GuardrailAssessmentInput {
  return {
    toolbelt: createMockToolbelt(),
    evidenceRefs: [],
    riskScore: 5,
    maxRiskScore: 10,
    escalationThreshold: 8,
    currentStepCount: 5,
    maxSteps: 20,
    ...overrides,
  };
}

test("GuardrailEngine.assess passes when all checks pass", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput();

  const result = engine.assess(input);

  assert.equal(result.passed, true);
  assert.equal(result.requiresHuman, false);
  assert.equal(result.suggestedAction, "proceed");
  assert.equal(result.findings.length, 0);
});

test("GuardrailEngine.blocks when blocked tools requested", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({ blockedTools: ["shell", "deploy"] }),
  });

  const result = engine.assess(input);

  assert.equal(result.passed, false);
  assert.equal(result.suggestedAction, "abort");
  assert.ok(result.findings.some((f) => f.code === "harness.guardrail.blocked_tool_requested"));
});

test("GuardrailEngine.warns when required evidence missing", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({ requiredEvidence: ["evidence:log", "evidence:output"] }),
    evidenceRefs: ["evidence:log"],
  });

  const result = engine.assess(input);

  assert.equal(result.passed, true);
  assert.equal(result.requiresHuman, true);
  assert.equal(result.suggestedAction, "escalate_to_human");
  assert.ok(result.findings.some((f) => f.code === "harness.guardrail.required_evidence_missing"));
});

test("GuardrailEngine.blocks when risk exceeds maxRiskScore", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    riskScore: 11,
    maxRiskScore: 10,
  });

  const result = engine.assess(input);

  assert.equal(result.passed, false);
  assert.equal(result.suggestedAction, "abort");
  assert.ok(result.findings.some((f) => f.code === "harness.guardrail.max_risk_exceeded"));
});

test("GuardrailEngine.warns when risk reaches escalation threshold", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    riskScore: 8,
    maxRiskScore: 10,
    escalationThreshold: 8,
  });

  const result = engine.assess(input);

  assert.equal(result.passed, true);
  assert.equal(result.requiresHuman, true);
  assert.equal(result.suggestedAction, "escalate_to_human");
  assert.ok(result.findings.some((f) => f.code === "harness.guardrail.risk_requires_human"));
});

test("GuardrailEngine.blocks when step budget exhausted", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    currentStepCount: 20,
    maxSteps: 20,
  });

  const result = engine.assess(input);

  assert.equal(result.passed, false);
  assert.equal(result.suggestedAction, "abort");
  assert.ok(result.findings.some((f) => f.code === "harness.guardrail.step_budget_exhausted"));
});

test("GuardrailEngine returns multiple findings when multiple issues exist", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({
      blockedTools: ["shell"],
      requiredEvidence: ["evidence:log"],
    }),
    evidenceRefs: [],
    riskScore: 9,
    maxRiskScore: 10,
    escalationThreshold: 8,
    currentStepCount: 20,
    maxSteps: 20,
  });

  const result = engine.assess(input);

  assert.equal(result.passed, false);
  assert.ok(result.findings.length >= 3);
});

test("GuardrailEngine finding has correct layer and severity", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({ blockedTools: ["dangerous_tool"] }),
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.blocked_tool_requested");

  assert.ok(finding !== null);
  assert.equal(finding!.layer, "tool");
  assert.equal(finding!.severity, "block");
  assert.ok(finding!.message.includes("dangerous_tool"));
});

test("GuardrailEngine risk finding layer is risk", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    riskScore: 15,
    maxRiskScore: 10,
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.max_risk_exceeded");

  assert.ok(finding !== null);
  assert.equal(finding!.layer, "risk");
});

test("GuardrailEngine evidence finding layer is evidence", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({ requiredEvidence: ["evidence:output"] }),
    evidenceRefs: [],
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.required_evidence_missing");

  assert.ok(finding !== null);
  assert.equal(finding!.layer, "evidence");
});

test("GuardrailEngine budget finding layer is budget", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    currentStepCount: 50,
    maxSteps: 20,
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.step_budget_exhausted");

  assert.ok(finding !== null);
  assert.equal(finding!.layer, "budget");
});

test("GuardrailEngine escalation threshold warning does not block", () => {
  const engine = new GuardrailEngine();
  // Risk below max but at or above escalation threshold
  const input = createAssessmentInput({
    riskScore: 8,
    maxRiskScore: 10,
    escalationThreshold: 7,
  });

  const result = engine.assess(input);

  assert.equal(result.passed, true);
  assert.equal(result.suggestedAction, "escalate_to_human");
});

test("GuardrailEngine with zero risk and large budget passes cleanly", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    riskScore: 0,
    maxRiskScore: 10,
    escalationThreshold: 8,
    currentStepCount: 0,
    maxSteps: 100,
  });

  const result = engine.assess(input);

  assert.equal(result.passed, true);
  assert.equal(result.requiresHuman, false);
  assert.equal(result.suggestedAction, "proceed");
  assert.equal(result.findings.length, 0);
});

test("GuardrailEngine blocked tool message lists all blocked tools", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({ blockedTools: ["tool_a", "tool_b", "tool_c"] }),
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.blocked_tool_requested");

  assert.ok(finding !== null);
  assert.ok(finding!.message.includes("tool_a"));
  assert.ok(finding!.message.includes("tool_b"));
  assert.ok(finding!.message.includes("tool_c"));
});

test("GuardrailEngine missing evidence message shows specific evidence", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    toolbelt: createMockToolbelt({ requiredEvidence: ["evidence:audit_log"] }),
    evidenceRefs: [],
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.required_evidence_missing");

  assert.ok(finding !== null);
  assert.ok(finding!.message.includes("audit_log"));
});

test("GuardrailEngine step budget message shows current and max", () => {
  const engine = new GuardrailEngine();
  const input = createAssessmentInput({
    currentStepCount: 15,
    maxSteps: 10,
  });

  const result = engine.assess(input);
  const finding = result.findings.find((f) => f.code === "harness.guardrail.step_budget_exhausted");

  assert.ok(finding !== null);
  assert.ok(finding!.message.includes("15"));
  assert.ok(finding!.message.includes("10"));
});
