import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanonicalRiskConfig,
  createCriticalRiskFactors,
  createHighRiskFactors,
  createLowRiskFactors,
  createMediumRiskFactors,
  createRiskRequest,
} from "../../../../helpers/risk-control.js";
import { RiskEvaluationEngine } from "../../../../../src/platform/control-plane/risk-control/risk-evaluation-engine.js";

test("low risk does not require approval", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "approval-low" }));

  assert.equal(result.requiresApproval, false);
  assert.equal(result.approvalType, undefined);
});

test("medium risk requires standard approval", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "approval-medium" }));

  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "standard");
});

test("high risk requires standard approval", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "approval-high" }));

  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "standard");
});

test("critical risk requires break-glass approval", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "approval-critical" }));

  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "break_glass");
});

test("approval type is only present on approval-required results", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });

  const low = engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "approval-guard-low" }));
  const medium = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "approval-guard-medium" }));

  assert.equal(low.requiresApproval, false);
  assert.equal(low.approvalType, undefined);

  if (medium.requiresApproval) {
    assert.equal(medium.approvalType, "standard");
  } else {
    assert.fail("medium risk should require approval");
  }
});
