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
} from "../../../../src/ops-maturity/platform-ops-agent/capacity-predictor/index.js";

test("predictOpsCapacityRisk returns low when ratio < 1.2", () => {
  assert.equal(predictOpsCapacityRisk(100, 100), "low");
  assert.equal(predictOpsCapacityRisk(100, 110), "low");
  assert.equal(predictOpsCapacityRisk(100, 119), "low");
});

test("predictOpsCapacityRisk returns medium when ratio >= 1.2 and < 2", () => {
  assert.equal(predictOpsCapacityRisk(100, 120), "medium");
  assert.equal(predictOpsCapacityRisk(100, 150), "medium");
  assert.equal(predictOpsCapacityRisk(100, 199), "medium");
});

test("predictOpsCapacityRisk returns high when ratio >= 2", () => {
  assert.equal(predictOpsCapacityRisk(50, 100), "high");
  assert.equal(predictOpsCapacityRisk(50, 150), "high");
  assert.equal(predictOpsCapacityRisk(100, 200), "high");
});

test("predictOpsCapacityRisk handles zero current load", () => {
  assert.equal(predictOpsCapacityRisk(0, 0), "low");
  assert.equal(predictOpsCapacityRisk(0, 100), "high");
});

test("predictOpsCapacityRisk uses custom thresholds", () => {
  const thresholds: CapacityThreshold = {
    warningPercent: 50,
    criticalPercent: 80,
    maxLoadPercent: 95,
  };
  // With default algorithm, ratio is the key factor
  assert.equal(predictOpsCapacityRisk(100, 100, thresholds), "low");
});

test("predictOpsCapacityRisk handles large ratios", () => {
  assert.equal(predictOpsCapacityRisk(1, 1000), "high");
  assert.equal(predictOpsCapacityRisk(10, 25), "high");
});

test("predictOpsCapacityRisk handles boundary ratio 1.2", () => {
  assert.equal(predictOpsCapacityRisk(100, 119.99), "low");
  assert.equal(predictOpsCapacityRisk(100, 120), "medium");
});

test("predictOpsCapacityRisk handles boundary ratio 2", () => {
  assert.equal(predictOpsCapacityRisk(100, 199.99), "medium");
  assert.equal(predictOpsCapacityRisk(100, 200), "high");
});

test("estimateCapacityHeadroom returns correct percentage", () => {
  const headroom = estimateCapacityHeadroom(20, 100);
  assert.equal(headroom, 80);
});

test("estimateCapacityHeadroom returns 0 for zero or negative projected load", () => {
  assert.equal(estimateCapacityHeadroom(20, 0), 0);
  assert.equal(estimateCapacityHeadroom(20, -10), 0);
});

test("estimateCapacityHeadroom handles equal loads", () => {
  const headroom = estimateCapacityHeadroom(50, 50);
  assert.equal(headroom, 0);
});

test("estimateCapacityHeadroom handles projected greater than current", () => {
  const headroom = estimateCapacityHeadroom(30, 100);
  // ((100 - 30) / 100) * 100 = 70
  assert.equal(headroom, 70);
});

test("estimateCapacityHeadroom handles zero current load", () => {
  const headroom = estimateCapacityHeadroom(0, 100);
  // ((100 - 0) / 100) * 100 = 100
  assert.equal(headroom, 100);
});

test("calculateCapacityPrediction returns correct structure", () => {
  const prediction = calculateCapacityPrediction(50, 75, 100, 120);
  assert.ok("currentLoad" in prediction);
  assert.ok("projectedLoad" in prediction);
  assert.ok("riskLevel" in prediction);
  assert.ok("headroomPercent" in prediction);
  assert.ok("utilizationPercent" in prediction);
  assert.ok("projectedUtilizationPercent" in prediction);
  assert.ok("confidencePercent" in prediction);
  assert.ok("recommendation" in prediction);
});

test("calculateCapacityPrediction calculates utilization correctly", () => {
  const prediction = calculateCapacityPrediction(50, 75, 100, 120);
  assert.equal(prediction.currentLoad, 50);
  assert.equal(prediction.projectedLoad, 75);
  assert.equal(prediction.utilizationPercent, 50); // 50/100 * 100
  assert.equal(prediction.projectedUtilizationPercent, 62.5); // 75/120 * 100
});

