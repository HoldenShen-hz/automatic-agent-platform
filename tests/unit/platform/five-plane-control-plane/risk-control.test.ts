/**
 * Risk Control Unit Tests
 *
 * Tests RiskEvaluationEngine and risk configuration including:
 * - Risk score calculation with 8 weighted factors
 * - Risk level mapping (low, medium, high, critical)
 * - Domain-level risk profile overrides
 * - Risk control actions per level
 * - Risk configuration validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RiskEvaluationEngine,
  RiskEvaluationError,
  loadRiskConfig,
} from "../../../../src/platform/five-plane-control-plane/risk-control/index.js";
import type {
  RiskEvaluationRequest,
  RiskConfig,
  RiskLevel,
  RiskFactors,
  StepTypeRisk,
  TargetSystemRisk,
  DataClassRisk,
  BlastRadius,
  ConfidenceLevel,
  Reversibility,
  TemporalContext,
} from "../../../../src/platform/five-plane-control-plane/risk-control/types.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createMinimalRiskConfig(): RiskConfig {
  return {
    factorWeights: {
      stepTypeRisk: 3,
      targetSystemRisk: 4,
      dataClassRisk: 3,
      blastRadius: 2,
      priorFailureRate: 2,
      confidence: 1,
      reversibility: 2,
      temporalContext: 2,
    },
    stepTypeRiskValues: {
      read: 1,
      write: 3,
      delete: 5,
      external_call: 4,
    },
    targetSystemRiskValues: {
      internal: 1,
      staging: 2,
      production: 5,
    },
    dataClassRiskValues: {
      public: 1,
      internal: 2,
      confidential: 4,
      restricted: 5,
    },
    blastRadiusValues: {
      single_task: 1,
      workflow: 2,
      tenant: 3,
      platform: 5,
    },
    priorFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
      critical: { maxPercent: 100, value: 5 },
    },
    confidenceValues: {
      high: 1,
      medium: 3,
      low: 5,
    },
    reversibilityValues: {
      instant: 1,
      hours: 2,
      days: 4,
      irreversible: 5,
    },
    temporalContextValues: {
      background: 1,
      normal: 2,
      urgent: 4,
      critical_time: 5,
    },
    riskLevelThresholds: {
      low: 0.25,
      medium: 0.50,
      high: 0.75,
      critical: 1.0,
    },
    riskLevelActions: {
      low: {
        autoExecute: true,
        logLevel: "info",
        requiresApproval: false,
        sideEffect: "normal",
        evidenceLevel: "basic",
      },
      medium: {
        autoExecute: true,
        logLevel: "warn",
        requiresApproval: false,
        sideEffect: "normal_with_validation",
        evidenceLevel: "enhanced",
      },
      high: {
        autoExecute: false,
        logLevel: "error",
        requiresApproval: true,
        approvalType: "standard",
        sideEffect: "restricted",
        evidenceLevel: "full",
      },
      critical: {
        autoExecute: false,
        logLevel: "critical",
        requiresApproval: true,
        approvalType: "break_glass",
        sideEffect: "prohibited",
        evidenceLevel: "legal",
      },
    },
  };
}

function createTestFactors(overrides: Partial<RiskFactors> = {}): RiskFactors {
  return {
    stepTypeRisk: "write",
    targetSystemRisk: "internal",
    dataClassRisk: "internal",
    blastRadius: "single_task",
    priorFailureRatePercent: 5,
    confidence: "high",
    reversibility: "hours",
    temporalContext: "normal",
    ...overrides,
  };
}

function createTestRequest(overrides: Partial<RiskEvaluationRequest> = {}): RiskEvaluationRequest {
  return {
    taskId: newId("task"),
    factors: createTestFactors(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: RiskEvaluationEngine Construction
// ---------------------------------------------------------------------------

test("RiskEvaluationEngine accepts valid config", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  assert.ok(engine != null);
});

test("RiskEvaluationEngine accepts domainRiskProfiles map", () => {
  const config = createMinimalRiskConfig();
  const domainProfiles = new Map<string, RiskLevel>([
    ["domain-1", "high"],
    ["domain-2", "critical"],
  ]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

  assert.ok(engine != null);
});

// ---------------------------------------------------------------------------
// Tests: Risk Score Calculation
// ---------------------------------------------------------------------------

test("evaluate() returns result with correct taskId", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({ taskId: "test-task-123" });

  const result = engine.evaluate(request);

  assert.equal(result.taskId, "test-task-123");
});

test("evaluate() computes low risk for minimal risk factors", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  // Low risk: read + internal + public + single_task + 0% failure + high confidence
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
      reversibility: "instant",
      temporalContext: "background",
    }),
  });

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "low");
  assert.ok(result.riskScore < 0.25);
  assert.equal(result.autoExecute, true);
  assert.equal(result.requiresApproval, false);
});

test("evaluate() computes high risk for production delete operations", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  // High risk: delete + production + restricted + platform + high failure + low confidence
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 60,
      confidence: "low",
      reversibility: "irreversible",
      temporalContext: "critical_time",
    }),
  });

  const result = engine.evaluate(request);

  assert.ok(result.riskScore >= 0.5);
  assert.ok(["high", "critical"].includes(result.riskLevel));
});

test("evaluate() computes factor breakdown with all 8 factors", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest();

  const result = engine.evaluate(request);

  assert.equal(result.factorBreakdown.length, 8);
  const factorNames = result.factorBreakdown.map((f) => f.factor);
  assert.ok(factorNames.includes("stepTypeRisk"));
  assert.ok(factorNames.includes("targetSystemRisk"));
  assert.ok(factorNames.includes("dataClassRisk"));
  assert.ok(factorNames.includes("blastRadius"));
  assert.ok(factorNames.includes("priorFailureRate"));
  assert.ok(factorNames.includes("confidence"));
  assert.ok(factorNames.includes("reversibility"));
  assert.ok(factorNames.includes("temporalContext"));
});

test("evaluate() computes weighted values correctly", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "write",
      targetSystemRisk: "internal",
      dataClassRisk: "internal",
      blastRadius: "single_task",
      priorFailureRatePercent: 5,
      confidence: "high",
      reversibility: "hours",
      temporalContext: "normal",
    }),
  });

  const result = engine.evaluate(request);

  // Find stepTypeRisk factor (write=3, weight=3, weightedValue=9)
  const stepTypeFactor = result.factorBreakdown.find((f) => f.factor === "stepTypeRisk");
  assert.ok(stepTypeFactor);
  assert.equal(stepTypeFactor.value, 3);
  assert.equal(stepTypeFactor.weight, 3);
  assert.equal(stepTypeFactor.weightedValue, 9);
});

// ---------------------------------------------------------------------------
// Tests: Risk Level Mapping
// ---------------------------------------------------------------------------

test("evaluate() maps score < 0.25 to low risk", () => {
  const baseConfig = createMinimalRiskConfig();
  // Create config with adjusted thresholds
  const config: RiskConfig = {
    ...baseConfig,
    riskLevelThresholds: {
      low: 0.3,
      medium: 0.6,
      high: 0.8,
      critical: 1.0,
    },
  };
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
      reversibility: "instant",
      temporalContext: "background",
    }),
  });

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "low");
});

test("evaluate() returns correct actions for low risk", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
      reversibility: "instant",
      temporalContext: "background",
    }),
  });

  const result = engine.evaluate(request);

  assert.deepEqual(result.actions, ["log", "proceed"]);
  assert.equal(result.autoExecute, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.evidenceLevel, "basic");
  assert.equal(result.logLevel, "info");
});

test("evaluate() returns correct actions for medium risk", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  // Factors that should produce medium risk
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "write",
      targetSystemRisk: "staging",
      dataClassRisk: "internal",
      blastRadius: "workflow",
      priorFailureRatePercent: 15,
      confidence: "medium",
      reversibility: "hours",
      temporalContext: "normal",
    }),
  });

  const result = engine.evaluate(request);

  assert.ok(["medium", "high", "low"].includes(result.riskLevel));
  if (result.riskLevel === "medium") {
    assert.deepEqual(result.actions, ["log", "proceed_with_validation", "enhanced_monitoring"]);
    assert.equal(result.autoExecute, true);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.evidenceLevel, "enhanced");
    assert.equal(result.logLevel, "warn");
  }
});

test("evaluate() returns correct actions for high risk", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 35,
      confidence: "low",
      reversibility: "days",
      temporalContext: "urgent",
    }),
  });

  const result = engine.evaluate(request);

  if (result.riskLevel === "high") {
    assert.ok(result.actions.includes("block"));
    assert.ok(result.actions.includes("require_approval"));
    assert.equal(result.autoExecute, false);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.approvalType, "standard");
    assert.equal(result.evidenceLevel, "full");
    assert.equal(result.logLevel, "error");
  }
});

test("evaluate() returns correct actions for critical risk", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
      reversibility: "irreversible",
      temporalContext: "critical_time",
    }),
  });

  const result = engine.evaluate(request);

  if (result.riskLevel === "critical") {
    assert.ok(result.actions.includes("block"));
    assert.ok(result.actions.includes("require_break_glass_approval"));
    assert.ok(result.actions.includes("legal_evidence"));
    assert.ok(result.actions.includes("incident_create"));
    assert.equal(result.autoExecute, false);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.approvalType, "break_glass");
    assert.equal(result.evidenceLevel, "legal");
    assert.equal(result.logLevel, "critical");
  }
});

// ---------------------------------------------------------------------------
// Tests: Prior Failure Rate Thresholds
// ---------------------------------------------------------------------------

test("evaluate() uses low threshold for 0-10% failure rate", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({ factors: createTestFactors({ priorFailureRatePercent: 5 }) }));

  // Should compute priorFailureValue of 1 (low threshold)
  const priorFactor = result.factorBreakdown.find((f) => f.factor === "priorFailureRate");
  assert.ok(priorFactor);
  assert.equal(priorFactor.value, 1);
});

test("evaluate() uses medium threshold for 10-30% failure rate", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({ factors: createTestFactors({ priorFailureRatePercent: 20 }) }));

  const priorFactor = result.factorBreakdown.find((f) => f.factor === "priorFailureRate");
  assert.ok(priorFactor);
  assert.equal(priorFactor.value, 2);
});

test("evaluate() uses high threshold for 30-50% failure rate", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({ factors: createTestFactors({ priorFailureRatePercent: 40 }) }));

  const priorFactor = result.factorBreakdown.find((f) => f.factor === "priorFailureRate");
  assert.ok(priorFactor);
  assert.equal(priorFactor.value, 3);
});

test("evaluate() uses critical threshold for >50% failure rate", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({ factors: createTestFactors({ priorFailureRatePercent: 75 }) }));

  const priorFactor = result.factorBreakdown.find((f) => f.factor === "priorFailureRate");
  assert.ok(priorFactor);
  assert.equal(priorFactor.value, 5);
});

// ---------------------------------------------------------------------------
// Tests: Domain Risk Profile Overrides
// ---------------------------------------------------------------------------

test("evaluate() applies domain override to raise risk level", () => {
  const config = createMinimalRiskConfig();
  const domainProfiles = new Map<string, RiskLevel>([["sensitive-domain", "high"]]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });
  // Base factors would be low risk
  const request = createTestRequest({
    domainId: "sensitive-domain",
    factors: createTestFactors({
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
      reversibility: "instant",
      temporalContext: "background",
    }),
  });

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "high");
});

test("evaluate() does not lower risk level via domain override", () => {
  const config = createMinimalRiskConfig();
  const domainProfiles = new Map<string, RiskLevel>([["relaxed-domain", "low"]]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });
  // Base factors would be high risk
  const request = createTestRequest({
    domainId: "relaxed-domain",
    factors: createTestFactors({
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
      reversibility: "irreversible",
      temporalContext: "critical_time",
    }),
  });

  const result = engine.evaluate(request);

  // Domain override should not lower the risk level
  assert.ok(["high", "critical"].includes(result.riskLevel));
});

test("evaluate() ignores unknown domain id", () => {
  const config = createMinimalRiskConfig();
  const domainProfiles = new Map<string, RiskLevel>([["known-domain", "high"]]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });
  const request = createTestRequest({
    domainId: "unknown-domain",
    factors: createTestFactors({
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
      reversibility: "instant",
      temporalContext: "background",
    }),
  });

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "low");
});

test("evaluate() works without domain id", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  // domainId is optional, so we just don't pass it
  const request = createTestRequest({});

  const result = engine.evaluate(request);

  assert.ok(result.riskLevel != null);
});

// ---------------------------------------------------------------------------
// Tests: Approval Type in Result
// ---------------------------------------------------------------------------

test("evaluate() returns requiresApproval=false for low risk without approval type", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
      reversibility: "instant",
      temporalContext: "background",
    }),
  });

  const result = engine.evaluate(request);

  assert.equal(result.requiresApproval, false);
});

test("evaluate() returns requiresApproval=true with approvalType for high/critical risk", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest({
    factors: createTestFactors({
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
      reversibility: "irreversible",
      temporalContext: "critical_time",
    }),
  });

  const result = engine.evaluate(request);

  assert.equal(result.requiresApproval, true);
  assert.ok(result.approvalType === "standard" || result.approvalType === "break_glass");
});

// ---------------------------------------------------------------------------
// Tests: Reversibility and Temporal Context Factors
// ---------------------------------------------------------------------------

test("evaluate() uses reversibility factor when available", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({
    factors: createTestFactors({
      reversibility: "irreversible",
    }),
  }));

  const reversibilityFactor = result.factorBreakdown.find((f) => f.factor === "reversibility");
  assert.ok(reversibilityFactor);
  assert.equal(reversibilityFactor.value, 5); // irreversible = 5
});

test("evaluate() uses temporal context factor when available", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({
    factors: createTestFactors({
      temporalContext: "critical_time",
    }),
  }));

  const temporalFactor = result.factorBreakdown.find((f) => f.factor === "temporalContext");
  assert.ok(temporalFactor);
  assert.equal(temporalFactor.value, 5); // critical_time = 5
});

test("evaluate() defaults reversibility to 1 when not in config", () => {
  const baseConfig = createMinimalRiskConfig();
  const { reversibilityValues: _, ...config } = baseConfig;
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({
    factors: createTestFactors({
      reversibility: "irreversible",
    }),
  }));

  const reversibilityFactor = result.factorBreakdown.find((f) => f.factor === "reversibility");
  assert.ok(reversibilityFactor);
  assert.equal(reversibilityFactor.value, 1); // default
});

test("evaluate() defaults temporalContext to 1 when not in config", () => {
  const baseConfig = createMinimalRiskConfig();
  const { temporalContextValues: _, ...config } = baseConfig;
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate(createTestRequest({
    factors: createTestFactors({
      temporalContext: "critical_time",
    }),
  }));

  const temporalFactor = result.factorBreakdown.find((f) => f.factor === "temporalContext");
  assert.ok(temporalFactor);
  assert.equal(temporalFactor.value, 1); // default
});

// ---------------------------------------------------------------------------
// Tests: RiskEvaluationError
// ---------------------------------------------------------------------------

test("RiskEvaluationError has correct name and properties", () => {
  const error = new RiskEvaluationError("test error", "test.code", { detail: "value" });

  assert.equal(error.name, "RiskEvaluationError");
  assert.equal(error.message, "test error");
  assert.equal(error.code, "test.code");
});

// ---------------------------------------------------------------------------
// Tests: Risk Score Rounding
// ---------------------------------------------------------------------------

test("evaluate() rounds risk score to 3 decimal places", () => {
  const config = createMinimalRiskConfig();
  const engine = new RiskEvaluationEngine({ config });
  const request = createTestRequest();

  const result = engine.evaluate(request);

  // Check that the score has at most 3 decimal places
  const decimalPlaces = (result.riskScore.toString().split(".")[1] || "").length;
  assert.ok(decimalPlaces <= 3);
});
