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

test("RiskEvaluationEngine maps threshold edges consistently", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });

  assert.equal(engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "edge-low" })).riskLevel, "low");
  assert.equal(engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "edge-medium" })).riskLevel, "medium");
  assert.equal(engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "edge-high" })).riskLevel, "high");
  assert.equal(engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "edge-critical" })).riskLevel, "critical");
});

test("medium actions include approval and validation without block", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "edge-actions-medium" }));

  assert.ok(result.actions.includes("require_approval"));
  assert.ok(result.actions.includes("proceed_with_validation"));
  assert.ok(result.actions.includes("enhanced_monitoring"));
  assert.ok(!result.actions.includes("block"));
});

test("critical risk saturates score near upper bound", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "edge-score-critical" }));

  assert.ok(result.riskScore >= 0.95);
});

test("domain overrides do not affect unrelated domains", () => {
  const engine = new RiskEvaluationEngine({
    config: createCanonicalRiskConfig(),
    domainRiskProfiles: new Map([["regulated-domain", "high" as const]]),
  });

  const result = engine.evaluate(
    createRiskRequest(createLowRiskFactors(), {
      taskId: "edge-unrelated-domain",
      domainId: "general-domain",
    }),
  );

  assert.equal(result.riskLevel, "low");
});
