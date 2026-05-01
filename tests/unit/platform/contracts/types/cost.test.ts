/**
 * Unit tests for Cost Estimation Contract Types
 *
 * @see src/platform/contracts/types/cost.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  type CostEstimate,
  type CostEstimationConfig,
  type CostEstimationServicePort,
} from "../../../../../src/platform/contracts/types/cost.js";

// ---------------------------------------------------------------------------
// CostEstimate type tests
// ---------------------------------------------------------------------------

test("CostEstimate accepts valid estimatedCostUsd", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };
  assert.equal(estimate.estimatedCostUsd, 0.05);
});

test("CostEstimate accepts all confidence levels", () => {
  const confidences: CostEstimate["confidence"][] = ["high", "medium", "low", "default"];
  for (const confidence of confidences) {
    const estimate: CostEstimate = {
      estimatedCostUsd: 0.01,
      confidence,
      sampleCount: 10,
      divisionId: null,
      basedOn: "default",
    };
    assert.equal(estimate.confidence, confidence);
  }
});

test("CostEstimate accepts all basedOn values", () => {
  const basedOnValues: CostEstimate["basedOn"][] = ["division_avg", "global_avg", "default"];
  for (const basedOn of basedOnValues) {
    const estimate: CostEstimate = {
      estimatedCostUsd: 0.01,
      confidence: "default",
      sampleCount: 5,
      divisionId: basedOn === "division_avg" ? "div_123" : null,
      basedOn,
    };
    assert.equal(estimate.basedOn, basedOn);
  }
});

test("CostEstimate accepts string divisionId", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.10,
    confidence: "high",
    sampleCount: 100,
    divisionId: "div_acme_001",
    basedOn: "division_avg",
  };
  assert.equal(estimate.divisionId, "div_acme_001");
});

test("CostEstimate accepts null divisionId for global estimate", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.05,
    confidence: "medium",
    sampleCount: 20,
    divisionId: null,
    basedOn: "global_avg",
  };
  assert.equal(estimate.divisionId, null);
});

test("CostEstimate properties are readonly", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 1.0,
    confidence: "high",
    sampleCount: 50,
    divisionId: "div_readonly",
    basedOn: "division_avg",
  };
  // Verify readonly - should not be able to reassign (compile-time check via TypeScript)
  // At runtime, we just verify structure
  assert.equal(estimate.estimatedCostUsd, 1.0);
});

// ---------------------------------------------------------------------------
// CostEstimationConfig type tests
// ---------------------------------------------------------------------------

test("CostEstimationConfig accepts all optional thresholds", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 30,
    mediumConfidenceThreshold: 10,
    defaultCostUsd: 0.10,
  };
  assert.equal(config.highConfidenceThreshold, 30);
  assert.equal(config.mediumConfidenceThreshold, 10);
  assert.equal(config.defaultCostUsd, 0.10);
});

test("CostEstimationConfig accepts partial configuration", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 25,
  };
  assert.equal(config.highConfidenceThreshold, 25);
  assert.strictEqual(config.mediumConfidenceThreshold, undefined);
  assert.strictEqual(config.defaultCostUsd, undefined);
});

test("CostEstimationConfig accepts empty object", () => {
  const config: CostEstimationConfig = {};
  assert.strictEqual(config.highConfidenceThreshold, undefined);
});

test("CostEstimationConfig default values are not specified (undefined)", () => {
  const config: CostEstimationConfig = {};
  // These are implementation defaults, not type defaults
  assert.strictEqual(config.highConfidenceThreshold, undefined);
  assert.strictEqual(config.mediumConfidenceThreshold, undefined);
  assert.strictEqual(config.defaultCostUsd, undefined);
});

// ---------------------------------------------------------------------------
// CostEstimationServicePort interface tests
// ---------------------------------------------------------------------------

test("CostEstimationServicePort requires estimate method", () => {
  const port: CostEstimationServicePort = {
    estimate: (_divisionId?: string | null) => ({
      estimatedCostUsd: 0.05,
      confidence: "default",
      sampleCount: 0,
      divisionId: null,
      basedOn: "default",
    }),
  };
  assert.ok(typeof port.estimate === "function");
});

test("CostEstimationServicePort.estimate accepts null divisionId", () => {
  const port: CostEstimationServicePort = {
    estimate: (divisionId?: string | null) => ({
      estimatedCostUsd: 0.05,
      confidence: divisionId ? "high" : "default",
      sampleCount: divisionId ? 50 : 0,
      divisionId,
      basedOn: divisionId ? "division_avg" : "default",
    }),
  };
  const result = port.estimate(null);
  assert.equal(result.divisionId, null);
  assert.equal(result.basedOn, "default");
});

test("CostEstimationServicePort.estimate accepts string divisionId", () => {
  const port: CostEstimationServicePort = {
    estimate: (divisionId?: string | null) => ({
      estimatedCostUsd: 0.10,
      confidence: "high",
      sampleCount: 100,
      divisionId: divisionId ?? null,
      basedOn: "division_avg",
    }),
  };
  const result = port.estimate("div_test_123");
  assert.equal(result.divisionId, "div_test_123");
  assert.equal(result.basedOn, "division_avg");
});

test("CostEstimationServicePort.estimate accepts undefined divisionId", () => {
  const port: CostEstimationServicePort = {
    estimate: (divisionId?: string | null) => ({
      estimatedCostUsd: 0.05,
      confidence: "default",
      sampleCount: 0,
      divisionId: divisionId ?? null,
      basedOn: "default",
    }),
  };
  const result = port.estimate(undefined);
  assert.equal(result.divisionId, null);
});

test("CostEstimationServicePort.estimate returns CostEstimate structure", () => {
  const port: CostEstimationServicePort = {
    estimate: () => ({
      estimatedCostUsd: 0.25,
      confidence: "medium",
      sampleCount: 15,
      divisionId: "div_struct_test",
      basedOn: "division_avg",
    }),
  };
  const result = port.estimate("div_struct_test");
  assert.ok(typeof result.estimatedCostUsd === "number");
  assert.ok(typeof result.confidence === "string");
  assert.ok(typeof result.sampleCount === "number");
  assert.ok(result.divisionId === null || typeof result.divisionId === "string");
  assert.ok(["division_avg", "global_avg", "default"].includes(result.basedOn));
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("CostEstimate supports zero sample count", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };
  assert.equal(estimate.sampleCount, 0);
});

test("CostEstimate supports zero cost", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };
  assert.equal(estimate.estimatedCostUsd, 0);
});

test("CostEstimate supports large cost values", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 10000.50,
    confidence: "high",
    sampleCount: 1000,
    divisionId: "div_large",
    basedOn: "division_avg",
  };
  assert.equal(estimate.estimatedCostUsd, 10000.50);
});

test("CostEstimationConfig thresholds can be equal", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 20,
    mediumConfidenceThreshold: 20,
  };
  assert.equal(config.highConfidenceThreshold, config.mediumConfidenceThreshold);
});
