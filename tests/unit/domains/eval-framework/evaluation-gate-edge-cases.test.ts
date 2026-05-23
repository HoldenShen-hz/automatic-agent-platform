import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainEvaluationGateService,
  type RegressionCaseResult,
  type RegressionSuiteRun,
} from "../../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import { DomainEvalFrameworkSchema } from "../../../../src/domains/eval-framework/index.js";

// ── Helper to create valid framework ──────────────────────────────────────────

function createFramework(
  domainId: string,
  overrides?: {
    minFewShotCount?: number;
    minRegressionCaseCount?: number;
    requirePromptInjectionCoverage?: boolean;
    evaluators?: Array<{
      evaluatorId: string;
      metric: string;
      threshold: number;
      blocking: boolean;
    }>;
    fewShotExamples?: string[];
    onlineMetrics?: string[];
  },
): ReturnType<typeof DomainEvalFrameworkSchema.parse> {
  return DomainEvalFrameworkSchema.parse({
    frameworkId: `fw_${domainId}`,
    domainId,
    evaluators: overrides?.evaluators ?? [
      {
        evaluatorId: "eval_accuracy",
        metric: "accuracy",
        threshold: 0.8,
        blocking: true,
      },
      {
        evaluatorId: "eval_latency",
        metric: "latency_ms",
        threshold: 200,
        blocking: false,
      },
    ],
    fewShotExamples: overrides?.fewShotExamples ?? [
      "example1",
      "example2",
      "example3",
      "example4",
      "example5",
    ],
    onlineMetrics: overrides?.onlineMetrics ?? ["accuracy", "latency_ms"],
    releaseGates: {
      minFewShotCount: overrides?.minFewShotCount ?? 5,
      minRegressionCaseCount: overrides?.minRegressionCaseCount ?? 20,
      requirePromptInjectionCoverage:
        overrides?.requirePromptInjectionCoverage ?? true,
    },
  });
}

function createCase(
  overrides?: Partial<RegressionCaseResult>,
): RegressionCaseResult {
  return {
    caseId: "case_1",
    metric: "accuracy",
    score: 0.9,
    expectedClass: "pass",
    ...overrides,
  };
}

function createRun(
  domainId: string,
  cases: RegressionCaseResult[],
): RegressionSuiteRun {
  return {
    suiteId: "suite_edge",
    domainId,
    releaseType: "daily",
    executionMode: "auto",
    storageMode: "sqlite",
    cases,
  };
}

// ── Edge Case Tests ────────────────────────────────────────────────────────────

test("DomainEvaluationGateService.evaluateSuite throws when cases array is empty", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test");
  const run = createRun("test", []);

  assert.throws(
    () => service.evaluateSuite(framework, run),
    /domain_eval\.empty_regression_suite/,
  );
});

test("DomainEvaluationGateService.evaluateSuite throws on domain ID mismatch", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("domain_a");
  const run = createRun("domain_b", [createCase()]);

  assert.throws(
    () => service.evaluateSuite(framework, run),
    /domain_eval\.domain_mismatch:domain_a:domain_b/,
  );
});

test("DomainEvaluationGateService.evaluateSuite reports multiple blocking failures", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_1",
        metric: "metric_a",
        threshold: 0.9,
        blocking: true,
      },
      {
        evaluatorId: "eval_2",
        metric: "metric_b",
        threshold: 0.9,
        blocking: true,
      },
    ],
  });
  const run = createRun("test", [
    createCase({ metric: "metric_a", score: 0.5 }),
    createCase({ metric: "metric_a", score: 0.5 }),
    createCase({ metric: "metric_b", score: 0.5 }),
    createCase({ metric: "metric_b", score: 0.5 }),
  ]);

  const report = service.evaluateSuite(framework, run);

  assert.equal(report.overallPass, false);
  assert.ok(report.blockingFailures.length >= 2);
  assert.ok(report.blockingFailures.includes("eval_1"));
  assert.ok(report.blockingFailures.includes("eval_2"));
});

test("DomainEvaluationGateService.evaluateSuite reports all gate failures simultaneously", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    minFewShotCount: 10,
    minRegressionCaseCount: 20,
    requirePromptInjectionCoverage: true,
    evaluators: [
      {
        evaluatorId: "eval_1",
        metric: "accuracy",
        threshold: 0.9,
        blocking: true,
      },
    ],
    fewShotExamples: ["only_one"], // Below minFewShotCount of 10
  });
  const run = createRun("test", [
    // Only 5 cases, below minRegressionCaseCount of 20
    createCase({ metric: "accuracy", score: 0.5, approvalMatched: false }),
  ]);

  const report = service.evaluateSuite(framework, run);

  assert.equal(report.fewShotGatePassed, false);
  assert.equal(report.regressionCaseGatePassed, false);
  assert.equal(report.promptInjectionCoveragePassed, false);
  assert.ok(report.blockingFailures.includes("domain_eval.min_few_shot_gate"));
  assert.ok(
    report.blockingFailures.includes("domain_eval.min_regression_case_gate"),
  );
  assert.ok(
    report.blockingFailures.includes("domain_eval.prompt_injection_gate"),
  );
});

