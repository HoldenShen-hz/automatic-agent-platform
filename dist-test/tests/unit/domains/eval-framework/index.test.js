import assert from "node:assert/strict";
import test from "node:test";
import { DomainEvalFrameworkSchema, DomainEvaluatorSchema, listBlockingEvaluators, } from "../../../../src/domains/eval-framework/index.js";
// --- Schema Tests ---
test("DomainEvaluatorSchema accepts valid evaluator", () => {
    const result = DomainEvaluatorSchema.safeParse({
        evaluatorId: "eval_1",
        metric: "pass_rate",
        threshold: 0.95,
        blocking: true,
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.evaluatorId, "eval_1");
});
test("DomainEvaluatorSchema applies defaults", () => {
    const result = DomainEvaluatorSchema.parse({
        evaluatorId: "eval_1",
        metric: "accuracy",
        threshold: 0.8,
    });
    assert.equal(result.blocking, true);
});
test("DomainEvaluatorSchema rejects threshold outside 0-1 range", () => {
    const result1 = DomainEvaluatorSchema.safeParse({
        evaluatorId: "eval_1",
        metric: "accuracy",
        threshold: 1.5,
    });
    assert.equal(result1.success, false);
    const result2 = DomainEvaluatorSchema.safeParse({
        evaluatorId: "eval_1",
        metric: "accuracy",
        threshold: -0.1,
    });
    assert.equal(result2.success, false);
});
test("DomainEvaluatorSchema requires non-empty evaluatorId and metric", () => {
    const result1 = DomainEvaluatorSchema.safeParse({
        evaluatorId: "",
        metric: "accuracy",
        threshold: 0.8,
    });
    assert.equal(result1.success, false);
    const result2 = DomainEvaluatorSchema.safeParse({
        evaluatorId: "eval_1",
        metric: "",
        threshold: 0.8,
    });
    assert.equal(result2.success, false);
});
test("DomainEvalFrameworkSchema accepts valid framework", () => {
    const result = DomainEvalFrameworkSchema.safeParse({
        frameworkId: "fw_1",
        domainId: "coding",
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.frameworkId, "fw_1");
});
test("DomainEvalFrameworkSchema applies defaults", () => {
    const result = DomainEvalFrameworkSchema.parse({
        frameworkId: "fw_1",
        domainId: "coding",
    });
    assert.deepEqual(result.fewShotExamples, []);
    assert.deepEqual(result.evaluators, []);
    assert.deepEqual(result.onlineMetrics, []);
    assert.equal(result.releaseGates.minFewShotCount, 5);
    assert.equal(result.releaseGates.minRegressionCaseCount, 20);
    assert.equal(result.releaseGates.requirePromptInjectionCoverage, true);
});
test("DomainEvalFrameworkSchema accepts full framework with evaluators", () => {
    const result = DomainEvalFrameworkSchema.safeParse({
        frameworkId: "fw_full",
        domainId: "finance",
        fewShotExamples: ["example_1", "example_2"],
        evaluators: [
            { evaluatorId: "eval_1", metric: "accuracy", threshold: 0.9, blocking: true },
            { evaluatorId: "eval_2", metric: "latency", threshold: 0.7, blocking: false },
        ],
        onlineMetrics: ["latency_p50", "throughput"],
        releaseGates: {
            minFewShotCount: 10,
            minRegressionCaseCount: 50,
            requirePromptInjectionCoverage: false,
        },
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.evaluators.length, 2);
    assert.equal(result.data?.releaseGates.minFewShotCount, 10);
});
// --- listBlockingEvaluators Tests ---
test("listBlockingEvaluators returns only blocking evaluators", () => {
    const framework = {
        frameworkId: "fw_1",
        domainId: "test",
        evaluators: [
            { evaluatorId: "eval_1", metric: "pass_rate", threshold: 0.95, blocking: true },
            { evaluatorId: "eval_2", metric: "latency", threshold: 0.8, blocking: false },
            { evaluatorId: "eval_3", metric: "accuracy", threshold: 0.9, blocking: true },
        ],
        fewShotExamples: [],
        onlineMetrics: [],
        releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    };
    const blocking = listBlockingEvaluators(framework);
    assert.equal(blocking.length, 2);
    assert.ok(blocking.every((e) => e.blocking === true));
    assert.equal(blocking[0]?.evaluatorId, "eval_1");
    assert.equal(blocking[1]?.evaluatorId, "eval_3");
});
test("listBlockingEvaluators returns empty array when no blocking evaluators", () => {
    const framework = {
        frameworkId: "fw_2",
        domainId: "test",
        evaluators: [
            { evaluatorId: "eval_1", metric: "pass_rate", threshold: 0.95, blocking: false },
            { evaluatorId: "eval_2", metric: "latency", threshold: 0.8, blocking: false },
        ],
        fewShotExamples: [],
        onlineMetrics: [],
        releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    };
    const blocking = listBlockingEvaluators(framework);
    assert.equal(blocking.length, 0);
});
test("listBlockingEvaluators returns empty array for framework with no evaluators", () => {
    const framework = {
        frameworkId: "fw_3",
        domainId: "test",
        evaluators: [],
        fewShotExamples: [],
        onlineMetrics: [],
        releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    };
    const blocking = listBlockingEvaluators(framework);
    assert.equal(blocking.length, 0);
});
//# sourceMappingURL=index.test.js.map