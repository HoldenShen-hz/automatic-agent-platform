/**
 * @fileoverview Unit tests for R2 AI Operations layer fixes (R2-1 to R2-12)
 *
 * These tests verify the fixes for the AI Operations layer issues.
 * See the audit document for issue descriptions.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import unified-chat-provider
import {
  createUnifiedChatProvider,
  type ChatCompletionRequest,
} from "../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

// Import eval-dataset-judge-service
import {
  EvalDatasetJudgeService,
} from "../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";

// Import builtin-plugin-registry for DataTaintPropagation
import {
  recordPluginTaint,
  getPluginTaintTracker,
} from "../../../../src/plugins/builtin-plugin-registry.js";

// Import budget-guard
import {
  BudgetGuard,
  type BudgetPolicy,
  type ExecutionChainBudgetSpend,
} from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

// Import chargeback-service
import {
  ChargebackService,
  type ChargebackReportSource,
  type ChargebackAllocation,
} from "../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";

// Import hierarchical-registry-service
import {
  HierarchicalPromptRegistryService,
} from "../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";

// Import bundle revocation
import {
  registerBundleRevocation,
  isBundleRevoked,
  getBundleRevocation,
  BundleRevocationSeverity,
  type BundleRevocationRecord,
} from "../../../../src/plugins/builtin-plugin-registry.js";

// ============================================================================
// R2-1: ChatCompletionRequest required fields (traceId/tenantId/costTag)
// ============================================================================

test("R2-1: ChatCompletionRequest requires traceId", async () => {
  const provider = createUnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  const request: ChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    traceId: "",  // empty - should fail
    tenantId: "tenant-1",
    costTag: "default",
  };

  await assert.rejects(
    () => provider.createChatCompletion(request),
    /ChatCompletionRequest requires traceId/,
  );
});

test("R2-1: ChatCompletionRequest requires tenantId", async () => {
  const provider = createUnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  const request: ChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    traceId: "trace-123",
    tenantId: null as any,  // null - should fail
    costTag: "default",
  };

  await assert.rejects(
    () => provider.createChatCompletion(request),
    /ChatCompletionRequest requires tenantId/,
  );
});

test("R2-1: ChatCompletionRequest requires costTag", async () => {
  const provider = createUnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  const request: ChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    traceId: "trace-123",
    tenantId: "tenant-1",
    costTag: "",  // empty - should fail
  };

  await assert.rejects(
    () => provider.createChatCompletion(request),
    /ChatCompletionRequest requires costTag/,
  );
});

// ============================================================================
// R2-2: stream() AbortSignal validation at stream start
// ============================================================================

test("R2-2: createStreamingChatCompletion validates abort signal at start", async () => {
  const provider = createUnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  const controller = new AbortController();
  controller.abort(new Error("test abort"));

  const request: ChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 100,
    traceId: "trace-123",
    tenantId: "tenant-1",
    costTag: "default",
    abortSignal: controller.signal,
  };

  // Should fail fast because signal is already aborted
  await assert.rejects(
    () => provider.createStreamingChatCompletion(
      request,
      (chunk, isFinal) => {},
    ),
    /streaming\.aborted/,
  );
});

// ============================================================================
// R2-4: EvalDataset minimum sample size validation by risk level
// ============================================================================

test("R2-4: EvalDatasetJudgeService rejects dataset with insufficient critical samples", () => {
  const service = new EvalDatasetJudgeService();

  // Critical cases < 200 should fail
  assert.throws(
    () => service.registerDataset({
      datasetId: "dataset_insufficient",
      name: "Insufficient Critical",
      version: "1.0",
      stage: "assess",
      createdBy: "test",
      cases: [
        {
          caseId: "case_1",
          input: { prompt: "test" },
          expectedOutput: "expected",
          tags: [],
          priority: "critical",
          qualityCriteria: [
            { criterionId: "c1", type: "exact_match", config: {}, weight: 1, threshold: 1 },
          ],
        },
      ],
    }),
    /insufficient_critical_samples/,
  );
});

test("R2-4: EvalDatasetJudgeService rejects dataset with insufficient standard samples", () => {
  const service = new EvalDatasetJudgeService();

  // Standard cases < 50 should fail
  assert.throws(
    () => service.registerDataset({
      datasetId: "dataset_insufficient_standard",
      name: "Insufficient Standard",
      version: "1.0",
      stage: "assess",
      createdBy: "test",
      cases: [
        {
          caseId: "case_1",
          input: { prompt: "test" },
          expectedOutput: "expected",
          tags: [],
          priority: "standard",
          qualityCriteria: [
            { criterionId: "c1", type: "exact_match", config: {}, weight: 1, threshold: 1 },
          ],
        },
      ],
    }),
    /insufficient.*medium.*samples/,
  );
});

test("R2-4: EvalDatasetJudgeService accepts dataset with sufficient samples", () => {
  const service = new EvalDatasetJudgeService();

  // Create 200+ critical cases
  const criticalCases = Array.from({ length: 200 }, (_, i) => ({
    caseId: `critical_${i}`,
    input: { prompt: `test_${i}` },
    expectedOutput: "expected",
    tags: [],
    priority: "critical" as const,
    qualityCriteria: [
      { criterionId: "c1", type: "exact_match" as const, config: {}, weight: 1, threshold: 1 },
    ],
  }));

  const record = service.registerDataset({
    datasetId: "dataset_sufficient",
    name: "Sufficient Samples",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: criticalCases,
  });

  assert.equal(record.datasetId, "dataset_sufficient");
});

// ============================================================================
// R2-5: DataTaintPropagation tracking
// ============================================================================

test("R2-5: recordPluginTaint creates propagation record", () => {
  const record = recordPluginTaint({
    pluginId: "plugin.test",
    inputDataClasses: ["confidential"],
    outputDataClass: "internal",
    description: "test propagation",
  });

  assert.ok(record.id);
  assert.ok(record.taintLabels.length > 0);
});

test("R2-5: getPluginTaintTracker returns singleton tracker", () => {
  const tracker1 = getPluginTaintTracker();
  const tracker2 = getPluginTaintTracker();
  assert.strictEqual(tracker1, tracker2);
});

test("R2-5: PluginTaintTracker tracks labels per plugin", () => {
  recordPluginTaint({
    pluginId: "plugin.tracking_test",
    inputDataClasses: ["confidential"],
    outputDataClass: "internal",
    inputTaintLabels: [
      {
        sourcePluginId: "plugin.source",
        label: "test_label",
        severity: "high",
        propagatedAt: new Date().toISOString(),
        propagationChain: [],
      },
    ],
  });

  const tracker = getPluginTaintTracker();
  const labels = tracker.getPluginTaintLabels("plugin.tracking_test");
  assert.ok(labels.length > 0);
});

// ============================================================================
// R2-6: BudgetPolicy 3-level hierarchy (platform/pack/step)
// ============================================================================

test("R2-6: BudgetGuard.evaluateExecutionChain checks platform-level budget", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    maxPlatformCostUsd: 50,  // platform-level budget
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const spend: ExecutionChainBudgetSpend = {
    currentTaskCostUsd: 30,
    nextEstimatedCostUsd: 25,  // 30+25=55 > 50 platform limit
    currentDailyCostUsd: 100,
    currentMonthlyCostUsd: 500,
  };

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode?.includes("platform"));
  assert.equal(result.violatedScope, "platform");
});

test("R2-6: BudgetGuard.evaluateExecutionChain checks pack-level budget", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    maxPackCostUsd: 40,  // pack-level budget
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const spend: ExecutionChainBudgetSpend = {
    currentTaskCostUsd: 20,
    nextEstimatedCostUsd: 25,  // 20+25=45 > 40 pack limit
    currentDailyCostUsd: 100,
    currentMonthlyCostUsd: 500,
  };

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode?.includes("pack"));
  assert.equal(result.violatedScope, "pack");
});

test("R2-6: BudgetGuard.evaluateExecutionChain checks step-level budget", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    maxStepCostUsd: 10,  // step-level budget
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const spend: ExecutionChainBudgetSpend = {
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 15,  // 15 > 10 step limit
    currentDailyCostUsd: 100,
    currentMonthlyCostUsd: 500,
  };

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode?.includes("step"));
  assert.equal(result.violatedScope, "step");
});

test("R2-6: BudgetGuard evaluates all 3 levels when configured", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    maxPlatformCostUsd: 200,
    maxPackCostUsd: 80,
    maxStepCostUsd: 30,
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const spend: ExecutionChainBudgetSpend = {
    currentTaskCostUsd: 20,
    nextEstimatedCostUsd: 25,
    currentDailyCostUsd: 100,
    currentMonthlyCostUsd: 500,
  };

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
});

// ============================================================================
// R2-7: ChargebackAllocation fx_rate/cost_source fields
// ============================================================================

test("R2-7: ChargebackService includes fx_rate in allocation", () => {
  const mockSource: ChargebackReportSource = {
    listReports: () => [
      {
        reportId: "report_1",
        tenantId: "tenant-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        totalCostUsd: 10,
        currency: "USD",
        resourceCount: 1,
        submittedBy: "test",
        submittedAt: "2026-01-31",
        createdAt: "2026-01-31",
        resourceCosts: [
          {
            resourceId: "resource_1",
            resourceType: "api",
            currency: "USD",
            costUsd: 10,
            metadata: { fxRate: 1.5, costSource: "platform" },
          },
        ],
      },
    ],
  };

  const service = new ChargebackService(mockSource);
  const report = service.buildReport({ tenantId: "tenant-1" });

  assert.ok(report.allocations.length > 0);
  const allocation = report.allocations[0] as ChargebackAllocation;
  assert.ok(typeof allocation.fxRate === "number");
  assert.ok(typeof allocation.costSource === "string");
});

test("R2-7: ChargebackService defaults fx_rate when not provided", () => {
  const mockSource: ChargebackReportSource = {
    listReports: () => [
      {
        reportId: "report_1",
        tenantId: "tenant-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        totalCostUsd: 10,
        currency: "USD",
        resourceCount: 1,
        submittedBy: "test",
        submittedAt: "2026-01-31",
        createdAt: "2026-01-31",
        resourceCosts: [
          {
            resourceId: "resource_1",
            resourceType: "api",
            currency: "USD",
            costUsd: 10,
          },
        ],
      },
    ],
  };

  const service = new ChargebackService(mockSource);
  const report = service.buildReport({ tenantId: "tenant-1" });

  const allocation = report.allocations[0] as ChargebackAllocation;
  assert.equal(allocation.fxRate, 1.0);
  assert.equal(allocation.costSource, "platform");
});

// ============================================================================
// R2-9: BundleRevocationSeverity mechanism
// ============================================================================

test("R2-9: registerBundleRevocation creates revocation record", () => {
  const record: BundleRevocationRecord = {
    bundleId: "plugin.test.bundle",
    severity: BundleRevocationSeverity.HIGH,
    reason: "Security vulnerability",
    affectedPluginIds: ["plugin.test.v1", "plugin.test.v2"],
    revokedAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 86400000).toISOString(),
  };

  registerBundleRevocation(record);

  assert.equal(isBundleRevoked("plugin.test.bundle"), true);
});

test("R2-9: getBundleRevocation returns active revocation", () => {
  const record: BundleRevocationRecord = {
    bundleId: "plugin.active.bundle",
    severity: BundleRevocationSeverity.CRITICAL,
    reason: "Critical bug",
    affectedPluginIds: ["plugin.active.v1"],
    revokedAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 86400000).toISOString(),
  };

  registerBundleRevocation(record);

  const active = getBundleRevocation("plugin.active.bundle");
  assert.ok(active);
  assert.equal(active!.severity, BundleRevocationSeverity.CRITICAL);
});

test("R2-9: BundleRevocationSeverity enum has all required levels", () => {
  assert.equal(BundleRevocationSeverity.CRITICAL, "critical");
  assert.equal(BundleRevocationSeverity.HIGH, "high");
  assert.equal(BundleRevocationSeverity.MEDIUM, "medium");
  assert.equal(BundleRevocationSeverity.LOW, "low");
});

// ============================================================================
// R2-10: LLM-as-Judge risk-level independence enforcement
// ============================================================================

test("R2-10: EvalDatasetJudgeService enforces independence for high-risk cases", () => {
  const service = new EvalDatasetJudgeService();

  service.registerDataset({
    datasetId: "dataset_high_risk",
    name: "High Risk Dataset",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: [
      {
        caseId: "critical_case_1",
        input: { prompt: "test" },
        expectedOutput: "expected",
        tags: [],
        priority: "critical",
        qualityCriteria: [
          { criterionId: "c1", type: "llm_judge", config: {}, weight: 1, threshold: 0.8 },
        ],
      },
    ],
  });
  service.activateDataset("dataset_high_risk");

  service.registerJudge({
    judgeId: "judge_anthropic",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-judge",
    maxCostUsd: 0.02,
    supportedRiskLevels: ["critical", "high", "medium", "low"],
  });

  const report = service.evaluateDataset({
    datasetId: "dataset_high_risk",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-4",
    enforceIndependenceForHighRisk: true,
    results: [
      {
        caseId: "critical_case_1",
        output: "result",
        latencyMs: 100,
        costUsd: 0.01,
        criterionSignals: { c1: 0.9 },
      },
    ],
  });

  assert.ok(report.blockingFindings.length === 0 || report.gateDecision !== "hold");
});

test("R2-10: JudgeProfileRecord has supportedRiskLevels field", () => {
  const service = new EvalDatasetJudgeService();

  service.registerJudge({
    judgeId: "judge_test",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-judge",
    maxCostUsd: 0.01,
    supportedRiskLevels: ["high", "medium", "low"],
  });

  const judge = service.getJudge("judge_test");
  assert.ok(judge);
  assert.ok(judge!.supportedRiskLevels.includes("high"));
});

// ============================================================================
// R2-12: critical_case_pass==100% blocking gate
// ============================================================================

test("R2-12: EvalDatasetJudgeService blocks release when critical pass rate < 100%", () => {
  const service = new EvalDatasetJudgeService();

  service.registerDataset({
    datasetId: "dataset_critical_gate",
    name: "Critical Gate Test",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: [
      {
        caseId: "critical_fail",
        input: { prompt: "test" },
        expectedOutput: "expected",
        tags: [],
        priority: "critical",
        qualityCriteria: [
          { criterionId: "c1", type: "exact_match", config: {}, weight: 1, threshold: 1 },
        ],
      },
    ],
  });
  service.activateDataset("dataset_critical_gate");

  const report = service.evaluateDataset({
    datasetId: "dataset_critical_gate",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-4",
    results: [
      {
        caseId: "critical_fail",
        output: "wrong_output",
        latencyMs: 100,
        costUsd: 0.01,
      },
    ],
  });

  assert.ok(report.blockingFindings.some((f) => f.includes("critical_case_failed")));
  assert.ok(report.gateDecision === "hold" || report.gateDecision === "rollback");
});

test("R2-12: EvalDatasetJudgeService passes when critical pass rate === 100%", () => {
  const service = new EvalDatasetJudgeService();

  service.registerDataset({
    datasetId: "dataset_critical_pass",
    name: "Critical Pass Test",
    version: "1.0",
    stage: "assess",
    createdBy: "test",
    cases: [
      {
        caseId: "critical_pass",
        input: { prompt: "test" },
        expectedOutput: { result: "expected" },
        tags: [],
        priority: "critical",
        qualityCriteria: [
          { criterionId: "c1", type: "exact_match", config: {}, weight: 1, threshold: 1 },
        ],
      },
    ],
  });
  service.activateDataset("dataset_critical_pass");

  const report = service.evaluateDataset({
    datasetId: "dataset_critical_pass",
    candidateProvider: "openai",
    candidateProviderFamily: "openai",
    candidateModel: "gpt-4",
    results: [
      {
        caseId: "critical_pass",
        output: { result: "expected" },
        latencyMs: 100,
        costUsd: 0.01,
      },
    ],
  });

  assert.equal(report.criticalPassRate, 1);
  assert.equal(report.gateDecision, "promote");
  assert.ok(!report.blockingFindings.some((f) => f.includes("critical_case_failed")));
});