test("DomainEvaluationGateService.evaluateSuite handles single case with single metric", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_single",
        metric: "single_metric",
        threshold: 0.5,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "single_metric", score: 0.8 }),
  ]);

  const report = service.evaluateSuite(framework, run);

  assert.equal(report.overallPass, true);
  assert.equal(report.releaseDecision, "promote");
  assert.deepEqual(report.coveredMetrics, ["single_metric"]);
});

test("DomainEvaluationGateService.evaluateSuite calculates average correctly for float scores", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_float",
        metric: "float_metric",
        threshold: 0.9,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 3,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "float_metric", score: 0.333 }),
    createCase({ metric: "float_metric", score: 0.333 }),
    createCase({ metric: "float_metric", score: 0.333 }),
  ]);

  const report = service.evaluateSuite(framework, run);
  const floatResult = report.evaluatorResults.find(
    (r) => r.metric === "float_metric",
  );

  // (0.333 + 0.333 + 0.333) / 3 = 0.332999... rounded to 0.333
  assert.equal(floatResult?.observedScore, 0.333);
});

test("DomainEvaluationGateService.evaluateSuite handles very small threshold differences", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_tiny",
        metric: "tiny_diff",
        threshold: 0.9999,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "tiny_diff", score: 0.9998 }), // Just below threshold
  ]);

  const report = service.evaluateSuite(framework, run);
  assert.equal(report.overallPass, false);
  assert.ok(report.blockingFailures.includes("eval_tiny"));
});

test("DomainEvaluationGateService.evaluateSuite handles zero threshold", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_zero",
        metric: "zero_metric",
        threshold: 0,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "zero_metric", score: 0 }),
  ]);

  const report = service.evaluateSuite(framework, run);
  assert.equal(report.overallPass, true);
});

test("DomainEvaluationGateService.evaluateSuite handles missing online metric", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    onlineMetrics: ["metric_a", "metric_b", "metric_c"],
  });
  const run = createRun("test", [
    createCase({ metric: "metric_a", score: 0.9 }),
    createCase({ metric: "metric_a", score: 0.9 }),
    createCase({ metric: "metric_b", score: 0.9 }),
    createCase({ metric: "metric_b", score: 0.9 }),
  ]);

  const report = service.evaluateSuite(framework, run);

  assert.ok(report.missingOnlineMetrics.includes("metric_c"));
  assert.ok(
    report.nonBlockingFindings.some((f) =>
      f.includes("online_metric_missing:metric_c"),
    ),
  );
});

test("DomainEvaluationGateService.evaluateSuite handles costUsd and latencyMs in case results", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_cost",
        metric: "cost_usd",
        threshold: 10,
        blocking: false,
      },
      {
        evaluatorId: "eval_latency",
        metric: "latency_ms",
        threshold: 100,
        blocking: false,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "cost_usd", score: 5, costUsd: 3.5 }),
    createCase({ metric: "latency_ms", score: 80, latencyMs: 75 }),
  ]);

  const report = service.evaluateSuite(framework, run);

  assert.equal(report.overallPass, true);
  assert.ok(report.coveredMetrics.includes("cost_usd"));
  assert.ok(report.coveredMetrics.includes("latency_ms"));
});

test("DomainEvaluationGateService.evaluateSuite handles releaseType variations", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test");
  const runDaily = {
    ...createRun("test", Array(20).fill(createCase())),
    releaseType: "daily" as const,
  };
  const runPreRelease = {
    ...createRun("test", Array(20).fill(createCase())),
    releaseType: "pre_release" as const,
  };
  const runCanary = {
    ...createRun("test", Array(20).fill(createCase())),
    releaseType: "canary" as const,
  };

  const reportDaily = service.evaluateSuite(framework, runDaily);
  const reportPreRelease = service.evaluateSuite(framework, runPreRelease);
  const reportCanary = service.evaluateSuite(framework, runCanary);

  assert.equal(reportDaily.releaseDecision, "promote");
  assert.equal(reportPreRelease.releaseDecision, "promote");
  assert.equal(reportCanary.releaseDecision, "promote");
});

test("DomainEvaluationGateService.evaluateSuite handles executionMode variations", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test");
  const run = {
    ...createRun("test", Array(20).fill(createCase())),
    executionMode: "full_auto" as const,
  };

  const report = service.evaluateSuite(framework, run);
  assert.equal(report.overallPass, true);
});

test("DomainEvaluationGateService.evaluateSuite handles storageMode variations", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test");

  const runSqlite = {
    ...createRun("test", Array(20).fill(createCase())),
    storageMode: "sqlite" as const,
  };
  const runPostgres = {
    ...createRun("test", Array(20).fill(createCase())),
    storageMode: "postgres" as const,
  };
  const runMixed = {
    ...createRun("test", Array(20).fill(createCase())),
    storageMode: "mixed" as const,
  };

  const reportSqlite = service.evaluateSuite(framework, runSqlite);
  const reportPostgres = service.evaluateSuite(framework, runPostgres);
  const reportMixed = service.evaluateSuite(framework, runMixed);

  assert.equal(reportSqlite.overallPass, true);
  assert.equal(reportPostgres.overallPass, true);
  assert.equal(reportMixed.overallPass, true);
});

