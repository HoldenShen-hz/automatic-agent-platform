import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { type DomainEvalFramework } from "./index.js";

export interface RegressionCaseResult {
  readonly caseId: string;
  readonly metric: string;
  readonly score: number;
  readonly expectedClass: string;
  readonly costUsd?: number;
  readonly latencyMs?: number;
  readonly approvalMatched?: boolean;
}

export interface RegressionSuiteRun {
  readonly suiteId: string;
  readonly domainId: string;
  readonly releaseType: "daily" | "pre_release" | "canary";
  readonly executionMode: "supervised" | "auto" | "full_auto";
  readonly storageMode: "sqlite" | "postgres" | "mixed";
  readonly cases: readonly RegressionCaseResult[];
}

export interface EvaluatorGateResult {
  readonly evaluatorId: string;
  readonly metric: string;
  readonly threshold: number;
  readonly observedScore: number | null;
  readonly blocking: boolean;
  readonly passed: boolean;
}

export interface ReleaseGateReport {
  readonly reportId: string;
  readonly suiteId: string;
  readonly frameworkId: string;
  readonly domainId: string;
  readonly overallPass: boolean;
  readonly releaseDecision: "promote" | "hold";
  readonly blockingFailures: readonly string[];
  readonly nonBlockingFindings: readonly string[];
  readonly evaluatorResults: readonly EvaluatorGateResult[];
  readonly coveredMetrics: readonly string[];
  readonly missingOnlineMetrics: readonly string[];
  readonly fewShotGatePassed: boolean;
  readonly regressionCaseGatePassed: boolean;
  readonly promptInjectionCoveragePassed: boolean;
  readonly createdAt: string;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

export class DomainEvaluationGateService {
  public evaluateSuite(framework: DomainEvalFramework, run: RegressionSuiteRun): ReleaseGateReport {
    if (run.cases.length === 0) {
      throw new Error("domain_eval.empty_regression_suite");
    }
    if (run.domainId !== framework.domainId) {
      throw new Error(`domain_eval.domain_mismatch:${framework.domainId}:${run.domainId}`);
    }

    const coveredMetrics = [...new Set(run.cases.map((item) => item.metric))];
    const promptInjectionCoveragePassed = framework.releaseGates.requirePromptInjectionCoverage
      ? run.cases.every((item) => item.approvalMatched !== false)
      : true;
    const fewShotGatePassed = framework.fewShotExamples.length >= framework.releaseGates.minFewShotCount;
    const regressionCaseGatePassed = run.cases.length >= framework.releaseGates.minRegressionCaseCount;
    const evaluatorResults: EvaluatorGateResult[] = framework.evaluators.map((evaluator) => {
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
    if (!fewShotGatePassed) {
      blockingFailures.push("domain_eval.min_few_shot_gate");
    }
    if (!regressionCaseGatePassed) {
      blockingFailures.push("domain_eval.min_regression_case_gate");
    }
    if (!promptInjectionCoveragePassed) {
      blockingFailures.push("domain_eval.prompt_injection_gate");
    }
    const missingOnlineMetrics = framework.onlineMetrics.filter((metric) => !coveredMetrics.includes(metric));
    const nonBlockingFindings = [
      ...evaluatorResults
        .filter((item) => !item.blocking && !item.passed)
        .map((item) => `${item.evaluatorId}:below_threshold`),
      ...missingOnlineMetrics.map((metric) => `online_metric_missing:${metric}`),
      ...(fewShotGatePassed ? [] : ["few_shot_examples_below_minimum"]),
      ...(regressionCaseGatePassed ? [] : ["regression_cases_below_minimum"]),
      ...(promptInjectionCoveragePassed ? [] : ["prompt_injection_coverage_incomplete"]),
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
      fewShotGatePassed,
      regressionCaseGatePassed,
      promptInjectionCoveragePassed,
      createdAt: nowIso(),
    };
  }
}
