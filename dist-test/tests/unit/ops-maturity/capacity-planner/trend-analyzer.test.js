import assert from "node:assert/strict";
import test from "node:test";
import { CapacityTrendAnalyzerService, analyzeCapacityTrend, estimateCapacityVolatility, } from "../../../../src/ops-maturity/capacity-planner/trend-analyzer/index.js";
test("analyzeCapacityTrend returns flat direction for empty samples", () => {
    const result = analyzeCapacityTrend([]);
    assert.equal(result.direction, "flat");
    assert.equal(result.average, 0);
});
test("analyzeCapacityTrend returns flat direction when all samples are equal", () => {
    const result = analyzeCapacityTrend([100, 100, 100]);
    assert.equal(result.direction, "flat");
    assert.equal(result.average, 100);
});
test("analyzeCapacityTrend returns up direction when last sample greater than first", () => {
    const result = analyzeCapacityTrend([100, 120, 150]);
    assert.equal(result.direction, "up");
    assert.equal(result.average, 123.33);
});
test("analyzeCapacityTrend returns down direction when last sample less than first", () => {
    const result = analyzeCapacityTrend([500, 400, 300]);
    assert.equal(result.direction, "down");
    assert.equal(result.average, 400);
});
test("analyzeCapacityTrend handles single sample", () => {
    const result = analyzeCapacityTrend([42]);
    assert.equal(result.direction, "flat");
    assert.equal(result.average, 42);
});
test("analyzeCapacityTrend rounds average to two decimal places", () => {
    const result = analyzeCapacityTrend([10, 20, 30]);
    assert.equal(result.average, 20);
});
test("estimateCapacityVolatility returns 0 for empty samples", () => {
    const result = estimateCapacityVolatility([]);
    assert.equal(result, 0);
});
test("estimateCapacityVolatility returns 0 for single sample", () => {
    const result = estimateCapacityVolatility([100]);
    assert.equal(result, 0);
});
test("estimateCapacityVolatility returns 0 for constant samples", () => {
    const result = estimateCapacityVolatility([100, 100, 100, 100]);
    assert.equal(result, 0);
});
test("estimateCapacityVolatility calculates correct volatility for varied samples", () => {
    // Samples: [100, 120, 80, 140]
    // Deltas: |120-100|=20, |80-120|=40, |140-80|=60
    // Average: (20+40+60)/3 = 120/3 = 40
    const result = estimateCapacityVolatility([100, 120, 80, 140]);
    assert.equal(result, 40);
});
test("estimateCapacityVolatility handles small fluctuations", () => {
    // Samples: [10, 11, 10, 11]
    // Deltas: |11-10|=1, |10-11|=1, |11-10|=1
    // Average: 3/3 = 1
    const result = estimateCapacityVolatility([10, 11, 10, 11]);
    assert.equal(result, 1);
});
test("estimateCapacityVolatility handles large fluctuations", () => {
    // Samples: [0, 100, 0, 100]
    // Deltas: |100-0|=100, |0-100|=100, |100-0|=100
    // Average: 300/3 = 100
    const result = estimateCapacityVolatility([0, 100, 0, 100]);
    assert.equal(result, 100);
});
test("CapacityTrendAnalyzerService returns volatility and confidence", () => {
    const service = new CapacityTrendAnalyzerService();
    const analysis = service.analyze([100, 110, 140, 180, 220]);
    assert.equal(analysis.direction, "up");
    assert.ok(analysis.volatility > 0);
    assert.equal(analysis.confidencePercent, 75);
});
//# sourceMappingURL=trend-analyzer.test.js.map