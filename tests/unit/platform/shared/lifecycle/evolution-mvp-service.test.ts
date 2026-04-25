/**
 * Unit tests for evolution-mvp-service re-export layer.
 *
 * The file src/platform/shared/lifecycle/evolution-mvp-service.ts re-exports from
 * src/ops-maturity/drift-detection/evolution-mvp-service.ts which in turn re-exports
 * from evolution-mvp-support.ts.
 *
 * These tests verify the re-export chain properly exposes all types and functions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as EvolutionMvpService from "../../../../../src/platform/shared/lifecycle/evolution-mvp-service.js";

test("evolution-mvp-service module exports are accessible", () => {
  assert.ok(EvolutionMvpService, "module should be importable");
  const exportKeys = Object.keys(EvolutionMvpService);
  assert.ok(exportKeys.length > 0, "module should have exports");
});

// Verify the EvolutionMvpService class is exported
test("EvolutionMvpService class is exported", () => {
  assert.ok(
    "EvolutionMvpService" in EvolutionMvpService,
    "EvolutionMvpService class should be exported",
  );
  const ServiceClass = EvolutionMvpService.EvolutionMvpService;
  assert.strictEqual(typeof ServiceClass, "function", "EvolutionMvpService should be a constructor function");
});

// Verify all helper functions from evolution-mvp-support are re-exported
test("roundCurrency helper is exported and works correctly", () => {
  assert.ok("roundCurrency" in EvolutionMvpService, "roundCurrency should be exported");
  const fn = EvolutionMvpService.roundCurrency;
  assert.strictEqual(typeof fn, "function");
  assert.strictEqual(fn(1.12345), 1.1235);
  assert.strictEqual(fn(1.12344), 1.1234);
  assert.strictEqual(fn(0), 0);
});

test("roundRatio helper is exported and works correctly", () => {
  assert.ok("roundRatio" in EvolutionMvpService, "roundRatio should be exported");
  const fn = EvolutionMvpService.roundRatio;
  assert.strictEqual(typeof fn, "function");
  assert.strictEqual(fn(1.12345), 1.123);
  assert.strictEqual(fn(1.12344), 1.123);
});

test("clamp helper is exported and works correctly", () => {
  assert.ok("clamp" in EvolutionMvpService, "clamp should be exported");
  const fn = EvolutionMvpService.clamp;
  assert.strictEqual(typeof fn, "function");
  assert.strictEqual(fn(5, 0, 10), 5);
  assert.strictEqual(fn(-5, 0, 10), 0);
  assert.strictEqual(fn(15, 0, 10), 10);
});

test("summarizeBudgetProposal helper is exported", () => {
  assert.ok("summarizeBudgetProposal" in EvolutionMvpService, "summarizeBudgetProposal should be exported");
  const fn = EvolutionMvpService.summarizeBudgetProposal;
  assert.strictEqual(typeof fn, "function");
});

test("buildRecommendedBudgetPolicy helper is exported", () => {
  assert.ok("buildRecommendedBudgetPolicy" in EvolutionMvpService, "buildRecommendedBudgetPolicy should be exported");
  const fn = EvolutionMvpService.buildRecommendedBudgetPolicy;
  assert.strictEqual(typeof fn, "function");
});

test("assertEvolutionScope helper is exported", () => {
  assert.ok("assertEvolutionScope" in EvolutionMvpService, "assertEvolutionScope should be exported");
  const fn = EvolutionMvpService.assertEvolutionScope;
  assert.strictEqual(typeof fn, "function");
});

test("parseProposalPayload helper is exported", () => {
  assert.ok("parseProposalPayload" in EvolutionMvpService, "parseProposalPayload should be exported");
  const fn = EvolutionMvpService.parseProposalPayload;
  assert.strictEqual(typeof fn, "function");
});

test("parsePolicyValue helper is exported", () => {
  assert.ok("parsePolicyValue" in EvolutionMvpService, "parsePolicyValue should be exported");
  const fn = EvolutionMvpService.parsePolicyValue;
  assert.strictEqual(typeof fn, "function");
});

// Note: Type-only exports (interfaces, type aliases) are erased at runtime
// and cannot be checked with `in` operator. They are verified through
// TypeScript compilation rather than runtime tests.

test("buildRecommendedBudgetPolicy throws on insufficient samples", () => {
  const { buildRecommendedBudgetPolicy } = EvolutionMvpService;

  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "tenant-789",
        proposalReason: "Test",
        sampleSize: 2, // insufficient
        observedAverageCostUsd: 0.05,
        successRate: 0.9,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised" as const,
        },
      }),
    /insufficient_budget_samples/,
  );
});

test("buildRecommendedBudgetPolicy throws on invalid success rate", () => {
  const { buildRecommendedBudgetPolicy } = EvolutionMvpService;

  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "tenant-789",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: 0.05,
        successRate: 1.5, // invalid
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised" as const,
        },
      }),
    /invalid_success_rate/,
  );
});

test("buildRecommendedBudgetPolicy throws on zero observed cost", () => {
  const { buildRecommendedBudgetPolicy } = EvolutionMvpService;

  assert.throws(
    () =>
      buildRecommendedBudgetPolicy({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "tenant-789",
        proposalReason: "Test",
        sampleSize: 10,
        observedAverageCostUsd: 0, // invalid
        successRate: 0.9,
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised" as const,
        },
      }),
    /invalid_observed_cost/,
  );
});

test("buildRecommendedBudgetPolicy returns adjusted policy", () => {
  const { buildRecommendedBudgetPolicy } = EvolutionMvpService;

  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "tenant-789",
    proposalReason: "Test increase",
    sampleSize: 10,
    observedAverageCostUsd: 0.09, // near limit
    successRate: 0.7,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised" as const,
    },
  });

  // Should return a policy object
  assert.ok(result);
  assert.ok("maxTaskCostUsd" in result);
  assert.ok("warnAtRatio" in result);
});

test("parseProposalPayload parses budget adjustment payload", () => {
  const { parseProposalPayload } = EvolutionMvpService;

  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: null,
    sourceAgentId: "agent_456",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "tenant-789",
    status: "pending_approval" as const,
    approvalId: "approval_123",
    summary: "Test proposal",
    proposalJson: JSON.stringify({
      kind: "budget_adjustment",
      recommendedPolicy: {
        maxTaskCostUsd: 0.12,
        maxDailyCostUsd: 1.2,
        maxMonthlyCostUsd: 12.0,
        warnAtRatio: 0.85,
        mode: "supervised",
      },
      baselinePolicy: {
        maxTaskCostUsd: 0.10,
        maxDailyCostUsd: 1.0,
        maxMonthlyCostUsd: 10.0,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      observedAverageCostUsd: 0.05,
      sampleSize: 10,
      successRate: 0.9,
      proposalReason: "Test reason",
    }),
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  const payload = parseProposalPayload(record);
  assert.strictEqual(payload.kind, "budget_adjustment");
});

test("parseProposalPayload parses experience promotion payload", () => {
  const { parseProposalPayload } = EvolutionMvpService;

  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: null,
    sourceAgentId: "agent_456",
    kind: "experience_promotion" as const,
    scopeType: "division" as const,
    scopeRef: "tenant-789",
    status: "pending_approval" as const,
    approvalId: "approval_123",
    summary: "Test proposal",
    proposalJson: JSON.stringify({
      kind: "experience_promotion",
      sourceExperienceId: "exp_123",
      sourceTaskContext: "context",
      sourceTaskIntent: "intent",
      targetScope: "project",
      promotedSummary: "summary",
      qualityScore: 0.85,
      matchedKeywords: ["keyword1", "keyword2"],
    }),
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  const payload = parseProposalPayload(record);
  assert.strictEqual(payload.kind, "experience_promotion");
});

test("parsePolicyValue parses generic JSON value", () => {
  const { parsePolicyValue } = EvolutionMvpService;

  const record = {
    id: "policy_123",
    proposalId: "proposal_123",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "tenant-789",
    status: "active" as const,
    valueJson: JSON.stringify({ recommendedPolicy: { maxTaskCostUsd: 0.12 }, baselinePolicy: { maxTaskCostUsd: 0.10 } }),
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const value = parsePolicyValue<{ recommendedPolicy: { maxTaskCostUsd: number }; baselinePolicy: { maxTaskCostUsd: number } }>(record);
  assert.strictEqual(value.recommendedPolicy.maxTaskCostUsd, 0.12);
  assert.strictEqual(value.baselinePolicy.maxTaskCostUsd, 0.10);
});

test("summarizeBudgetProposal generates summary string", () => {
  const { summarizeBudgetProposal } = EvolutionMvpService;

  const summary = summarizeBudgetProposal("division", "div-123", {
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
    recommendedPolicy: {
      maxTaskCostUsd: 0.12,
      maxDailyCostUsd: 1.2,
      maxMonthlyCostUsd: 12.0,
      warnAtRatio: 0.85,
      mode: "supervised",
    },
    observedAverageCostUsd: 0.05,
    sampleSize: 10,
    successRate: 0.95,
    proposalReason: "Normal adjustment",
  });

  assert.ok(typeof summary === "string");
  assert.ok(summary.length > 0);
  assert.ok(summary.includes("division:div-123"));
  assert.ok(summary.includes("0.0500 USD"));
});
