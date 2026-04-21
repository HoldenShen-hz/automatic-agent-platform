import assert from "node:assert/strict";
import test from "node:test";
import { buildConfigOptimizationSuggestion } from "../../../../../src/ops-maturity/platform-ops-agent/config-optimizer/index.js";
test("buildConfigOptimizationSuggestion formats suggestion correctly", () => {
    const suggestion = buildConfigOptimizationSuggestion("max_connections", 100, 200);
    assert.equal(suggestion, "max_connections: 100 -> 200");
});
test("buildConfigOptimizationSuggestion handles string values", () => {
    const suggestion = buildConfigOptimizationSuggestion("timeout", 30, 60);
    assert.ok(suggestion.includes("timeout"));
    assert.ok(suggestion.includes("30"));
    assert.ok(suggestion.includes("60"));
});
test("buildConfigOptimizationSuggestion handles zero values", () => {
    const suggestion = buildConfigOptimizationSuggestion("retry_count", 0, 3);
    assert.equal(suggestion, "retry_count: 0 -> 3");
});
test("buildConfigOptimizationSuggestion handles large values", () => {
    const suggestion = buildConfigOptimizationSuggestion("pool_size", 10, 10000);
    assert.equal(suggestion, "pool_size: 10 -> 10000");
});
test("buildConfigOptimizationSuggestion handles negative to positive", () => {
    const suggestion = buildConfigOptimizationSuggestion("threshold", -50, 50);
    assert.equal(suggestion, "threshold: -50 -> 50");
});
//# sourceMappingURL=config-optimizer.test.js.map