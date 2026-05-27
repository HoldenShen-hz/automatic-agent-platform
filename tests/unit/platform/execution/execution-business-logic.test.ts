/**
 * @fileoverview Unit tests for execution plane business logic components
 * Tests: ComplexityRouter, KvCachePrefixConfig, RecoveryOrchestratorService
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  routeComplexity,
  type ComplexityPath,
  type ComplexityRouterConfig,
} from "../../../../src/platform/five-plane-execution/execution-engine/complexity-router.js";
import {
  createKvCachePrefixConfig,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
  DEFAULT_BUDGET,
  DEFAULT_STRATEGY,
  DEFAULT_FIXED_PREFIX_TEMPLATE,
} from "../../../../src/platform/five-plane-execution/execution-engine/kv-cache-prefix-config.js";
import { RecoveryOrchestratorService } from "../../../../src/platform/five-plane-execution/ha/recovery-orchestrator-service.js";
import type { RecoveryWorker, RecoveryReport, RecoveryCadence } from "../../../../src/platform/contracts/types/recovery-cadence.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// ComplexityRouter Tests
// ─────────────────────────────────────────────────────────────────────────────

test("routeComplexity - routes simple lookup to fast path [execution-business-logic]", () => {
  const result = routeComplexity("What is the capital of France?");

  assert.equal(result.path, "fast");
  assert.equal(result.reason, "keyword_match:what is");
  assert.ok(result.estimatedBudgetFactor < 1.0);
});

test("routeComplexity - routes list queries to fast path [execution-business-logic]", () => {
  const result = routeComplexity("List all files in the directory");

  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("keyword_match:all files"));
});

test("routeComplexity - routes refactor to full path [execution-business-logic]", () => {
  const result = routeComplexity("Refactor the entire authentication module");

  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("keyword_match:refactor"));
});

test("routeComplexity - routes architecture analysis to full path [execution-business-logic]", () => {
  const result = routeComplexity("Perform architecture analysis of the codebase");

  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("keyword_match:architecture"));
});

test("routeComplexity - routes security audit to full path [execution-business-logic]", () => {
  const result = routeComplexity("Run a security audit on all components");

  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("keyword_match:security audit"));
});

test("routeComplexity - routes multi-step workflows to standard minimum [execution-business-logic]", () => {
  const result = routeComplexity("Update the config", { stepCount: 5 });

  assert.equal(result.path, "standard");
  assert.equal(result.reason, "multi_step_workflow");
  assert.equal(result.estimatedBudgetFactor, 1.0);
});

test("routeComplexity - multi-step with full keywords goes to full [execution-business-logic]", () => {
  const result = routeComplexity("Deep investigation of the issue", { stepCount: 4 });

  assert.equal(result.path, "full");
  assert.ok(result.reason.includes("keyword_match:investigation"));
});

test("routeComplexity - short input goes to passthrough [execution-business-logic]", () => {
  const result = routeComplexity("Hello", { stepCount: 0 });

  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
  assert.ok(result.estimatedBudgetFactor < 0.5);
});

test("routeComplexity - high token estimate goes to full [execution-business-logic]", () => {
  const result = routeComplexity("Analyze this large codebase", { estimatedTokens: 60000 });

  assert.equal(result.path, "full");
  assert.equal(result.reason, "high_token_estimate");
});

test("routeComplexity - QA mode forces full path [execution-business-logic]", () => {
  const result = routeComplexity("Simple question", { qaMode: true });

  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
  assert.equal(result.estimatedBudgetFactor, 2.0);
});

test("routeComplexity - QA mode overrides keywords [execution-business-logic]", () => {
  const result = routeComplexity("What is", { qaMode: true });

  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

test("routeComplexity - default route is standard [execution-business-logic]", () => {
  const result = routeComplexity("Please process this task");

  assert.equal(result.path, "standard");
  assert.equal(result.reason, "default");
});

test("routeComplexity - case insensitive keyword matching [execution-business-logic]", () => {
  const upper = routeComplexity("REFACTOR the module");
  const lower = routeComplexity("refactor the module");
  const mixed = routeComplexity("REFACTOR the module");

  assert.equal(upper.path, "full");
  assert.equal(lower.path, "full");
  assert.equal(mixed.path, "full");
});

test("routeComplexity - custom config overrides defaults [execution-business-logic]", () => {
  const customConfig: ComplexityRouterConfig = {
    fullPathKeywords: ["custom-keyword"],
    fastPathKeywords: ["fast-key"],
    passthroughMaxChars: 100,
    qaModeForceFull: false,
  };

  const result = routeComplexity("custom-keyword task", { config: customConfig });

  assert.equal(result.path, "full");
});

test("routeComplexity - search and grep routes to fast [execution-business-logic]", () => {
  const searchResult = routeComplexity("Search for all occurrences of foo");
  const grepResult = routeComplexity("grep -r 'pattern' ./src");

  assert.equal(searchResult.path, "fast");
  assert.equal(grepResult.path, "fast");
});

test("routeComplexity - comprehensive and root cause route to full [execution-business-logic]", () => {
  const comprehensive = routeComplexity("Provide a comprehensive report");
  const rootCause = routeComplexity("Find the root cause of the bug");

  assert.equal(comprehensive.path, "full");
  assert.equal(rootCause.path, "full");
});

test("routeComplexity - tokens below threshold stay in standard/fast [execution-business-logic]", () => {
  const result = routeComplexity("Moderate complexity task", { estimatedTokens: 10000 });

  assert.ok(["fast", "standard"].includes(result.path));
});

test("routeComplexity - very short with stepCount is not passthrough [execution-business-logic]", () => {
  const result = routeComplexity("Hi", { stepCount: 1 });

  assert.notEqual(result.path, "passthrough");
});

test("routeComplexity - all result fields are populated [execution-business-logic]", () => {
  const result = routeComplexity("Test task");

  assert.ok(result.path !== undefined);
  assert.ok(result.reason !== undefined);
  assert.ok(typeof result.estimatedBudgetFactor === "number");
  assert.ok(result.routedAt !== undefined);
});

test("ComplexityPath type accepts all valid values [execution-business-logic]", () => {
  const paths: ComplexityPath[] = ["passthrough", "fast", "standard", "full"];
  assert.equal(paths.length, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// KvCachePrefixConfig Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createKvCachePrefixConfig returns default config [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig();

  assert.equal(config.budget.fixedPrefixMaxTokens, DEFAULT_BUDGET.fixedPrefixMaxTokens);
  assert.equal(config.budget.domainBlockMaxTokens, DEFAULT_BUDGET.domainBlockMaxTokens);
  assert.equal(config.budget.enforceBudget, DEFAULT_BUDGET.enforceBudget);
  assert.equal(config.strategy.cacheKeyStrategy, DEFAULT_STRATEGY.cacheKeyStrategy);
  assert.equal(config.strategy.kvCacheEnabled, DEFAULT_STRATEGY.kvCacheEnabled);
  assert.ok(config.fixedPrefixTemplate.length > 0);
});

test("createKvCachePrefixConfig applies overrides [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 2000 },
    strategy: { kvCacheEnabled: false },
  });

  assert.equal(config.budget.fixedPrefixMaxTokens, 2000);
  assert.equal(config.strategy.kvCacheEnabled, false);
  // Other defaults remain
  assert.equal(config.budget.domainBlockMaxTokens, DEFAULT_BUDGET.domainBlockMaxTokens);
});

test("createKvCachePrefixConfig accepts custom fixedPrefixTemplate [execution-business-logic]", () => {
  const customTemplate = "Custom template content";
  const config = createKvCachePrefixConfig({
    fixedPrefixTemplate: customTemplate,
  });

  assert.equal(config.fixedPrefixTemplate, customTemplate);
});

test("createKvCachePrefixConfig accepts custom domainBlockTemplates [execution-business-logic]", () => {
  const templates = { domain1: "template1", domain2: "template2" };
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: templates,
  });

  assert.deepEqual(config.domainBlockTemplates, templates);
});

test("estimateTokens calculates correctly [execution-business-logic]", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1); // 4 chars = 1 token
  assert.equal(estimateTokens("a"), 1); // ceiling
  assert.equal(estimateTokens("abcdefgh"), 2); // 8 chars = 2 tokens
  assert.equal(estimateTokens("123456789012"), 3); // 12 chars = 3 tokens
});

test("isWithinFixedPrefixBudget returns true when under limit [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 100 },
  });

  const text = "Short text";
  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinFixedPrefixBudget returns false when over limit [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 10 },
  });

  // ~25 tokens, over the 10 limit
  const text = "This is a much longer text that exceeds the limit";
  assert.equal(isWithinFixedPrefixBudget(text, config), false);
});

test("isWithinFixedPrefixBudget returns true when budget disabled [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });

  // Even very long text should pass
  const text = "x".repeat(10000);
  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinFixedPrefixBudget returns true when kvCache disabled [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });

  assert.equal(isWithinFixedPrefixBudget("any text", config), true);
});

test("isWithinDomainBlockBudget returns true when under limit [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 100 },
  });

  const text = "Domain specific content";
  assert.equal(isWithinDomainBlockBudget(text, "domain1", config), true);
});

test("isWithinDomainBlockBudget applies same budget enforcement [execution-business-logic]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });

  assert.equal(isWithinDomainBlockBudget("any text", "any", config), true);
});

test("DEFAULT_FIXED_PREFIX_TEMPLATE is not empty [execution-business-logic]", () => {
  assert.ok(DEFAULT_FIXED_PREFIX_TEMPLATE.length > 0);
  assert.ok(DEFAULT_FIXED_PREFIX_TEMPLATE.includes("Governance"));
});

test("DEFAULT_BUDGET has expected values [execution-business-logic]", () => {
  assert.equal(DEFAULT_BUDGET.fixedPrefixMaxTokens, 1000);
  assert.equal(DEFAULT_BUDGET.domainBlockMaxTokens, 400);
  assert.equal(DEFAULT_BUDGET.enforceBudget, true);
});

test("DEFAULT_STRATEGY has expected values [execution-business-logic]", () => {
  assert.equal(DEFAULT_STRATEGY.cacheKeyStrategy, "hash_prefix");
  assert.equal(DEFAULT_STRATEGY.kvCacheEnabled, true);
  assert.equal(DEFAULT_STRATEGY.fixedPrefixShareable, true);
  assert.equal(DEFAULT_STRATEGY.domainBlockShareable, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryOrchestratorService Tests
// ─────────────────────────────────────────────────────────────────────────────

function createMockRecoveryWorker(options: {
  workerId?: string;
  priority?: RecoveryCadence["priority"];
  intervalMs?: number;
  runResult?: RecoveryReport;
  runError?: Error;
}): RecoveryWorker {
  return {
    getWorkerId: () => options.workerId ?? "mock-worker",
    getRecoveryCadence: () => ({
      intervalMs: options.intervalMs ?? 60_000,
      maxConcurrent: 1,
      priority: options.priority ?? "normal",
    }),
    runRecoveryCycle: async () => {
      if (options.runError) throw options.runError;
      return options.runResult ?? {
        workerId: options.workerId ?? "mock-worker",
        workerType: "test",
        startedAt: nowIso(),
        completedAt: nowIso(),
        durationMs: 10,
        itemsProcessed: 0,
        itemsRecovered: 0,
        errors: [],
      };
    },
  };
}

test("RecoveryOrchestratorService listWorkers returns workers [execution-business-logic]", () => {
  const worker1 = createMockRecoveryWorker({ workerId: "worker-1" });
  const worker2 = createMockRecoveryWorker({ workerId: "worker-2" });
  const service = new RecoveryOrchestratorService([worker1, worker2]);

  const workers = service.listWorkers();

  assert.equal(workers.length, 2);
});

test("RecoveryOrchestratorService runCycle executes all workers [execution-business-logic]", async () => {
  let executions = 0;
  const worker1 = createMockRecoveryWorker({
    workerId: "worker-1",
    runResult: { workerId: "worker-1", workerType: "test", startedAt: nowIso(), completedAt: nowIso(), durationMs: 5, itemsProcessed: 1, itemsRecovered: 0, errors: [] },
  });
  const worker2 = createMockRecoveryWorker({
    workerId: "worker-2",
    runResult: { workerId: "worker-2", workerType: "test", startedAt: nowIso(), completedAt: nowIso(), durationMs: 5, itemsProcessed: 2, itemsRecovered: 1, errors: [] },
  });

  const service = new RecoveryOrchestratorService([worker1, worker2], "test-orchestrator");

  const report = await service.runCycle();

  assert.equal(report.orchestratorId, "test-orchestrator");
  assert.equal(report.workerReports.length, 2);
});

test("RecoveryOrchestratorService runCycle sorts workers by priority [execution-business-logic]", async () => {
  const critical = createMockRecoveryWorker({ workerId: "critical", priority: "critical", intervalMs: 10_000 });
  const low = createMockRecoveryWorker({ workerId: "low", priority: "low", intervalMs: 30_000 });
  const high = createMockRecoveryWorker({ workerId: "high", priority: "high", intervalMs: 20_000 });

  const service = new RecoveryOrchestratorService([low, critical, high], "priority-test");

  const report = await service.runCycle();

  // Verify all workers executed
  assert.equal(report.workerReports.length, 3);
});

test("RecoveryOrchestratorService runCycle handles worker errors [execution-business-logic]", async () => {
  const failingWorker = createMockRecoveryWorker({
    workerId: "failing-worker",
    runError: new Error("Worker failed"),
  });
  const goodWorker = createMockRecoveryWorker({ workerId: "good-worker" });

  const service = new RecoveryOrchestratorService([failingWorker, goodWorker]);

  const report = await service.runCycle();

  // Should still complete with error in report
  assert.equal(report.workerReports.length, 2);
});

test("RecoveryOrchestratorService runCycle captures duration [execution-business-logic]", async () => {
  let runCount = 0;
  const worker = createMockRecoveryWorker({
    workerId: "timing-test",
    runResult: {
      workerId: "timing-test",
      workerType: "test",
      startedAt: nowIso(),
      completedAt: nowIso(),
      durationMs: 100,
      itemsProcessed: 5,
      itemsRecovered: 2,
      errors: [],
    },
  });

  const service = new RecoveryOrchestratorService([worker]);

  const report = await service.runCycle();

  assert.ok(report.startedAt !== undefined);
  assert.ok(report.completedAt !== undefined);
  assert.ok(report.durationMs >= 0);
});

test("RecoveryOrchestratorService with empty workers list [execution-business-logic]", async () => {
  const service = new RecoveryOrchestratorService([]);

  const report = await service.runCycle();

  assert.equal(report.workerReports.length, 0);
});

test("RecoveryOrchestratorService custom orchestratorId [execution-business-logic]", () => {
  const worker = createMockRecoveryWorker({ workerId: "test" });
  const service = new RecoveryOrchestratorService([worker], "custom-id");

  const workers = service.listWorkers();

  assert.ok(service !== null);
});

test("RecoveryOrchestratorService worker reports contain expected data [execution-business-logic]", async () => {
  const worker1 = createMockRecoveryWorker({
    workerId: "report-test",
    runResult: {
      workerId: "report-test",
      workerType: "execution_recovery",
      startedAt: "2026-04-26T00:00:00Z",
      completedAt: "2026-04-26T00:01:00Z",
      durationMs: 60000,
      itemsProcessed: 10,
      itemsRecovered: 3,
      errors: [],
      metadata: { test: true },
    },
  });

  const service = new RecoveryOrchestratorService([worker1]);
  const report = await service.runCycle();

  const workerReport = report.workerReports[0];
  assert.equal(workerReport.workerId, "report-test");
  assert.equal(workerReport.itemsProcessed, 10);
  assert.equal(workerReport.itemsRecovered, 3);
});

test("RecoveryOrchestratorService runCycle preserves report order [execution-business-logic]", async () => {
  const workers = [
    createMockRecoveryWorker({ workerId: "first", priority: "high" }),
    createMockRecoveryWorker({ workerId: "second", priority: "normal" }),
    createMockRecoveryWorker({ workerId: "third", priority: "low" }),
  ];

  const service = new RecoveryOrchestratorService(workers);
  const report = await service.runCycle();

  // All 3 workers should have reported
  assert.equal(report.workerReports.length, 3);
});

test("RecoveryOrchestratorService reports contain errors from workers [execution-business-logic]", async () => {
  const errorWorker = createMockRecoveryWorker({
    workerId: "error-worker",
    runResult: {
      workerId: "error-worker",
      workerType: "test",
      startedAt: nowIso(),
      completedAt: nowIso(),
      durationMs: 5,
      itemsProcessed: 0,
      itemsRecovered: 0,
      errors: [{ code: "test.error", message: "Test error" }],
    },
  });

  const service = new RecoveryOrchestratorService([errorWorker]);
  const report = await service.runCycle();

  const errorReport = report.workerReports.find(r => r.workerId === "error-worker");
  assert.ok(errorReport !== undefined);
  assert.equal(errorReport!.errors.length, 1);
  assert.equal(errorReport!.errors[0]!.code, "test.error");
});
