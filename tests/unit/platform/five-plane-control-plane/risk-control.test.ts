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
import { RiskEvaluationEngine, loadRiskConfig } from "../../../../src/platform/five-plane-control-plane/risk-control/index.js";

test("five-plane risk-control engine evaluates canonical risk bands", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });

  assert.equal(engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "fp-low" })).riskLevel, "low");
  assert.equal(engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "fp-medium" })).riskLevel, "medium");
  assert.equal(engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "fp-high" })).riskLevel, "high");
  assert.equal(engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "fp-critical" })).riskLevel, "critical");
});

test("five-plane risk-control medium policy requires approval and validation", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "fp-medium-actions" }));

  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "standard");
  assert.deepEqual(result.actions, ["log", "require_approval", "proceed_with_validation", "enhanced_monitoring"]);
});

test("five-plane risk-control loader remains exported", () => {
  assert.equal(typeof loadRiskConfig, "function");
});
