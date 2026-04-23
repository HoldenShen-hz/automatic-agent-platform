import assert from "node:assert/strict";
import test from "node:test";
test("EvalStatus type accepts valid values", () => {
    const statuses = ["pending", "running", "passed", "failed", "degraded"];
    assert.equal(statuses.length, 5);
});
test("EvalSuiteKind type accepts valid values", () => {
    const kinds = ["golden", "regression", "ab_test", "smoke"];
    assert.equal(kinds.length, 4);
});
test("QualityVerdict type accepts valid values", () => {
    const verdicts = ["pass", "fail", "degraded", "inconclusive"];
    assert.equal(verdicts.length, 4);
});
test("EvalStructuredOutput type accepts various values", () => {
    const outputs = [
        "string",
        42,
        true,
        null,
        { key: "value" },
        [1, 2, 3],
    ];
    assert.equal(outputs.length, 6);
});
//# sourceMappingURL=llm-eval-service.test.js.map