test("calculateCapacityPrediction calculates headroom correctly", () => {
  const prediction = calculateCapacityPrediction(50, 75, 100, 120);
  // (100 - 50) / 100 * 100 = 50
  assert.equal(prediction.headroomPercent, 50);
});

test("calculateCapacityPrediction handles zero capacity", () => {
  const prediction = calculateCapacityPrediction(50, 75, 0, 0);
  assert.equal(prediction.utilizationPercent, 0);
  assert.equal(prediction.projectedUtilizationPercent, 0);
  assert.equal(prediction.headroomPercent, 0);
});

test("calculateCapacityPrediction confidence increases with sample count", () => {
  const noSamples = calculateCapacityPrediction(50, 75, 100, 120);
  assert.equal(noSamples.confidencePercent, 50);

  const threeSamples = calculateCapacityPrediction(50, 75, 100, 120, [
    { timestamp: "2026-04-20T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 55, capacity: 100 },
  ]);
  assert.equal(threeSamples.confidencePercent, 60);

  const fiveSamples = calculateCapacityPrediction(50, 75, 100, 120, [
    { timestamp: "2026-04-18T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-19T00:00:00Z", load: 45, capacity: 100 },
    { timestamp: "2026-04-20T00:00:00Z", load: 48, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 55, capacity: 100 },
  ]);
  assert.equal(fiveSamples.confidencePercent, 75);

  const tenSamples = calculateCapacityPrediction(50, 75, 100, 120, [
    { timestamp: "2026-04-13T00:00:00Z", load: 30, capacity: 100 },
    { timestamp: "2026-04-14T00:00:00Z", load: 35, capacity: 100 },
    { timestamp: "2026-04-15T00:00:00Z", load: 38, capacity: 100 },
    { timestamp: "2026-04-16T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-17T00:00:00Z", load: 42, capacity: 100 },
    { timestamp: "2026-04-18T00:00:00Z", load: 45, capacity: 100 },
    { timestamp: "2026-04-19T00:00:00Z", load: 47, capacity: 100 },
    { timestamp: "2026-04-20T00:00:00Z", load: 48, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 55, capacity: 100 },
  ]);
  assert.equal(tenSamples.confidencePercent, 90);
});

test("calculateCapacityPrediction returns OK recommendation when utilization is low", () => {
  const prediction = calculateCapacityPrediction(10, 15, 100, 120);
  assert.equal(prediction.recommendation, "OK: Capacity is sufficient");
});

test("calculateCapacityPrediction returns WARNING when utilization is high", () => {
  const prediction = calculateCapacityPrediction(75, 80, 100, 120);
  // 75% utilization - warning threshold is 70%
  assert.ok(prediction.recommendation.includes("WARNING"));
});

test("calculateCapacityPrediction returns CRITICAL when utilization exceeds critical", () => {
  const prediction = calculateCapacityPrediction(90, 95, 100, 120);
  // 90% utilization - critical threshold is 85%
  assert.ok(prediction.recommendation.includes("CRITICAL"));
});

test("calculateCapacityPrediction returns INFO when projected utilization increases significantly", () => {
  // Current utilization: 30/100 = 30%, projected: 80/100 = 80%
  // Increase is 50% which is > 20%, so INFO
  const prediction = calculateCapacityPrediction(30, 80, 100, 100);
  assert.ok(prediction.recommendation.includes("INFO"));
  assert.ok(prediction.recommendation.includes("Monitor growth trend"));
});

test("calculateCapacityPrediction handles utilization at warning threshold", () => {
  // Exactly at 70% should trigger WARNING
  const prediction = calculateCapacityPrediction(70, 75, 100, 120);
  assert.ok(prediction.recommendation.includes("WARNING"));
});

test("calculateCapacityPrediction handles utilization at critical threshold", () => {
  // Exactly at 85% should trigger CRITICAL
  const prediction = calculateCapacityPrediction(85, 90, 100, 120);
  assert.ok(prediction.recommendation.includes("CRITICAL"));
});

test("projectFutureCapacity returns array of projections", () => {
  const projections = projectFutureCapacity(100, 10, 3);
  assert.equal(projections.length, 3);
});

test("projectFutureCapacity calculates growth correctly", () => {
  const projections = projectFutureCapacity(100, 10, 1);
  // 100 * (1 + 10/100) = 110
  assert.equal(projections[0], 110);
});

test("projectFutureCapacity compounds growth", () => {
  const projections = projectFutureCapacity(100, 10, 2);
  // Period 1: 100 * 1.1 = 110
  // Period 2: 110 * 1.1 = 121
  assert.equal(projections[0], 110);
  assert.equal(projections[1], 121);
});

test("projectFutureCapacity handles zero growth rate", () => {
  const projections = projectFutureCapacity(100, 0, 3);
  assert.equal(projections[0], 100);
  assert.equal(projections[1], 100);
  assert.equal(projections[2], 100);
});

test("projectFutureCapacity handles negative growth rate", () => {
  const projections = projectFutureCapacity(100, -10, 2);
  // Period 1: 100 * 0.9 = 90
  // Period 2: 90 * 0.9 = 81
  assert.equal(projections[0], 90);
  assert.equal(projections[1], 81);
});

test("projectFutureCapacity handles zero periods", () => {
  const projections = projectFutureCapacity(100, 10, 0);
  assert.equal(projections.length, 0);
});

test("projectFutureCapacity handles single period", () => {
  const projections = projectFutureCapacity(100, 10, 1);
  assert.equal(projections.length, 1);
  assert.equal(projections[0], 110);
});

test("projectFutureCapacity handles large growth rate", () => {
  const projections = projectFutureCapacity(100, 100, 1);
  // 100 * (1 + 100/100) = 200
  assert.equal(projections[0], 200);
});

test("projectFutureCapacity handles fractional growth rate", () => {
  const projections = projectFutureCapacity(100, 5.5, 1);
  // 100 * (1 + 5.5/100) = 105.5
  assert.equal(projections[0], 105.5);
});

test("predictCapacityRiskWithHistory returns base risk with no trend", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-22T00:00:00Z", load: 50, capacity: 100 },
  ];
  const risk = predictCapacityRiskWithHistory(50, 60, samples);
  // Base risk for ratio 1.2 is medium
  assert.equal(risk, "medium");
});

