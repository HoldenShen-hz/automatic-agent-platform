import assert from "node:assert/strict";
import test from "node:test";

import type {
  CostEstimate,
  CostEstimationConfig,
} from "../../../../src/scale-ecosystem/marketplace/cost-estimation-service.js";

test("CostEstimate structure is correct", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.25,
    confidence: "high",
    sampleCount: 50,
    divisionId: "division_abc",
    basedOn: "division_avg",
  };

  assert.equal(estimate.estimatedCostUsd, 0.25);
  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.sampleCount, 50);
  assert.equal(estimate.divisionId, "division_abc");
  assert.equal(estimate.basedOn, "division_avg");
});

test("CostEstimate confidence accepts all valid values", () => {
  const confidences: CostEstimate["confidence"][] = ["high", "medium", "low", "default"];

  for (const confidence of confidences) {
    const estimate: CostEstimate = {
      estimatedCostUsd: 0.05,
      confidence,
      sampleCount: 10,
      divisionId: null,
      basedOn: "global_avg",
    };
    assert.ok(estimate.confidence === confidence);
  }
});

test("CostEstimate basedOn accepts all valid values", () => {
  const sources: CostEstimate["basedOn"][] = ["division_avg", "global_avg", "default"];

  for (const basedOn of sources) {
    const estimate: CostEstimate = {
      estimatedCostUsd: 0.05,
      confidence: "default",
      sampleCount: 0,
      divisionId: null,
      basedOn,
    };
    assert.ok(estimate.basedOn === basedOn);
  }
});

test("CostEstimate allows null divisionId when based on global average", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.10,
    confidence: "medium",
    sampleCount: 15,
    divisionId: null,
    basedOn: "global_avg",
  };

  assert.equal(estimate.divisionId, null);
  assert.equal(estimate.basedOn, "global_avg");
});

test("CostEstimate allows zero sampleCount with default confidence", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };

  assert.equal(estimate.sampleCount, 0);
  assert.equal(estimate.confidence, "default");
});

test("CostEstimationConfig structure is correct", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 30,
    mediumConfidenceThreshold: 10,
    defaultCostUsd: 0.10,
  };

  assert.equal(config.highConfidenceThreshold, 30);
  assert.equal(config.mediumConfidenceThreshold, 10);
  assert.equal(config.defaultCostUsd, 0.10);
});

test("CostEstimationConfig allows minimal definition", () => {
  const config: CostEstimationConfig = {};
  assert.equal(config.highConfidenceThreshold, undefined);
  assert.equal(config.mediumConfidenceThreshold, undefined);
  assert.equal(config.defaultCostUsd, undefined);
});

test("CostEstimationConfig allows partial definition", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 25,
  };

  assert.equal(config.highConfidenceThreshold, 25);
  assert.equal(config.mediumConfidenceThreshold, undefined);
  assert.equal(config.defaultCostUsd, undefined);
});