test("DomainEvaluationGateService.evaluateSuite handles duplicate metrics in cases", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_dup",
        metric: "dup_metric",
        threshold: 0.7,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 5,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "dup_metric", score: 0.8 }),
    createCase({ metric: "dup_metric", score: 0.8 }),
    createCase({ metric: "dup_metric", score: 0.8 }),
    createCase({ metric: "dup_metric", score: 0.8 }),
    createCase({ metric: "dup_metric", score: 0.8 }),
  ]);

  const report = service.evaluateSuite(framework, run);
  const dupResult = report.evaluatorResults.find(
    (r) => r.metric === "dup_metric",
  );

  // Average of [0.8, 0.8, 0.8, 0.8, 0.8] = 0.8
  assert.equal(dupResult?.observedScore, 0.8);
  assert.equal(dupResult?.passed, true);
});

test("DomainEvaluationGateService.evaluateSuite handles metric with no matching cases", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_no_match",
        metric: "no_match_metric",
        threshold: 0.9,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "different_metric", score: 1.0 }),
  ]);

  const report = service.evaluateSuite(framework, run);
  const noMatchResult = report.evaluatorResults.find(
    (r) => r.metric === "no_match_metric",
  );

  assert.equal(noMatchResult?.observedScore, null);
  assert.equal(noMatchResult?.passed, false);
  assert.ok(report.blockingFailures.includes("eval_no_match"));
});

test("DomainEvaluationGateService.evaluateSuite handles large number of cases", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_large",
        metric: "large_metric",
        threshold: 0.5,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 100,
    requirePromptInjectionCoverage: false,
  });
  const cases = Array(100)
    .fill(null)
    .map((_, i) =>
      createCase({ caseId: `case_${i}`, metric: "large_metric", score: 0.9 }),
    );
  const run = createRun("test", cases);

  const report = service.evaluateSuite(framework, run);
  assert.equal(report.overallPass, true);
  assert.equal(report.coveredMetrics.length, 1);
});

test("DomainEvaluationGateService.evaluateSuite handles exact threshold boundary", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_boundary",
        metric: "boundary_metric",
        threshold: 0.8,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "boundary_metric", score: 0.8 }), // Exactly at threshold
  ]);

  const report = service.evaluateSuite(framework, run);
  // Score is exactly at threshold, should pass (observedScore >= threshold)
  assert.equal(report.overallPass, true);
});

test("DomainEvaluationGateService.evaluateSuite handles evaluator with very high threshold", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_high",
        metric: "high_threshold",
        threshold: 0.99,
        blocking: true,
      },
    ],
    minRegressionCaseCount: 1,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "high_threshold", score: 0.999 }),
  ]);

  const report = service.evaluateSuite(framework, run);
  assert.equal(report.overallPass, true);
});

test("DomainEvaluationGateService.evaluateSuite generates unique report IDs", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test");
  const run = createRun("test", Array(20).fill(createCase()));

  const reports = [
    service.evaluateSuite(framework, run),
    service.evaluateSuite(framework, run),
    service.evaluateSuite(framework, run),
  ];

  const ids = reports.map((r) => r.reportId);
  assert.equal(new Set(ids).size, 3); // All unique
});

test("DomainEvaluationGateService.evaluateSuite sets createdAt timestamp", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test");
  const run = createRun("test", Array(20).fill(createCase()));

  const before = new Date().toISOString();
  const report = service.evaluateSuite(framework, run);
  const after = new Date().toISOString();

  assert.ok(report.createdAt >= before);
  assert.ok(report.createdAt <= after);
});

test("DomainEvaluationGateService reports non-blocking evaluator failures in nonBlockingFindings", () => {
  const service = new DomainEvaluationGateService();
  const framework = createFramework("test", {
    evaluators: [
      {
        evaluatorId: "eval_blocking",
        metric: "blocking_metric",
        threshold: 0.9,
        blocking: true,
      },
      {
        evaluatorId: "eval_non_blocking",
        metric: "non_blocking_metric",
        threshold: 0.9,
        blocking: false,
      },
    ],
    minRegressionCaseCount: 2,
    requirePromptInjectionCoverage: false,
  });
  const run = createRun("test", [
    createCase({ metric: "blocking_metric", score: 0.95 }),
    createCase({ metric: "non_blocking_metric", score: 0.5 }),
  ]);

  const report = service.evaluateSuite(framework, run);

  assert.equal(report.overallPass, true); // Blocking evaluator passes
  assert.ok(
    report.nonBlockingFindings.some((f) =>
      f.includes("eval_non_blocking:below_threshold"),
    ),
  );
});
