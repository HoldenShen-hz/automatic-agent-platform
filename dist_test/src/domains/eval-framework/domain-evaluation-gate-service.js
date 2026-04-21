import { newId, nowIso } from "../../platform/contracts/types/ids.js";
function average(values) {
    if (values.length === 0) {
        return null;
    }
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}
export class DomainEvaluationGateService {
    evaluateSuite(framework, run) {
        if (run.cases.length === 0) {
            throw new Error("domain_eval.empty_regression_suite");
        }
        if (run.domainId !== framework.domainId) {
            throw new Error(`domain_eval.domain_mismatch:${framework.domainId}:${run.domainId}`);
        }
        const coveredMetrics = [...new Set(run.cases.map((item) => item.metric))];
        const evaluatorResults = framework.evaluators.map((evaluator) => {
            const observedScore = average(run.cases.filter((item) => item.metric === evaluator.metric).map((item) => item.score));
            return {
                evaluatorId: evaluator.evaluatorId,
                metric: evaluator.metric,
                threshold: evaluator.threshold,
                observedScore,
                blocking: evaluator.blocking,
                passed: observedScore != null && observedScore >= evaluator.threshold,
            };
        });
        const blockingFailures = evaluatorResults
            .filter((item) => item.blocking && !item.passed)
            .map((item) => item.evaluatorId);
        const missingOnlineMetrics = framework.onlineMetrics.filter((metric) => !coveredMetrics.includes(metric));
        const nonBlockingFindings = [
            ...evaluatorResults
                .filter((item) => !item.blocking && !item.passed)
                .map((item) => `${item.evaluatorId}:below_threshold`),
            ...missingOnlineMetrics.map((metric) => `online_metric_missing:${metric}`),
        ];
        return {
            reportId: newId("release_gate"),
            suiteId: run.suiteId,
            frameworkId: framework.frameworkId,
            domainId: framework.domainId,
            overallPass: blockingFailures.length === 0,
            releaseDecision: blockingFailures.length === 0 ? "promote" : "hold",
            blockingFailures,
            nonBlockingFindings,
            evaluatorResults,
            coveredMetrics,
            missingOnlineMetrics,
            createdAt: nowIso(),
        };
    }
}
//# sourceMappingURL=domain-evaluation-gate-service.js.map