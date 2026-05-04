import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanonicalRiskConfig,
  createCriticalRiskFactors,
  createHighRiskFactors,
  createLowRiskFactors,
  createMediumRiskFactors,
  createRiskRequest,
} from "../../../helpers/risk-control.js";
import {
  RiskEvaluationEngine,
  RiskEvaluationError,
} from "../../../../src/platform/control-plane/risk-control/index.js";

test("risk-control barrel exports constructible engine and error", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const error = new RiskEvaluationError("test", "risk.test");

  assert.ok(engine instanceof RiskEvaluationEngine);
  assert.equal(error.code, "risk.test");
});

test("risk-control evaluates canonical risk bands", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });

  assert.equal(engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "barrel-low" })).riskLevel, "low");
  assert.equal(engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "barrel-medium" })).riskLevel, "medium");
  assert.equal(engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "barrel-high" })).riskLevel, "high");
  assert.equal(engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "barrel-critical" })).riskLevel, "critical");
});

test("risk-control medium and above require approval", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });

  const medium = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "barrel-medium-approval" }));
  const high = engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "barrel-high-approval" }));
  const critical = engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "barrel-critical-approval" }));

  assert.equal(medium.approvalType, "standard");
  assert.equal(high.approvalType, "standard");
  assert.equal(critical.approvalType, "break_glass");
});
