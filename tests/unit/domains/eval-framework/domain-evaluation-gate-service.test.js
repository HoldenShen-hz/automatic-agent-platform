import assert from "node:assert/strict";
import test from "node:test";
import { DomainEvaluationGateService, } from "../../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
function createTestFramework(domainId) {
    return {
        frameworkId: `fw_${domainId}`,
        domainId,
        fewShotExamples: ["example_1", "example_2", "example_3", "example_4", "example_5"],
        evaluators: [
            { evaluatorId: "eval_latency", metric: "p99_latency_ms", threshold: 0.9, blocking: true },
            { evaluatorId: "eval_accuracy", metric: "accuracy", threshold: 0.85, blocking: false },
            { evaluatorId: "eval_throughput", metric: "throughput", threshold: 0.75, blocking: true },
        ],
        onlineMetrics: ["p99_latency_ms", "accuracy", "throughput"],
        releaseGates: {
            minFewShotCount: 5,
            minRegressionCaseCount: 20,
            requirePromptInjectionCoverage: true,
        },
    };
}
function createTestRegressionCase(overrides) {
    return {
        caseId: "case_test_1",
        metric: "p99_latency_ms",
        score: 0.95,
        expectedClass: "success",
        ...overrides,
    };
}
test("DomainEvaluationGateService.evaluateSuite throws on empty regression suite", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    const run = {
        suiteId: "suite_1",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases: [],
    };
    assert.throws(() => service.evaluateSuite(framework, run), /domain_eval\.empty_regression_suite/);
});
test("DomainEvaluationGateService.evaluateSuite throws on domain mismatch", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    const run = {
        suiteId: "suite_1",
        domainId: "data-engineering",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases: [createTestRegressionCase()],
    };
    assert.throws(() => service.evaluateSuite(framework, run), /domain_eval\.domain_mismatch/);
});
test("DomainEvaluationGateService.evaluateSuite returns pass when all gates pass", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    const cases = [
        createTestRegressionCase({ caseId: "case_1", metric: "p99_latency_ms", score: 0.95 }),
        createTestRegressionCase({ caseId: "case_2", metric: "p99_latency_ms", score: 0.92 }),
        createTestRegressionCase({ caseId: "case_3", metric: "accuracy", score: 0.90 }),
        createTestRegressionCase({ caseId: "case_4", metric: "accuracy", score: 0.88 }),
        createTestRegressionCase({ caseId: "case_5", metric: "throughput", score: 0.80 }),
        createTestRegressionCase({ caseId: "case_6", metric: "throughput", score: 0.78 }),
        // Additional cases to meet minRegressionCaseCount
        createTestRegressionCase({ caseId: "case_7", metric: "p99_latency_ms", score: 0.93 }),
        createTestRegressionCase({ caseId: "case_8", metric: "p99_latency_ms", score: 0.91 }),
        createTestRegressionCase({ caseId: "case_9", metric: "accuracy", score: 0.87 }),
        createTestRegressionCase({ caseId: "case_10", metric: "accuracy", score: 0.86 }),
        createTestRegressionCase({ caseId: "case_11", metric: "throughput", score: 0.79 }),
        createTestRegressionCase({ caseId: "case_12", metric: "throughput", score: 0.77 }),
        createTestRegressionCase({ caseId: "case_13", metric: "p99_latency_ms", score: 0.94 }),
        createTestRegressionCase({ caseId: "case_14", metric: "p99_latency_ms", score: 0.96 }),
        createTestRegressionCase({ caseId: "case_15", metric: "accuracy", score: 0.89 }),
        createTestRegressionCase({ caseId: "case_16", metric: "accuracy", score: 0.91 }),
        createTestRegressionCase({ caseId: "case_17", metric: "throughput", score: 0.81 }),
        createTestRegressionCase({ caseId: "case_18", metric: "throughput", score: 0.76 }),
        createTestRegressionCase({ caseId: "case_19", metric: "p99_latency_ms", score: 0.97 }),
        createTestRegressionCase({ caseId: "case_20", metric: "accuracy", score: 0.92, approvalMatched: true }),
    ];
    const run = {
        suiteId: "suite_pass",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.equal(report.overallPass, true);
    assert.equal(report.releaseDecision, "promote");
    assert.equal(report.blockingFailures.length, 0);
});
test("DomainEvaluationGateService.evaluateSuite returns hold when blocking gate fails", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    const cases = [
        createTestRegressionCase({ caseId: "case_1", metric: "p99_latency_ms", score: 0.85 }), // Below threshold
        createTestRegressionCase({ caseId: "case_2", metric: "p99_latency_ms", score: 0.80 }),
        createTestRegressionCase({ caseId: "case_3", metric: "accuracy", score: 0.90 }),
        createTestRegressionCase({ caseId: "case_4", metric: "accuracy", score: 0.88 }),
        createTestRegressionCase({ caseId: "case_5", metric: "throughput", score: 0.80 }),
        createTestRegressionCase({ caseId: "case_6", metric: "throughput", score: 0.78 }),
        createTestRegressionCase({ caseId: "case_7", metric: "p99_latency_ms", score: 0.83 }),
        createTestRegressionCase({ caseId: "case_8", metric: "p99_latency_ms", score: 0.81 }),
        createTestRegressionCase({ caseId: "case_9", metric: "accuracy", score: 0.87 }),
        createTestRegressionCase({ caseId: "case_10", metric: "accuracy", score: 0.86 }),
        createTestRegressionCase({ caseId: "case_11", metric: "throughput", score: 0.79 }),
        createTestRegressionCase({ caseId: "case_12", metric: "throughput", score: 0.77 }),
        createTestRegressionCase({ caseId: "case_13", metric: "p99_latency_ms", score: 0.84 }),
        createTestRegressionCase({ caseId: "case_14", metric: "p99_latency_ms", score: 0.86 }),
        createTestRegressionCase({ caseId: "case_15", metric: "accuracy", score: 0.89 }),
        createTestRegressionCase({ caseId: "case_16", metric: "accuracy", score: 0.91 }),
        createTestRegressionCase({ caseId: "case_17", metric: "throughput", score: 0.81 }),
        createTestRegressionCase({ caseId: "case_18", metric: "throughput", score: 0.76 }),
        createTestRegressionCase({ caseId: "case_19", metric: "p99_latency_ms", score: 0.87 }),
        createTestRegressionCase({ caseId: "case_20", metric: "accuracy", score: 0.92, approvalMatched: true }),
    ];
    const run = {
        suiteId: "suite_fail",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.equal(report.overallPass, false);
    assert.equal(report.releaseDecision, "hold");
    assert.ok(report.blockingFailures.length > 0);
});
test("DomainEvaluationGateService.evaluateSuite includes evaluator results", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    const cases = [
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.95 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.90 }),
        createTestRegressionCase({ metric: "throughput", score: 0.80 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.93 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.88 }),
        createTestRegressionCase({ metric: "throughput", score: 0.78 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.94 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.91 }),
        createTestRegressionCase({ metric: "throughput", score: 0.79 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.96 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.89 }),
        createTestRegressionCase({ metric: "throughput", score: 0.77 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.92 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.90 }),
        createTestRegressionCase({ metric: "throughput", score: 0.81 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.97 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.92 }),
        createTestRegressionCase({ metric: "throughput", score: 0.76 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.91 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.93, approvalMatched: true }),
    ];
    const run = {
        suiteId: "suite_results",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.equal(report.evaluatorResults.length, 3);
    const latencyResult = report.evaluatorResults.find((r) => r.evaluatorId === "eval_latency");
    assert.ok(latencyResult);
    assert.equal(latencyResult?.metric, "p99_latency_ms");
    assert.equal(latencyResult?.blocking, true);
});
test("DomainEvaluationGateService.evaluateSuite reports fewShotGate failure when below minimum", () => {
    const service = new DomainEvaluationGateService();
    const frameworkWithFewShots = {
        ...createTestFramework("coding"),
        fewShotExamples: ["example_1", "example_2"], // Only 2, below minFewShotCount of 5
    };
    const cases = [
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
    ];
    const run = {
        suiteId: "suite_fewshot_fail",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(frameworkWithFewShots, run);
    assert.equal(report.fewShotGatePassed, false);
    assert.ok(report.blockingFailures.includes("domain_eval.min_few_shot_gate"));
});
test("DomainEvaluationGateService.evaluateSuite reports regressionCaseGate failure when below minimum", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    // Only 5 cases, below minRegressionCaseCount of 20
    const cases = [
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
        createTestRegressionCase(),
    ];
    const run = {
        suiteId: "suite_regression_fail",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.equal(report.regressionCaseGatePassed, false);
    assert.ok(report.blockingFailures.includes("domain_eval.min_regression_case_gate"));
});
test("DomainEvaluationGateService.evaluateSuite reports promptInjectionGate failure when coverage insufficient", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    // Cases with approvalMatched = false
    const cases = [
        createTestRegressionCase({ caseId: "case_1", approvalMatched: false }),
        createTestRegressionCase({ caseId: "case_2", approvalMatched: false }),
        createTestRegressionCase({ caseId: "case_3", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_4", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_5", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_6", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_7", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_8", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_9", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_10", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_11", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_12", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_13", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_14", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_15", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_16", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_17", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_18", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_19", approvalMatched: true }),
        createTestRegressionCase({ caseId: "case_20", approvalMatched: true }),
    ];
    const run = {
        suiteId: "suite_prompt_injection_fail",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.equal(report.promptInjectionCoveragePassed, false);
    assert.ok(report.blockingFailures.includes("domain_eval.prompt_injection_gate"));
});
test("DomainEvaluationGateService.evaluateSuite skips promptInjectionGate when not required", () => {
    const service = new DomainEvaluationGateService();
    const frameworkWithoutPromptInjection = {
        ...createTestFramework("coding"),
        releaseGates: {
            minFewShotCount: 5,
            minRegressionCaseCount: 20,
            requirePromptInjectionCoverage: false,
        },
    };
    // Cases with approvalMatched = false should not cause failure
    const cases = [];
    for (let i = 0; i < 20; i++) {
        cases.push(createTestRegressionCase({ caseId: `case_${i}`, approvalMatched: false }));
    }
    const run = {
        suiteId: "suite_no_prompt_req",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(frameworkWithoutPromptInjection, run);
    assert.equal(report.promptInjectionCoveragePassed, true);
    assert.ok(!report.blockingFailures.includes("domain_eval.prompt_injection_gate"));
});
test("DomainEvaluationGateService.evaluateSuite calculates missingOnlineMetrics", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    // Only p99_latency_ms metric in cases, missing "accuracy" and "throughput"
    const cases = [];
    for (let i = 0; i < 20; i++) {
        cases.push(createTestRegressionCase({ caseId: `case_${i}`, metric: "p99_latency_ms", score: 0.95 }));
    }
    const run = {
        suiteId: "suite_missing_metrics",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.ok(report.missingOnlineMetrics.includes("accuracy"));
    assert.ok(report.missingOnlineMetrics.includes("throughput"));
    assert.equal(report.missingOnlineMetrics.includes("p99_latency_ms"), false);
});
test("DomainEvaluationGateService.evaluateSuite includes nonBlockingFindings for non-blocking failures", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    // Cases where non-blocking evaluator (eval_accuracy) fails
    const cases = [
        createTestRegressionCase({ caseId: "case_1", metric: "p99_latency_ms", score: 0.95 }),
        createTestRegressionCase({ caseId: "case_2", metric: "p99_latency_ms", score: 0.92 }),
        createTestRegressionCase({ caseId: "case_3", metric: "accuracy", score: 0.50 }), // Below 0.85 threshold
        createTestRegressionCase({ caseId: "case_4", metric: "accuracy", score: 0.60 }),
        createTestRegressionCase({ caseId: "case_5", metric: "throughput", score: 0.80 }),
        createTestRegressionCase({ caseId: "case_6", metric: "throughput", score: 0.78 }),
        createTestRegressionCase({ caseId: "case_7", metric: "p99_latency_ms", score: 0.93 }),
        createTestRegressionCase({ caseId: "case_8", metric: "p99_latency_ms", score: 0.91 }),
        createTestRegressionCase({ caseId: "case_9", metric: "accuracy", score: 0.55 }),
        createTestRegressionCase({ caseId: "case_10", metric: "accuracy", score: 0.65 }),
        createTestRegressionCase({ caseId: "case_11", metric: "throughput", score: 0.79 }),
        createTestRegressionCase({ caseId: "case_12", metric: "throughput", score: 0.77 }),
        createTestRegressionCase({ caseId: "case_13", metric: "p99_latency_ms", score: 0.94 }),
        createTestRegressionCase({ caseId: "case_14", metric: "p99_latency_ms", score: 0.96 }),
        createTestRegressionCase({ caseId: "case_15", metric: "accuracy", score: 0.52 }),
        createTestRegressionCase({ caseId: "case_16", metric: "accuracy", score: 0.58 }),
        createTestRegressionCase({ caseId: "case_17", metric: "throughput", score: 0.81 }),
        createTestRegressionCase({ caseId: "case_18", metric: "throughput", score: 0.76 }),
        createTestRegressionCase({ caseId: "case_19", metric: "p99_latency_ms", score: 0.97 }),
        createTestRegressionCase({ caseId: "case_20", metric: "accuracy", score: 0.70, approvalMatched: true }),
    ];
    const run = {
        suiteId: "suite_non_blocking",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    // Overall should pass since blocking evaluators pass
    assert.equal(report.overallPass, true);
    // But non-blocking findings should include accuracy failures
    assert.ok(report.nonBlockingFindings.some((f) => f.includes("eval_accuracy:below_threshold")));
});
test("DomainEvaluationGateService.evaluateSuite calculates coveredMetrics correctly", () => {
    const service = new DomainEvaluationGateService();
    const framework = createTestFramework("coding");
    const cases = [
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.95 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.93 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.90 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.88 }),
        createTestRegressionCase({ metric: "throughput", score: 0.80 }),
        createTestRegressionCase({ metric: "throughput", score: 0.78 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.94 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.92 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.89 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.91 }),
        createTestRegressionCase({ metric: "throughput", score: 0.79 }),
        createTestRegressionCase({ metric: "throughput", score: 0.77 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.96 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.91 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.87 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.90 }),
        createTestRegressionCase({ metric: "throughput", score: 0.81 }),
        createTestRegressionCase({ metric: "throughput", score: 0.76 }),
        createTestRegressionCase({ metric: "p99_latency_ms", score: 0.97 }),
        createTestRegressionCase({ metric: "accuracy", score: 0.92, approvalMatched: true }),
    ];
    const run = {
        suiteId: "suite_covered",
        domainId: "coding",
        releaseType: "daily",
        executionMode: "auto",
        storageMode: "sqlite",
        cases,
    };
    const report = service.evaluateSuite(framework, run);
    assert.equal(report.coveredMetrics.length, 3);
    assert.ok(report.coveredMetrics.includes("p99_latency_ms"));
    assert.ok(report.coveredMetrics.includes("accuracy"));
    assert.ok(report.coveredMetrics.includes("throughput"));
});
//# sourceMappingURL=domain-evaluation-gate-service.test.js.map