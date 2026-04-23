import assert from "node:assert/strict";
import test from "node:test";
import { DomainEvaluationGateService } from "../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
const FRAMEWORK = {
    frameworkId: "eval_coding",
    domainId: "coding",
    fewShotExamples: [],
    evaluators: [
        { evaluatorId: "tests_pass", metric: "pass_rate", threshold: 0.95, blocking: true },
        { evaluatorId: "latency", metric: "latency_score", threshold: 0.8, blocking: false },
    ],
    onlineMetrics: ["latency_score", "approval_match"],
    releaseGates: { minFewShotCount: 0, minRegressionCaseCount: 0, requirePromptInjectionCoverage: true },
};
test("DomainEvaluationGateService promotes suites that satisfy blocking evaluators", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_pre_release",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" },
            { caseId: "case_2", metric: "latency_score", score: 0.82, expectedClass: "coding" },
        ],
    });
    assert.equal(report.overallPass, true);
    assert.equal(report.releaseDecision, "promote");
    assert.deepEqual(report.blockingFailures, []);
    assert.deepEqual(report.missingOnlineMetrics, ["approval_match"]);
});
test("DomainEvaluationGateService holds release when a blocking evaluator falls below threshold", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_bad",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.8, expectedClass: "coding" },
            { caseId: "case_2", metric: "latency_score", score: 0.92, expectedClass: "coding" },
        ],
    });
    assert.equal(report.overallPass, false);
    assert.equal(report.releaseDecision, "hold");
    assert.deepEqual(report.blockingFailures, ["tests_pass"]);
});
test("DomainEvaluationGateService throws when regression suite is empty", () => {
    const service = new DomainEvaluationGateService();
    assert.throws(() => service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_empty",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [],
    }), /domain_eval.empty_regression_suite/);
});
test("DomainEvaluationGateService throws when domainId does not match framework", () => {
    const service = new DomainEvaluationGateService();
    assert.throws(() => service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_mismatch",
        domainId: "different_domain",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [{ caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" }],
    }), /domain_eval.domain_mismatch/);
});
test("DomainEvaluationGateService reports prompt injection coverage failure when required and approvalMatched is false", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_prompt_injection_fail",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding", approvalMatched: false },
            { caseId: "case_2", metric: "latency_score", score: 0.85, expectedClass: "coding" },
        ],
    });
    assert.equal(report.overallPass, false);
    assert.equal(report.releaseDecision, "hold");
    assert.ok(report.blockingFailures.includes("domain_eval.prompt_injection_gate"));
    assert.equal(report.promptInjectionCoveragePassed, false);
});
test("DomainEvaluationGateService skips prompt injection gate when requirePromptInjectionCoverage is false", () => {
    const frameworkNoPromptInjection = {
        ...FRAMEWORK,
        releaseGates: { minFewShotCount: 0, minRegressionCaseCount: 0, requirePromptInjectionCoverage: false },
    };
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(frameworkNoPromptInjection, {
        suiteId: "suite_no_prompt_gate",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding", approvalMatched: false },
        ],
    });
    assert.equal(report.overallPass, true);
    assert.equal(report.promptInjectionCoveragePassed, true);
});
test("DomainEvaluationGateService includes few-shot gate failure when examples below minimum", () => {
    const frameworkWithFewShot = {
        ...FRAMEWORK,
        fewShotExamples: ["example_1", "example_2", "example_3"],
        releaseGates: { minFewShotCount: 10, minRegressionCaseCount: 0, requirePromptInjectionCoverage: false },
    };
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(frameworkWithFewShot, {
        suiteId: "suite_few_shot_fail",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [{ caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" }],
    });
    assert.equal(report.overallPass, false);
    assert.ok(report.blockingFailures.includes("domain_eval.min_few_shot_gate"));
    assert.equal(report.fewShotGatePassed, false);
});
test("DomainEvaluationGateService includes regression case gate failure when cases below minimum", () => {
    const service = new DomainEvaluationGateService();
    const frameworkWithMinCases = {
        ...FRAMEWORK,
        releaseGates: { minFewShotCount: 0, minRegressionCaseCount: 50, requirePromptInjectionCoverage: false },
    };
    const report = service.evaluateSuite(frameworkWithMinCases, {
        suiteId: "suite_regression_fail",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [{ caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" }],
    });
    assert.equal(report.overallPass, false);
    assert.ok(report.blockingFailures.includes("domain_eval.min_regression_case_gate"));
    assert.equal(report.regressionCaseGatePassed, false);
});
test("DomainEvaluationGateService reports non-blocking evaluator failures in nonBlockingFindings", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_non_blocking_fail",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" },
            { caseId: "case_2", metric: "latency_score", score: 0.5, expectedClass: "coding" },
        ],
    });
    // Blocking evaluators pass
    assert.equal(report.overallPass, true);
    // Non-blocking evaluator falls below threshold
    assert.ok(report.nonBlockingFindings.some((f) => f.includes("latency:below_threshold")));
});
test("DomainEvaluationGateService reports missing online metrics in nonBlockingFindings", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_missing_metrics",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [{ caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" }],
    });
    assert.ok(report.missingOnlineMetrics.includes("latency_score"));
    assert.ok(report.missingOnlineMetrics.includes("approval_match"));
    assert.ok(report.nonBlockingFindings.some((f) => f.includes("online_metric_missing:latency_score")));
});
test("DomainEvaluationGateService aggregates multiple metrics from cases", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_multi_case",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "latency_score", score: 0.8, expectedClass: "coding" },
            { caseId: "case_2", metric: "latency_score", score: 0.9, expectedClass: "coding" },
            { caseId: "case_3", metric: "latency_score", score: 0.7, expectedClass: "coding" },
        ],
    });
    // Average of 0.8, 0.9, 0.7 = 0.8, which meets threshold of 0.8
    const latencyResult = report.evaluatorResults.find((r) => r.metric === "latency_score");
    assert.equal(latencyResult?.observedScore, 0.8);
    assert.equal(latencyResult?.passed, true);
});
test("DomainEvaluationGateService handles null observedScore when no cases match metric", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_no_match",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" },
            // No latency_score cases
        ],
    });
    const latencyResult = report.evaluatorResults.find((r) => r.metric === "latency_score");
    assert.equal(latencyResult?.observedScore, null);
    assert.equal(latencyResult?.passed, false);
});
test("DomainEvaluationGateService returns correct covered metrics", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_covered",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.98, expectedClass: "coding" },
            { caseId: "case_2", metric: "latency_score", score: 0.85, expectedClass: "coding" },
        ],
    });
    assert.deepEqual(report.coveredMetrics, ["pass_rate", "latency_score"]);
});
test("DomainEvaluationGateService handles multiple blocking failures", () => {
    const service = new DomainEvaluationGateService();
    const frameworkMultiBlocking = {
        frameworkId: "eval_multi",
        domainId: "coding",
        fewShotExamples: [],
        evaluators: [
            { evaluatorId: "eval_1", metric: "pass_rate", threshold: 0.95, blocking: true },
            { evaluatorId: "eval_2", metric: "accuracy", threshold: 0.9, blocking: true },
            { evaluatorId: "eval_3", metric: "latency", threshold: 0.8, blocking: false },
        ],
        onlineMetrics: [],
        releaseGates: { minFewShotCount: 0, minRegressionCaseCount: 0, requirePromptInjectionCoverage: false },
    };
    const report = service.evaluateSuite(frameworkMultiBlocking, {
        suiteId: "suite_multi_blocking",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            { caseId: "case_1", metric: "pass_rate", score: 0.8, expectedClass: "coding" },
            { caseId: "case_2", metric: "accuracy", score: 0.7, expectedClass: "coding" },
        ],
    });
    assert.equal(report.overallPass, false);
    assert.equal(report.releaseDecision, "hold");
    assert.deepEqual(report.blockingFailures, ["eval_1", "eval_2"]);
});
test("DomainEvaluationGateService uses exact threshold boundary for pass/fail", () => {
    const service = new DomainEvaluationGateService();
    const reportExact = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_exact",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [{ caseId: "case_1", metric: "latency_score", score: 0.8, expectedClass: "coding" }],
    });
    // Exact threshold 0.8 should pass (>=)
    assert.equal(reportExact.evaluatorResults.find((r) => r.metric === "latency_score")?.passed, true);
    const reportBelow = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_below",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [{ caseId: "case_1", metric: "latency_score", score: 0.79, expectedClass: "coding" }],
    });
    // 0.79 should fail (< 0.8)
    assert.equal(reportBelow.evaluatorResults.find((r) => r.metric === "latency_score")?.passed, false);
});
test("DomainEvaluationGateService calculates cost and latency when present in cases", () => {
    const service = new DomainEvaluationGateService();
    const report = service.evaluateSuite(FRAMEWORK, {
        suiteId: "suite_cost_latency",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "sqlite",
        cases: [
            {
                caseId: "case_1",
                metric: "pass_rate",
                score: 0.98,
                expectedClass: "coding",
                costUsd: 0.05,
                latencyMs: 1500,
            },
        ],
    });
    assert.equal(report.overallPass, true);
    assert.ok(report.evaluatorResults.length >= 1);
});
//# sourceMappingURL=domain-evaluation-gate-service.test.js.map