test("predictCapacityRiskWithHistory returns base risk with insufficient samples for trend", () => {
  const samples: CapacitySample[] = [];
  const risk = predictCapacityRiskWithHistory(50, 100, samples);
  // Ratio = 2, should be high
  assert.equal(risk, "high");
});

test("predictCapacityRiskWithHistory escalates risk for growing trend with high growth rate", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-20T00:00:00Z", load: 30, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 50, capacity: 100 },
  ];
  // Base risk for ratio 1.2 is medium, but growing trend with >20% growth
  // should escalate: medium -> high
  const risk = predictCapacityRiskWithHistory(50, 60, samples);
  assert.equal(risk, "high");
});

test("predictCapacityRiskWithHistory escalates low risk to medium for growing trend", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-20T00:00:00Z", load: 30, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 50, capacity: 100 },
  ];
  // Base risk for ratio 1.05 (50->52.5) is low, growing trend with >20% growth
  // should escalate: low -> medium
  const risk = predictCapacityRiskWithHistory(50, 52.5, samples);
  assert.equal(risk, "medium");
});

test("predictCapacityRiskWithHistory de-escalates high risk for shrinking trend", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-20T00:00:00Z", load: 80, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 70, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 60, capacity: 100 },
  ];
  // Base risk for ratio 2 is high, shrinking trend should de-escalate: high -> medium
  const risk = predictCapacityRiskWithHistory(50, 100, samples);
  assert.equal(risk, "medium");
});

test("predictCapacityRiskWithHistory returns low for shrinking trend with low base risk", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-20T00:00:00Z", load: 80, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 70, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 60, capacity: 100 },
  ];
  // Base risk for ratio ~1.17 is low, shrinking trend keeps it low
  const risk = predictCapacityRiskWithHistory(60, 70, samples);
  assert.equal(risk, "low");
});

test("predictCapacityRiskWithHistory returns base risk for stable trend", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-20T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 51, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 50, capacity: 100 },
  ];
  // Stable trend (growth ~0%), base risk medium
  const risk = predictCapacityRiskWithHistory(50, 60, samples);
  assert.equal(risk, "medium");
});

