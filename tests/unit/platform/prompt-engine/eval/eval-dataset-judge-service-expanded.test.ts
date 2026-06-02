import assert from "node:assert/strict";
import test from "node:test";

import { EvalDatasetJudgeService } from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import type {
  EvalCasePriority,
  EvalCaseSubmission,
  EvalDatasetCase,
} from "../../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

function generateCasesByPriority(
  priority: EvalCasePriority,
  count: number,
  prefix: string,
  criterionType: "exact_match" | "contains" | "json_schema" | "llm_judge",
): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [];
  for (let i = 0; i < count; i++) {
    const caseId = `${prefix}${priority}-${i}`;
    let config: Record<string, unknown> = {};
    let expectedOutput: unknown = "ok";
    let criterionId = `crit-${priority}-${i}`;

    switch (criterionType) {
      case "contains":
        config = { substring: "ok" };
        break;
      case "json_schema":
        config = { requiredKeys: ["status"] };
        expectedOutput = { status: "ok" };
        break;
      case "llm_judge":
        config = { judgeEvaluatorId: "llm_judge_default" };
        criterionId = `llm-${criterionId}`;
        break;
    }

    cases.push({
      caseId,
      input: { question: `test ${i}` },
      expectedOutput,
      tags: [],
      priority,
      qualityCriteria: [
        {
          criterionId,
          type: criterionType,
          config,
          weight: 1,
          threshold: criterionType === "llm_judge" ? 0.8 : 1,
        },
      ],
    });
  }
  return cases;
}

function buildPassingResults(
  cases: readonly EvalDatasetCase[],
  customize?: (input: { testCase: EvalDatasetCase; index: number; submission: EvalCaseSubmission }) => EvalCaseSubmission,
): EvalCaseSubmission[] {
  return cases.map((testCase, index) => {
    const criterion = testCase.qualityCriteria[0];
    let output = testCase.expectedOutput ?? "ok";
    let criterionSignals: Record<string, number> | undefined;

    switch (criterion?.type) {
      case "contains":
        output = String((criterion.config.substring as string | undefined) ?? "ok");
        break;
      case "json_schema":
        output = { ...(typeof testCase.expectedOutput === "object" && testCase.expectedOutput != null ? testCase.expectedOutput as Record<string, unknown> : {}), extra: "data" };
        break;
      case "llm_judge":
        output = "ok";
        criterionSignals = { [criterion.criterionId]: 0.9 };
        break;
      default:
        break;
    }

    const submission: EvalCaseSubmission = {
      caseId: testCase.caseId,
      output,
      ...(criterionSignals != null ? { criterionSignals } : {}),
    };
    return customize?.({ testCase, index, submission }) ?? submission;
  });
}

function createService(): EvalDatasetJudgeService {
  return new EvalDatasetJudgeService({
    llm_judge_default: ({ criterion, criterionSignals }) => ({
      score: criterionSignals[criterion.criterionId] ?? 0,
    }),
  });
}

