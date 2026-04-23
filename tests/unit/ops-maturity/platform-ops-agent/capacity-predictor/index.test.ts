/**
 * Unit tests for capacity-predictor module
 *
 * @see src/ops-maturity/platform-ops-agent/capacity-predictor/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OpsCapacityPredictorService,
  predictOpsCapacityRisk,
  predictCapacityRiskWithHistory,
  estimateCapacityHeadroom,
  calculateCapacityPrediction,
  projectFutureCapacity,
  type CapacitySample,
  type CapacityThreshold,
  type CapacityPrediction,
  type CapacityRiskAssessment,
} from "../../../../../src/ops-maturity/platform-ops-agent/capacity-predictor/index.js";

function createSample(overrides: Partial<CapacitySample> = {}): CapacitySample {
  return {
    timestamp: "2026-04-22T00:00:00.000Z",
    load: 50,
    capacity: 100,
    ...overrides,
  };
}

test.describe("predictOpsCapacityRisk", () => {
  test("returns low when projected/current ratio < 1.2", () => {
    assert.equal(predictOpsCapacityRisk(100, 100), "low");
    assert.equal(predictOpsCapacityRisk(100, 110), "low");
    assert.equal(predictOpsCapacityRisk(100, 119), "low");
  });

  test("returns medium when ratio >= 1.2 and < 2", () => {
    assert.equal(predictOpsCapacityRisk(100, 120), "medium");
    assert.equal(predictOpsCapacityRisk(100, 150), "medium");
    assert.equal(predictOpsCapacityRisk(100, 199), "medium");
  });

  test("returns high when ratio >= 2", () => {
    assert.equal(predictOpsCapacityRisk(50, 100), "high");
    assert.equal(predictOpsCapacityRisk(50, 150), "high");
    assert.equal(predictOpsCapacityRisk(100, 200), "high");
  });

  test("handles zero current load", () => {
    assert.equal(predictOpsCapacityRisk(0, 0), "low");
    assert.equal(predictOpsCapacityRisk(0, 100), "high");
  });

  test("handles large ratios", () => {
    assert.equal(predictOpsCapacityRisk(1, 1000), "high");
    assert.equal(predictOpsCapacityRisk(10, 25), "high");
  });

  test("handles boundary ratio at 1.2", () => {
    assert.equal(predictOpsCapacityRisk(100, 119.99), "low");
    assert.equal(predictOpsCapacityRisk(100, 120), "medium");
  });

  test("handles boundary ratio at 2", () => {
    assert.equal(predictOpsCapacityRisk(100, 199.99), "medium");
    assert.equal(predictOpsCapacityRisk(100, 200), "high");
  });

  test("accepts custom thresholds", () => {
    const thresholds: CapacityThreshold = {
      warningPercent: 50,
      criticalPercent: 80,
      maxLoadPercent: 95,
    };
    // Threshold parameter is accepted but ratio is still the key factor
    assert.equal(predictOpsCapacityRisk(100, 100, thresholds), "low");
  });
});

test.describe("estimateCapacityHeadroom", () => {
  test("returns correct percentage for typical case", () => {
    // ((100 - 20) / 100) * 100 = 80
    assert.equal(estimateCapacityHeadroom(20, 100), 80);
  });

  test("returns 0 when projected load is zero", () => {
    assert.equal(estimateCapacityHeadroom(20, 0), 0);
  });

  test("returns 0 when projected load is negative", () => {
    assert.equal(estimateCapacityHeadroom(20, -10), 0);
  });

  test("returns 0 when current and projected are equal", () => {
    assert.equal(estimateCapacityHeadroom(50, 50), 0);
  });

  test("handles current load greater than projected", () => {
    // ((100 - 30) / 100) * 100 = 70
    assert.equal(estimateCapacityHeadroom(30, 100), 70);
  });

  test("handles zero current load", () => {
    // ((100 - 0) / 100) * 100 = 100
    assert.equal(estimateCapacityHeadroom(0, 100), 100);
  });
});

test.describe("projectFutureCapacity", () => {
  test("returns array of specified length", () => {
    const projections = projectFutureCapacity(100, 10, 3);
    assert.equal(projections.length, 3);
  });

  test("calculates single period growth correctly", () => {
    const projections = projectFutureCapacity(100, 10, 1);
    // 100 * (1 + 10/100) = 110
    assert.equal(projections[0], 110);
  });

  test("compounds growth across periods", () => {
    const projections = projectFutureCapacity(100, 10, 2);
    // Period 1: 100 * 1.1 = 110
    // Period 2: 110 * 1.1 = 121
    assert.equal(projections[0], 110);
    assert.equal(projections[1], 121);
  });

  test("handles zero growth rate", () => {
    const projections = projectFutureCapacity(100, 0, 3);
    assert.equal(projections[0], 100);
    assert.equal(projections[1], 100);
    assert.equal(projections[2], 100);
  });

  test("handles negative growth rate (shrinkage)", () => {
    const projections = projectFutureCapacity(100, -10, 2);
    // Period 1: 100 * 0.9 = 90
    // Period 2: 90 * 0.9 = 81
    assert.equal(projections[0], 90);
    assert.equal(projections[1], 81);
  });

  test("handles zero periods", () => {
    const projections = projectFutureCapacity(100, 10, 0);
    assert.equal(projections.length, 0);
  });

  test("handles single period", () => {
    const projections = projectFutureCapacity(100, 10, 1);
    assert.equal(projections.length, 1);
    assert.equal(projections[0], 110);
  });

  test("handles large growth rate", () => {
    const projections = projectFutureCapacity(100, 100, 1);
    // 100 * (1 + 100/100) = 200
    assert.equal(projections[0], 200);
  });

  test("handles fractional growth rate", () => {
    const projections = projectFutureCapacity(100, 5.5, 1);
    // 100 * (1 + 5.5/100) = 105.5
    assert.equal(projections[0], 105.5);
  });
});

test.describe("calculateCapacityPrediction", () => {
  test("returns complete prediction structure", () => {
    const prediction = calculateCapacityPrediction(50, 75, 100, 120);
    assert.equal(prediction.currentLoad, 50);
    assert.equal(prediction.projectedLoad, 75);
    assert.equal(prediction.riskLevel, "low");
    assert.ok(typeof prediction.headroomPercent === "number");
    assert.ok(typeof prediction.utilizationPercent === "number");
    assert.ok(typeof prediction.projectedUtilizationPercent === "number");
    assert.ok(typeof prediction.confidencePercent === "number");
    assert.ok(typeof prediction.recommendation === "string");
  });

  test("calculates utilization correctly", () => {
    const prediction = calculateCapacityPrediction(50, 75, 100, 120);
    assert.equal(prediction.utilizationPercent, 50); // 50/100 * 100
    assert.equal(prediction.projectedUtilizationPercent, 62.5); // 75/120 * 100
  });

  test("calculates headroom correctly", () => {
    const prediction = calculateCapacityPrediction(50, 75, 100, 120);
    // (100 - 50) / 100 * 100 = 50
    assert.equal(prediction.headroomPercent, 50);
  });

  test("handles zero capacity", () => {
    const prediction = calculateCapacityPrediction(50, 75, 0, 0);
    assert.equal(prediction.utilizationPercent, 0);
    assert.equal(prediction.projectedUtilizationPercent, 0);
    assert.equal(prediction.headroomPercent, 0);
  });

  test("confidence increases with sample count", () => {
    const noSamples = calculateCapacityPrediction(50, 75, 100, 120);
    assert.equal(noSamples.confidencePercent, 50);

    const threeSamples = calculateCapacityPrediction(50, 75, 100, 120, [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 40 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 50 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 55 }),
    ]);
    assert.equal(threeSamples.confidencePercent, 60);

    const fiveSamples = calculateCapacityPrediction(50, 75, 100, 120, [
      createSample({ timestamp: "2026-04-18T00:00:00Z", load: 40 }),
      createSample({ timestamp: "2026-04-19T00:00:00Z", load: 45 }),
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 48 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 50 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 55 }),
    ]);
    assert.equal(fiveSamples.confidencePercent, 75);

    const tenSamples = calculateCapacityPrediction(50, 75, 100, 120, [
      createSample({ timestamp: "2026-04-13T00:00:00Z", load: 30 }),
      createSample({ timestamp: "2026-04-14T00:00:00Z", load: 35 }),
      createSample({ timestamp: "2026-04-15T00:00:00Z", load: 38 }),
      createSample({ timestamp: "2026-04-16T00:00:00Z", load: 40 }),
      createSample({ timestamp: "2026-04-17T00:00:00Z", load: 42 }),
      createSample({ timestamp: "2026-04-18T00:00:00Z", load: 45 }),
      createSample({ timestamp: "2026-04-19T00:00:00Z", load: 47 }),
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 48 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 50 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 55 }),
    ]);
    assert.equal(tenSamples.confidencePercent, 90);
  });

  test("returns OK recommendation when utilization is low", () => {
    const prediction = calculateCapacityPrediction(10, 15, 100, 120);
    assert.equal(prediction.recommendation, "OK: Capacity is sufficient");
  });

  test("returns WARNING when utilization exceeds warning threshold", () => {
    const prediction = calculateCapacityPrediction(75, 80, 100, 120);
    // 75% utilization - warning threshold is 70%
    assert.ok(prediction.recommendation.includes("WARNING"));
  });

  test("returns CRITICAL when utilization exceeds critical threshold", () => {
    const prediction = calculateCapacityPrediction(90, 95, 100, 120);
    // 90% utilization - critical threshold is 85%
    assert.ok(prediction.recommendation.includes("CRITICAL"));
  });

  test("returns INFO when projected utilization increases significantly", () => {
    // Current utilization: 30/100 = 30%, projected: 80/100 = 80%
    // Increase is 50% which is > 20%, so INFO
    const prediction = calculateCapacityPrediction(30, 80, 100, 100);
    assert.ok(prediction.recommendation.includes("INFO"));
    assert.ok(prediction.recommendation.includes("Monitor growth trend"));
  });

  test("handles utilization at exact warning threshold", () => {
    // Exactly at 70% should trigger WARNING
    const prediction = calculateCapacityPrediction(70, 75, 100, 120);
    assert.ok(prediction.recommendation.includes("WARNING"));
  });

  test("handles utilization at exact critical threshold", () => {
    // Exactly at 85% should trigger CRITICAL
    const prediction = calculateCapacityPrediction(85, 90, 100, 120);
    assert.ok(prediction.recommendation.includes("CRITICAL"));
  });

  test("riskLevel matches predictOpsCapacityRisk", () => {
    const prediction1 = calculateCapacityPrediction(50, 100, 100, 100);
    // Ratio 2 = high
    assert.equal(prediction1.riskLevel, "high");

    const prediction2 = calculateCapacityPrediction(50, 60, 100, 100);
    // Ratio 1.2 = medium
    assert.equal(prediction2.riskLevel, "medium");

    const prediction3 = calculateCapacityPrediction(50, 55, 100, 100);
    // Ratio 1.1 = low
    assert.equal(prediction3.riskLevel, "low");
  });

  test("handles zero current capacity", () => {
    const prediction = calculateCapacityPrediction(50, 75, 0, 100);
    assert.equal(prediction.utilizationPercent, 0);
    assert.equal(prediction.headroomPercent, 0);
  });

  test("handles projected capacity less than current", () => {
    const prediction = calculateCapacityPrediction(30, 60, 100, 80);
    // projectedUtilizationPercent = 60/80 * 100 = 75
    assert.equal(prediction.projectedUtilizationPercent, 75);
  });
});

test.describe("predictCapacityRiskWithHistory", () => {
  test("returns base risk with no samples", () => {
    const samples: CapacitySample[] = [];
    const risk = predictCapacityRiskWithHistory(50, 100, samples);
    // Ratio = 2, should be high
    assert.equal(risk, "high");
  });

  test("returns base risk with single sample (insufficient for trend)", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
    ];
    const risk = predictCapacityRiskWithHistory(50, 60, samples);
    // Base risk for ratio 1.2 is medium
    assert.equal(risk, "medium");
  });

  test("escalates risk for growing trend with high growth rate", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 30 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 40 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
    ];
    // Base risk for ratio 1.2 is medium, but growing trend with >20% growth
    // should escalate: medium -> high
    const risk = predictCapacityRiskWithHistory(50, 60, samples);
    assert.equal(risk, "high");
  });

  test("escalates low risk to medium for growing trend", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 30 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 40 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
    ];
    // Base risk for ratio ~1.05 (50->52.5) is low, growing trend with >20% growth
    // should escalate: low -> medium
    const risk = predictCapacityRiskWithHistory(50, 52.5, samples);
    assert.equal(risk, "medium");
  });

  test("de-escalates high risk for shrinking trend", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 80 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 70 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 60 }),
    ];
    // Base risk for ratio 2 is high, shrinking trend should de-escalate: high -> medium
    const risk = predictCapacityRiskWithHistory(50, 100, samples);
    assert.equal(risk, "medium");
  });

  test("returns low for shrinking trend with low base risk", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 80 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 70 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 60 }),
    ];
    // Base risk for ratio ~1.17 is low, shrinking trend keeps it low
    const risk = predictCapacityRiskWithHistory(60, 70, samples);
    assert.equal(risk, "low");
  });

  test("returns base risk for stable trend", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 50 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 51 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
    ];
    // Stable trend (growth ~0%), base risk medium
    const risk = predictCapacityRiskWithHistory(50, 60, samples);
    assert.equal(risk, "medium");
  });

  test("handles stable trend with low base risk", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 50 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 51 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 52 }),
    ];
    // Average growth rate ~2% per period, direction is stable (< 5%)
    // Base risk for ratio 60/52 = 1.15 < 1.2 = low
    const risk = predictCapacityRiskWithHistory(52, 60, samples);
    assert.equal(risk, "low");
  });

  test("analyzes growing trend with multiple samples", () => {
    const samples: CapacitySample[] = [
      createSample({ timestamp: "2026-04-18T00:00:00Z", load: 20 }),
      createSample({ timestamp: "2026-04-19T00:00:00Z", load: 30 }),
      createSample({ timestamp: "2026-04-20T00:00:00Z", load: 40 }),
      createSample({ timestamp: "2026-04-21T00:00:00Z", load: 50 }),
      createSample({ timestamp: "2026-04-22T00:00:00Z", load: 60 }),
    ];
    // Base risk: 70/60 = 1.167 < 1.2, so base is low
    // But growing with high growth rate should escalate to medium
    const risk = predictCapacityRiskWithHistory(60, 70, samples);
    assert.equal(risk, "medium");
  });
});

test.describe("OpsCapacityPredictorService", () => {
  test.describe("constructor", () => {
    test("uses default thresholds when no overrides provided", () => {
      const service = new OpsCapacityPredictorService();
      const assessment = service.assessRisk(100, 105, []);
      assert.equal(assessment.riskLevel, "low");
      assert.equal(assessment.confidencePercent, 50);
    });

    test("accepts custom thresholds", () => {
      const customThresholds: CapacityThreshold = {
        warningPercent: 60,
        criticalPercent: 75,
        maxLoadPercent: 90,
      };
      const service = new OpsCapacityPredictorService(customThresholds);
      // Risk is still calculated based on ratio, not absolute thresholds
      const assessment = service.assessRisk(100, 200, []);
      assert.equal(assessment.riskLevel, "high");
    });
  });

  test.describe("assessRisk", () => {
    test("assesses low risk with no history", () => {
      const service = new OpsCapacityPredictorService();
      const assessment = service.assessRisk(100, 105, []);

      assert.equal(assessment.riskLevel, "low");
      assert.equal(assessment.confidencePercent, 50);
      assert.equal(assessment.recommendedBufferPercent, 10);
      assert.equal(assessment.trend, null);
    });

    test("assesses high risk with growing trend signals", () => {
      const service = new OpsCapacityPredictorService();
      const assessment = service.assessRisk(100, 180, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 80 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 100 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 140 }),
      ]);

      assert.equal(assessment.riskLevel, "high");
      assert.ok(assessment.reasonCodes.includes("capacity.risk.high"));
      assert.ok(assessment.reasonCodes.includes("capacity.trend.growing"));
      assert.ok(assessment.trend);
      assert.equal(assessment.trend!.direction, "growing");
      assert.ok(assessment.recommendedBufferPercent >= 30);
    });

    test("reduces buffer for shrinking trend", () => {
      const service = new OpsCapacityPredictorService();
      const assessment = service.assessRisk(100, 210, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 200 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 150 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 100 }),
      ]);

      assert.equal(assessment.riskLevel, "medium");
      assert.equal(assessment.trend?.direction, "shrinking");
      assert.equal(assessment.recommendedBufferPercent, 15);
    });

    test("includes projected capacity exhaustion in reason codes when predicted", () => {
      const service = new OpsCapacityPredictorService();
      // Growing from 20 to 100 with capacity 100 should predict exhaustion
      const assessment = service.assessRisk(100, 200, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 20, capacity: 100 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 60, capacity: 100 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 100, capacity: 100 }),
      ]);

      assert.ok(assessment.reasonCodes.includes("capacity.exhaustion.predicted"));
    });

    test("calculates confidence based on sample count and trend", () => {
      const service = new OpsCapacityPredictorService();

      // Less than 3 samples = 50% confidence
      const assessment1 = service.assessRisk(50, 60, []);
      assert.equal(assessment1.confidencePercent, 50);

      // 3 samples = 65%
      const assessment2 = service.assessRisk(50, 60, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 40 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 45 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
      ]);
      assert.equal(assessment2.confidencePercent, 65);

      // 5 samples = 80%
      const assessment3 = service.assessRisk(50, 60, [
        createSample({ timestamp: "2026-04-18T00:00:00Z", load: 40 }),
        createSample({ timestamp: "2026-04-19T00:00:00Z", load: 45 }),
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 48 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 50 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 55 }),
      ]);
      assert.equal(assessment3.confidencePercent, 80);

      // 10+ samples with trend = 92%
      const assessment4 = service.assessRisk(50, 60, [
        createSample({ timestamp: "2026-04-13T00:00:00Z", load: 30 }),
        createSample({ timestamp: "2026-04-14T00:00:00Z", load: 35 }),
        createSample({ timestamp: "2026-04-15T00:00:00Z", load: 38 }),
        createSample({ timestamp: "2026-04-16T00:00:00Z", load: 40 }),
        createSample({ timestamp: "2026-04-17T00:00:00Z", load: 42 }),
        createSample({ timestamp: "2026-04-18T00:00:00Z", load: 45 }),
        createSample({ timestamp: "2026-04-19T00:00:00Z", load: 47 }),
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 48 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 50 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 55 }),
      ]);
      assert.equal(assessment4.confidencePercent, 92);
    });

    test("adds ratio reason codes when projected ratio is significant", () => {
      const service = new OpsCapacityPredictorService();

      // Ratio >= 2
      const assessment1 = service.assessRisk(50, 100, []);
      assert.ok(assessment1.reasonCodes.includes("capacity.projected_ratio.ge_2x"));

      // Ratio >= 1.2 but < 2
      const assessment2 = service.assessRisk(100, 150, []);
      assert.ok(assessment2.reasonCodes.includes("capacity.projected_ratio.ge_1_2x"));
    });

    test("recommended buffer increases for growing trend", () => {
      const service = new OpsCapacityPredictorService();
      const assessment = service.assessRisk(50, 60, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 30 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 40 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
      ]);

      // Base buffer for medium risk is 20, +5 for growing = 25
      assert.equal(assessment.recommendedBufferPercent, 25);
    });

    test("recommended buffer decreases for shrinking trend", () => {
      const service = new OpsCapacityPredictorService();
      const assessment = service.assessRisk(50, 60, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 80 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 70 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 60 }),
      ]);

      // Base buffer for low risk is 10, -5 for shrinking = 5
      assert.equal(assessment.recommendedBufferPercent, 5);
    });
  });

  test.describe("buildPrediction", () => {
    test("returns combined prediction and assessment", () => {
      const service = new OpsCapacityPredictorService();
      const result = service.buildPrediction(50, 75, 100, 120, []);

      assert.ok("currentLoad" in result);
      assert.ok("projectedLoad" in result);
      assert.ok("riskLevel" in result);
      assert.ok("assessment" in result);
      assert.equal(result.currentLoad, 50);
      assert.equal(result.projectedLoad, 75);
    });

    test("assessment risk level overrides prediction risk level when different", () => {
      const service = new OpsCapacityPredictorService();
      // With growing trend, low base risk escalates to medium
      const result = service.buildPrediction(50, 52.5, 100, 120, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 30 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 40 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
      ]);

      // Base prediction risk would be low, but assessment says medium
      assert.equal(result.riskLevel, "medium");
      assert.equal(result.assessment.riskLevel, "medium");
    });

    test("includes trend information in assessment", () => {
      const service = new OpsCapacityPredictorService();
      const result = service.buildPrediction(50, 100, 100, 120, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 80 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 70 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 60 }),
      ]);

      assert.ok(result.assessment.trend);
      assert.equal(result.assessment.trend!.direction, "shrinking");
    });

    test("works with samples for trend analysis", () => {
      const service = new OpsCapacityPredictorService();
      const result = service.buildPrediction(50, 60, 100, 120, [
        createSample({ timestamp: "2026-04-20T00:00:00Z", load: 40 }),
        createSample({ timestamp: "2026-04-21T00:00:00Z", load: 45 }),
        createSample({ timestamp: "2026-04-22T00:00:00Z", load: 50 }),
      ]);

      assert.equal(result.assessment.confidencePercent, 65);
      assert.ok(result.assessment.trend);
      assert.equal(result.assessment.trend!.direction, "growing");
    });
  });
});
