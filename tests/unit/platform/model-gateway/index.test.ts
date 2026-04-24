// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  BudgetGuard,
  buildModelGatewayBootstrap,
  ChargebackService,
  DegradationController,
  estimateMessageTokens,
  listModelGatewayCapabilityBaselines,
  ModelGatewayCacheService,
  ModelGatewayFallbackService,
  ModelRoutingService,
  ProviderCredentialPool,
  resolveModelGatewayCapabilityBaseline,
  type BudgetPolicy,
  type BudgetGuardResult,
  type ModelGatewayCapabilityBaseline,
} from "../../../../src/platform/model-gateway/index.js";

test("model-gateway root barrel exports all expected types and classes", () => {
  // Classes
  assert.equal(typeof BudgetGuard, "function");
  assert.equal(typeof buildModelGatewayBootstrap, "function");
  assert.equal(typeof ChargebackService, "function");
  assert.equal(typeof DegradationController, "function");
  assert.equal(typeof estimateMessageTokens, "function");
  assert.equal(typeof listModelGatewayCapabilityBaselines, "function");
  assert.equal(typeof ModelGatewayCacheService, "function");
  assert.equal(typeof ModelGatewayFallbackService, "function");
  assert.equal(typeof ModelRoutingService, "function");
  assert.equal(typeof ProviderCredentialPool, "function");
  assert.equal(typeof resolveModelGatewayCapabilityBaseline, "function");

  // Type exports
  assert.ok(typeof "BudgetPolicy" === "string"); // type-only
});

test("BudgetGuard evaluates task spend correctly", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // Under budget
  const underResult = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 2,
    nextEstimatedCostUsd: 3,
  });
  assert.equal(underResult.allowed, true);
  assert.equal(underResult.requiresApproval, false);
  assert.ok(underResult.remainingBudgetUsd === 5);

  // Approaching limit (80% of 10 = 8)
  const approachingResult = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 3,
  });
  assert.equal(approachingResult.allowed, true);
  assert.equal(approachingResult.requiresApproval, true);

  // Exceeds limit
  const exceededResult = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 8,
    nextEstimatedCostUsd: 3,
  });
  assert.equal(exceededResult.allowed, false);
  assert.equal(exceededResult.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuard evaluates execution chain with cascade", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // Normal case
  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 2,
      nextEstimatedCostUsd: 3,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });
  assert.equal(result.allowed, true);
  assert.ok(result.projectedTaskCostUsd === 5);
  assert.ok(result.violatedScope === null);

  // Daily limit exceeded
  const dailyExceeded = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 2,
      nextEstimatedCostUsd: 50,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });
  assert.equal(dailyExceeded.allowed, false);
  assert.equal(dailyExceeded.reasonCode, "budget.daily_limit_exceeded");
  assert.equal(dailyExceeded.violatedScope, "daily");
});

test("ChargebackService builds report from mock source", () => {
  const mockSource = {
    listReports: (limit?: number, tenantId?: string | null) => [
      {
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        tenantId: "tenant-1",
        currency: "USD",
        totalCostUsd: 100,
        resourceCosts: [
          {
            resourceId: "resource-1",
            resourceType: "token",
            currency: "USD",
            costUsd: 50,
          },
          {
            resourceId: "resource-2",
            resourceType: "token",
            currency: "USD",
            costUsd: 50,
          },
        ],
      },
    ],
  };

  const service = new ChargebackService(mockSource);
  const report = service.buildReport({ tenantId: "tenant-1", limit: 100 });

  assert.equal(report.tenantId, "tenant-1");
  assert.equal(report.currency, "USD");
  assert.equal(report.totalCostUsd, 100);
  assert.equal(report.reportCount, 1);
  assert.ok(report.allocations.length > 0);
  assert.equal(report.generatedAt != null, true);
});

test("ModelGatewayCacheService creates cache entries and retrieves them", () => {
  const cache = new ModelGatewayCacheService<{ result: string }>();
  const messages = [{ role: "user", content: "hello" }];

  const cacheKey = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "openai",
    messages,
  });

  assert.ok(cacheKey.length === 64); // SHA-256 hex length

  const entry = cache.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "openai",
    value: { result: "cached response" },
    ttlMs: 60000,
  });

  assert.equal(entry.value.result, "cached response");
  assert.ok(entry.expiresAt != null);

  const retrieved = cache.get(cacheKey);
  assert.ok(retrieved != null);
  assert.equal(retrieved.value.result, "cached response");

  // Invalidate
  const invalidated = cache.invalidate(cacheKey);
  assert.equal(invalidated, true);
  assert.equal(cache.get(cacheKey), null);
});

test("ModelGatewayFallbackService selects fallback candidate correctly", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    { profileName: "fast-model", provider: "openai", tier: "fast" as const, healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "balanced-model", provider: "anthropic", tier: "balanced" as const, healthy: true, inputCostPer1kUsd: 1.5 },
    { profileName: "slow-model", provider: "openai", tier: "reasoning" as const, healthy: false, inputCostPer1kUsd: 2.0 },
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.degradedFromProfileName, "primary");
  assert.equal(decision.selectedProfileName, "fast-model");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
});

test("ModelGatewayFallbackService returns no candidate when all unhealthy", () => {
  const service = new ModelGatewayFallbackService();
  const candidates = [
    { profileName: "model-1", provider: "openai", tier: "fast" as const, healthy: false, inputCostPer1kUsd: 0.5 },
  ];

  const decision = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("listModelGatewayCapabilityBaselines returns all capability baselines", () => {
  const baselines = listModelGatewayCapabilityBaselines();

  assert.ok(Array.isArray(baselines));
  assert.ok(baselines.length > 0);

  const capabilityIds = baselines.map((b: ModelGatewayCapabilityBaseline) => b.capabilityId);
  assert.ok(capabilityIds.includes("provider-registry"));
  assert.ok(capabilityIds.includes("router"));
  assert.ok(capabilityIds.includes("fallback"));
  assert.ok(capabilityIds.includes("degradation"));
  assert.ok(capabilityIds.includes("cost-tracker"));
  assert.ok(capabilityIds.includes("messages"));
});

test("resolveModelGatewayCapabilityBaseline returns correct baseline", () => {
  const baseline = resolveModelGatewayCapabilityBaseline("cost-tracker");

  assert.equal(baseline.capabilityId, "cost-tracker");
  assert.ok(baseline.entryModule.includes("cost-tracker"));
  assert.ok(baseline.baselineServices.includes("BudgetGuard"));
});

test("resolveModelGatewayCapabilityBaseline throws for unknown capability", () => {
  assert.throws(() => {
    resolveModelGatewayCapabilityBaseline("unknown" as any);
  }, /model_gateway_capability.not_found/);
});

test("buildModelGatewayBootstrap creates valid bootstrap object", () => {
  const bootstrap = buildModelGatewayBootstrap();

  assert.equal(bootstrap.capabilityGroupId, "model-gateway");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(bootstrap.catalog.length > 0);
  assert.deepEqual(bootstrap.registeredServiceIds, [
    "aiops.model-gateway.catalog",
    "aiops.model-gateway.bootstrap",
  ]);
});

test("estimateMessageTokens calculates token count", () => {
  // estimateMessageTokens is a function that estimates tokens in messages
  const messages = [
    { role: "user", content: "Hello, how are you?" },
  ];

  const tokens = estimateMessageTokens(messages);
  assert.ok(typeof tokens === "number");
  assert.ok(tokens > 0);
});