function createMinimalDataset(service: EvalDatasetJudgeService): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [
    ...generateCasesByPriority("critical", 200, "ds1-", "exact_match"),
    ...generateCasesByPriority("standard", 50, "ds1-json-", "json_schema"),
    ...generateCasesByPriority("standard", 50, "ds1-judge-", "llm_judge"),
  ];

  service.registerDataset({
    datasetId: "test-dataset",
    name: "Test Dataset",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset("test-dataset");
  service.registerJudge({
    judgeId: "minimal-dataset-judge",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.01,
    status: "ready",
  });
  return cases;
}

function createSmallDataset(service: EvalDatasetJudgeService, datasetId: string): EvalDatasetCase[] {
  const cases: EvalDatasetCase[] = [
    ...generateCasesByPriority("standard", 50, `${datasetId}-`, "exact_match"),
  ];

  service.registerDataset({
    datasetId,
    name: `Small Dataset ${datasetId}`,
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset(datasetId);
  return cases;
}

test("EvalDatasetJudgeService registerDataset throws on duplicate datasetId", () => {
  const service = createService();
  createSmallDataset(service, "dup-id-test");

  assert.throws(
    () => createSmallDataset(service, "dup-id-test"),
    /already registered/,
  );
});

test("EvalDatasetJudgeService registerDataset throws on insufficient samples per priority", () => {
  const service = createService();
  assert.throws(
    () =>
      service.registerDataset({
        datasetId: "insufficient",
        name: "Insufficient",
        version: "1.0.0",
        stage: "assess",
        createdBy: "quality",
        sampleRequirements: { critical: 200 },
        cases: generateCasesByPriority("critical", 10, "insuff-", "exact_match"),
      }),
    /requires at least 200 samples/,
  );
});

test("EvalDatasetJudgeService registerDataset throws on duplicate caseId", () => {
  const service = createService();
  assert.throws(
    () =>
      service.registerDataset({
        datasetId: "dup-cases",
        name: "Dup Cases",
        version: "1.0.0",
        stage: "assess",
        createdBy: "quality",
        cases: [
          ...generateCasesByPriority("standard", 50, "dup-", "exact_match"),
          {
            caseId: "dup-standard-0",
            input: {},
            tags: [],
            priority: "standard",
            qualityCriteria: [
              { criterionId: "crit1", type: "exact_match" as const, config: {}, weight: 1, threshold: 1 },
            ],
          },
        ],
      }),
    /must be unique/,
  );
});

test("EvalDatasetJudgeService evaluateDataset throws on inactive dataset", () => {
  const service = createService();
  service.registerDataset({
    datasetId: "inactive-ds",
    name: "Inactive DS",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases: generateCasesByPriority("critical", 200, "inactive-", "exact_match"),
  });

  assert.throws(
    () =>
      service.evaluateDataset({
        datasetId: "inactive-ds",
        candidateProvider: "openai",
        candidateModel: "gpt-test",
        results: [],
      }),
    /must be active/,
  );
});

test("EvalDatasetJudgeService evaluateDataset succeeds with full dataset", () => {
  const service = createService();
  const cases = createMinimalDataset(service);

  const report = service.evaluateDataset({
    datasetId: "test-dataset",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: buildPassingResults(cases),
  });

  assert.equal(report.gateDecision, "promote");
  assert.equal(report.caseResults.length, cases.length);
});

test("EvalDatasetJudgeService evaluateDataset exact_match criterion", () => {
  const service = createService();
  createSmallDataset(service, "exact-test");

  const report = service.evaluateDataset({
    datasetId: "exact-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "exact-test-standard-0", output: "ok" }],
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "exact_match_passed");
});

test("EvalDatasetJudgeService evaluateDataset exact_match criterion fails", () => {
  const service = createService();
  createSmallDataset(service, "exact-fail-test");

  const report = service.evaluateDataset({
    datasetId: "exact-fail-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "exact-fail-test-standard-0", output: "wrong" }],
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "exact_match_failed");
});

test("EvalDatasetJudgeService evaluateDataset contains criterion", () => {
  const service = createService();
  const cases: EvalDatasetCase[] = generateCasesByPriority("standard", 50, "contains-", "contains");
  service.registerDataset({
    datasetId: "contains-test",
    name: "Contains Test",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset("contains-test");

  const report = service.evaluateDataset({
    datasetId: "contains-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "contains-standard-0", output: "it is ok now" }],
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "contains_passed");
});

test("EvalDatasetJudgeService evaluateDataset contains criterion fails", () => {
  const service = createService();
  const cases: EvalDatasetCase[] = generateCasesByPriority("standard", 50, "contains-fail-", "contains");
  service.registerDataset({
    datasetId: "contains-fail-test",
    name: "Contains Fail Test",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset("contains-fail-test");

  const report = service.evaluateDataset({
    datasetId: "contains-fail-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "contains-fail-standard-0", output: "something else" }],
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "contains_failed");
});

test("EvalDatasetJudgeService evaluateDataset json_schema criterion", () => {
  const service = createService();
  const cases: EvalDatasetCase[] = generateCasesByPriority("standard", 50, "json-", "json_schema");
  service.registerDataset({
    datasetId: "json-test",
    name: "JSON Test",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset("json-test");

  const report = service.evaluateDataset({
    datasetId: "json-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "json-standard-0", output: { status: "ok", extra: "data" } }],
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "json_schema_passed");
});

test("EvalDatasetJudgeService evaluateDataset json_schema criterion fails when key missing", () => {
  const service = createService();
  const cases: EvalDatasetCase[] = generateCasesByPriority("standard", 50, "json-fail-", "json_schema");
  service.registerDataset({
    datasetId: "json-fail-test",
    name: "JSON Fail Test",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset("json-fail-test");

  const report = service.evaluateDataset({
    datasetId: "json-fail-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "json-fail-standard-0", output: { other: "value" } }],
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.reason, "json_schema_failed");
});

test("EvalDatasetJudgeService evaluateDataset adds missing_case_result blocking finding", () => {
  const service = createService();
  createMinimalDataset(service);

  const report = service.evaluateDataset({
    datasetId: "test-dataset",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [],
  });

  assert.ok(report.blockingFindings.some((f) => f.startsWith("missing_case_result")));
  assert.equal(report.gateDecision, "hold");
});

test("EvalDatasetJudgeService evaluateDataset applies custom gate policy", () => {
  const service = createService();
  const cases = createSmallDataset(service, "gate-policy-test");

  const report = service.evaluateDataset({
    datasetId: "gate-policy-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: buildPassingResults(cases),
    gatePolicy: {
      minPassRate: 1,
      requireCriticalPass: true,
      maxLatencyRegressionRatio: 2.0,
      maxCostRegressionRatio: 3.0,
      minQualityDelta: -0.1,
    },
  });

  assert.equal(report.gateDecision, "promote");
});

test("EvalDatasetJudgeService evaluateDataset applies baseline regression checks", () => {
  const service = createService();
  const cases = createSmallDataset(service, "baseline-test");

  const report = service.evaluateDataset({
    datasetId: "baseline-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    baseline: {
      averageLatencyMs: 10,
      averageCostUsd: 0.001,
      weightedQualityScore: 1.0,
    },
    results: buildPassingResults(cases, ({ index, submission }) => ({
      ...submission,
      output: index < 3 ? "wrong" : submission.output,
      latencyMs: 100,
      costUsd: 0.01,
    })),
  });

  assert.ok(report.blockingFindings.some((f) => f.startsWith("latency_regressed")));
  assert.ok(report.blockingFindings.some((f) => f.startsWith("cost_regressed")));
  assert.ok(report.blockingFindings.some((f) => f.startsWith("quality_score_regressed")));
});

test("EvalDatasetJudgeService listDatasets filters by status", () => {
  const service = createService();
  createSmallDataset(service, "list-test");

  const all = service.listDatasets();
  assert.equal(all.length, 1);

  const active = service.listDatasets("active");
  assert.equal(active.length, 1);

  const draft = service.listDatasets("draft");
  assert.equal(draft.length, 0);
});

test("EvalDatasetJudgeService listReports returns reports for dataset", () => {
  const service = createService();
  createSmallDataset(service, "reports-test");

  service.evaluateDataset({
    datasetId: "reports-test",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: [{ caseId: "reports-test-standard-0", output: "ok" }],
  });

  const reports = service.listReports("reports-test");
  assert.equal(reports.length, 1);

  const allReports = service.listReports();
  assert.ok(allReports.length >= 1);
});

test("EvalDatasetJudgeService registerJudge throws on duplicate judgeId", () => {
  const service = createService();
  service.registerJudge({
    judgeId: "dup-judge",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-judge",
    maxCostUsd: 0.01,
  });

  assert.throws(
    () =>
      service.registerJudge({
        judgeId: "dup-judge",
        provider: "anthropic",
        providerFamily: "anthropic",
        modelId: "claude-judge",
        maxCostUsd: 0.02,
      }),
    /already registered/,
  );
});

test("EvalDatasetJudgeService suggestJudges filters by required capability", () => {
  const service = createService();
  service.registerJudge({
    judgeId: "judge-llm",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    capabilities: ["llm_judge"],
    maxCostUsd: 0.01,
    status: "ready",
  });
  service.registerJudge({
    judgeId: "judge-safety",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-safety",
    capabilities: ["safety_review"],
    maxCostUsd: 0.01,
    status: "ready",
  });

  const llmJudges = service.suggestJudges({
    candidateProvider: "minimax",
    candidateProviderFamily: "minimax",
    requiredCapability: "llm_judge",
  });

  assert.equal(llmJudges.length, 1);
  assert.equal(llmJudges[0]?.judgeId, "judge-llm");
});

test("EvalDatasetJudgeService suggestJudges excludes judges from same provider family", () => {
  const service = createService();
  service.registerJudge({
    judgeId: "judge-openai",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-judge",
    maxCostUsd: 0.01,
    status: "ready",
  });
  service.registerJudge({
    judgeId: "judge-anthropic",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.02,
    status: "ready",
  });

  const judges = service.suggestJudges({
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
  });

  assert.equal(judges.length, 1);
  assert.equal(judges[0]?.judgeId, "judge-anthropic");
});

test("EvalDatasetJudgeService suggestJudges excludes non-ready judges", () => {
  const service = createService();
  service.registerJudge({
    judgeId: "judge-ready",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-ready",
    maxCostUsd: 0.01,
    status: "ready",
  });
  service.registerJudge({
    judgeId: "judge-cooldown",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-cooldown",
    maxCostUsd: 0.01,
    status: "cooldown",
  });

  const judges = service.suggestJudges({
    candidateProvider: "minimax",
    candidateProviderFamily: "minimax",
  });

  assert.equal(judges.length, 1);
  assert.equal(judges[0]?.judgeId, "judge-ready");
});

test("EvalDatasetJudgeService evaluateDataset with llm_judge criterion uses judge signals", () => {
  const service = createService();
  const cases: EvalDatasetCase[] = generateCasesByPriority("standard", 50, "llm-", "llm_judge");
  service.registerDataset({
    datasetId: "llm-judge-ds",
    name: "LLM Judge DS",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases,
  });
  service.activateDataset("llm-judge-ds");
  service.registerJudge({
    judgeId: "ext-judge",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.01,
    status: "ready",
  });

  const report = service.evaluateDataset({
    datasetId: "llm-judge-ds",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-test",
    results: buildPassingResults(cases),
  });

  assert.equal(report.caseResults[0]?.criterionResults[0]?.score, 0.9);
  assert.equal(report.caseResults[0]?.criterionResults[0]?.passed, true);
});

test("EvalDatasetJudgeService getDataset returns null for nonexistent", () => {
  const service = createService();
  assert.equal(service.getDataset("nonexistent"), null);
});

test("EvalDatasetJudgeService getJudge returns null for nonexistent", () => {
  const service = createService();
  assert.equal(service.getJudge("nonexistent"), null);
});

test("EvalDatasetJudgeService activateDataset changes status", () => {
  const service = createService();
  service.registerDataset({
    datasetId: "to-activate",
    name: "To Activate",
    version: "1.0.0",
    stage: "assess",
    createdBy: "quality",
    cases: generateCasesByPriority("critical", 200, "act-", "exact_match"),
  });

  const activated = service.activateDataset("to-activate");
  assert.equal(activated.status, "active");

  const reRetrieved = service.getDataset("to-activate");
  assert.equal(reRetrieved?.status, "active");
});