test("predictCapacityRiskWithHistory handles stable trend returns base risk", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-20T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 51, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 52, capacity: 100 },
  ];
  // Average growth rate ~2% per period, direction is stable (< 5%)
  // So base risk should be returned
  // Base risk for ratio 60/52 = 1.15 < 1.2 = low
  const risk = predictCapacityRiskWithHistory(52, 60, samples);
  assert.equal(risk, "low");
});

test("predictCapacityRiskWithHistory uses default thresholds", () => {
  const samples: CapacitySample[] = [];
  const risk = predictCapacityRiskWithHistory(50, 100, samples);
  // Ratio = 2, should be high
  assert.equal(risk, "high");
});

test("calculateCapacityPrediction riskLevel matches predictOpsCapacityRisk", () => {
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

test("calculateCapacityPrediction with samples includes trend analysis in confidence", () => {
  const prediction = calculateCapacityPrediction(50, 60, 100, 100, [
    { timestamp: "2026-04-20T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 45, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-23T00:00:00Z", load: 52, capacity: 100 },
    { timestamp: "2026-04-24T00:00:00Z", load: 55, capacity: 100 },
  ]);
  // 5 samples >= 5, confidence should be 75
  assert.equal(prediction.confidencePercent, 75);
});

test("calculateCapacityPrediction handles zero current capacity", () => {
  const prediction = calculateCapacityPrediction(50, 75, 0, 100);
  assert.equal(prediction.utilizationPercent, 0);
  assert.equal(prediction.headroomPercent, 0);
});

test("calculateCapacityPrediction handles projected capacity less than current", () => {
  const prediction = calculateCapacityPrediction(30, 60, 100, 80);
  // projectedUtilizationPercent = 60/80 * 100 = 75
  assert.equal(prediction.projectedUtilizationPercent, 75);
});

test("predictCapacityRiskWithHistory with multiple samples analyzes trend correctly", () => {
  const samples: CapacitySample[] = [
    { timestamp: "2026-04-18T00:00:00Z", load: 20, capacity: 100 },
    { timestamp: "2026-04-19T00:00:00Z", load: 30, capacity: 100 },
    { timestamp: "2026-04-20T00:00:00Z", load: 40, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 50, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 60, capacity: 100 },
  ];
  // All samples growing, overall growth rate = 200% (20->60)
  // Average growth per interval should be high
  const risk = predictCapacityRiskWithHistory(60, 70, samples);
  // Base risk: 70/60 = 1.167 < 1.2, so base is low
  // But growing with high growth rate should escalate to medium
  assert.equal(risk, "medium");
});

test("OpsCapacityPredictorService assesses risk with trend signals", () => {
  const service = new OpsCapacityPredictorService();
  const assessment = service.assessRisk(100, 180, [
    { timestamp: "2026-04-20T00:00:00Z", load: 80, capacity: 100 },
    { timestamp: "2026-04-21T00:00:00Z", load: 100, capacity: 100 },
    { timestamp: "2026-04-22T00:00:00Z", load: 140, capacity: 100 },
  ]);

  assert.equal(assessment.riskLevel, "high");
  assert.ok(assessment.reasonCodes.includes("capacity.trend.growing"));
  assert.ok(assessment.recommendedBufferPercent >= 30);
});

test("OpsCapacityPredictorService handles low risk without history", () => {
  const service = new OpsCapacityPredictorService();
  const assessment = service.assessRisk(100, 105, []);

  assert.equal(assessment.riskLevel, "low");
  assert.equal(assessment.confidencePercent, 50);
  assert.equal(assessment.recommendedBufferPercent, 10);
});

test("OpsCapacityPredictorService reduces buffer for shrinking trend", () => {
  const service = new OpsCapacityPredictorService();
  const assessment = service.assessRisk(100, 210, [
    { timestamp: "2026-04-20T00:00:00Z", load: 200, capacity: 250 },
    { timestamp: "2026-04-21T00:00:00Z", load: 150, capacity: 250 },
    { timestamp: "2026-04-22T00:00:00Z", load: 100, capacity: 250 },
  ]);

  assert.equal(assessment.riskLevel, "medium");
  assert.equal(assessment.trend?.direction, "shrinking");
  assert.equal(assessment.recommendedBufferPercent, 15);
});
