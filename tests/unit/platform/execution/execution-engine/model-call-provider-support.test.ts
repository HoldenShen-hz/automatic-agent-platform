/**
 * Model Call Provider Support Tests
 *
 * Tests for support functions used by ModelCallProviderService
 * including budget estimation, governance helpers, and utility functions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultBudgetPolicy,
  buildBudgetReservationRequest,
  estimateLlmCallCost,
  estimateActualLlmCallCost,
  estimateCostFromUsage,
  toGovernanceError,
  buildModelGovernanceKey,
  isRetryableProviderError,
  sleep,
  readTrimmedEnvValue,
  parsePositiveInteger,
  parseNonNegativeInteger,
  parseBoolean,
  resolveFallbackModels,
  type LlmModelCallRequest,
} from "../../../../../src/platform/five-plane-execution/execution-engine/model-call-provider-support.js";
import { ProviderError } from "../../../../../src/platform/contracts/errors.js";

test("getDefaultBudgetPolicy returns policy with expected values", () => {
  const policy = getDefaultBudgetPolicy();

  assert.equal(policy.maxTaskCostUsd, 10);
  assert.equal(policy.maxDailyCostUsd, 100);
  assert.equal(policy.maxMonthlyCostUsd, 1000);
  assert.equal(policy.maxSteps, 100);
  assert.equal(policy.maxModelTokens, 8192);
  assert.equal(policy.maxDurationMs, 60000);
  assert.equal(policy.warnAtRatio, 0.8);
  assert.equal(policy.mode, "auto");
});

test("buildBudgetReservationRequest creates valid request", () => {
  const request: LlmModelCallRequest = {
    model: "MiniMax-M2.7",
    messages: [],
    maxTokens: 4096,
    tenantId: "tenant_123",
    traceId: "trace_abc",
  };
  const policy = getDefaultBudgetPolicy();
  const estimatedCost = 0.004;

  const reservation = buildBudgetReservationRequest(request, policy, estimatedCost);

  assert.equal(reservation.policy, policy);
  assert.equal(reservation.spend.nextEstimatedCostUsd, estimatedCost);
  assert.equal(reservation.tenantId, "tenant_123");
  assert.ok(reservation.harnessRunId.includes("harness_run"));
  assert.equal(reservation.traceId, "trace_abc");
  assert.equal(reservation.emittedBy, "model_call_provider");
});

test("buildBudgetReservationRequest uses system tenant when not provided", () => {
  const request: LlmModelCallRequest = {
    model: "MiniMax-M2.7",
    messages: [],
    maxTokens: 4096,
  };
  const policy = getDefaultBudgetPolicy();

  const reservation = buildBudgetReservationRequest(request, policy, 0.001);

  assert.equal(reservation.tenantId, "system");
});

test("estimateLlmCallCost calculates correct cost for MiniMax-M2.7", () => {
  const cost = estimateLlmCallCost(1000, "MiniMax-M2.7");
  assert.equal(cost, 0.001); // $0.001 per token
});

test("estimateLlmCallCost calculates correct cost for MiniMax-M2.7-highspeed", () => {
  const cost = estimateLlmCallCost(1000, "MiniMax-M2.7-highspeed");
  assert.equal(cost, 0.002); // $0.002 per token
});

test("estimateLlmCallCost uses default rate for unknown model", () => {
  const cost = estimateLlmCallCost(1000, "unknown-model");
  assert.equal(cost, 0.001); // default rate
});

test("estimateLlmCallCost handles zero tokens", () => {
  const cost = estimateLlmCallCost(0, "MiniMax-M2.7");
  assert.equal(cost, 0);
});

test("estimateActualLlmCallCost returns null for null result", () => {
  const cost = estimateActualLlmCallCost(null, "MiniMax-M2.7");
  assert.equal(cost, null);
});

test("estimateActualLlmCallCost calculates from usage", () => {
  const result = {
    id: "test",
    content: "hello",
    refusal: null,
    reasoningContent: null,
    finishReason: "stop",
    toolCalls: [],
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: "MiniMax-M2.7",
    provider: "minimax",
  };

  const cost = estimateActualLlmCallCost(result, "MiniMax-M2.7");

  assert.ok(cost !== null);
  assert.equal(cost, 0.001 * 0.15); // 150 tokens at default rate
});

test("estimateCostFromUsage adds prompt and completion tokens", () => {
  const cost = estimateCostFromUsage(100, 50, "MiniMax-M2.7");
  // 150 tokens total at $0.001 per 1000 tokens = 0.00015
  assert.equal(cost, 0.00015);
});

test("estimateCostFromUsage handles negative tokens as zero", () => {
  const cost = estimateCostFromUsage(-100, 50, "MiniMax-M2.7");
  // Negative prompt tokens treated as 0, so 0 + 50 = 50 tokens
  // 50 tokens at $0.001 per 1000 tokens = 0.00005
  assert.equal(cost, 0.00005);
});

test("toGovernanceError creates ProviderError with correct properties", () => {
  const error = toGovernanceError("model:test", "test.code", "Test message", true, 1000);

  assert.ok(error instanceof ProviderError);
  assert.equal(error.code, "test.code");
  assert.equal(error.message, "Test message");
  assert.equal(error.retryable, true);
  assert.deepEqual(error.details, { governanceKey: "model:test", retryAfterMs: 1000 });
});

test("toGovernanceError handles missing retryAfterMs", () => {
  const error = toGovernanceError("model:test", "test.code", "Test message", false);

  assert.ok(error instanceof ProviderError);
  assert.equal(error.retryable, false);
  assert.deepEqual(error.details, { governanceKey: "model:test" });
});

test("buildModelGovernanceKey formats key correctly", () => {
  const key = buildModelGovernanceKey("claude-3-5-sonnet");
  assert.equal(key, "model:claude-3-5-sonnet");
});

test("buildModelGovernanceKey handles special characters in model name", () => {
  const key = buildModelGovernanceKey("gpt-4o-mini-2024-08-06");
  assert.equal(key, "model:gpt-4o-mini-2024-08-06");
});

test("isRetryableProviderError returns true for retryable ProviderError", () => {
  const error = new ProviderError("test", "message", { retryable: true });
  assert.equal(isRetryableProviderError(error), true);
});

test("isRetryableProviderError returns false for non-retryable ProviderError", () => {
  const error = new ProviderError("test", "message", { retryable: false });
  assert.equal(isRetryableProviderError(error), false);
});

test("isRetryableProviderError returns true for object with retryable true", () => {
  const error = { retryable: true };
  assert.equal(isRetryableProviderError(error), true);
});

test("isRetryableProviderError returns false for object with retryable false", () => {
  const error = { retryable: false };
  assert.equal(isRetryableProviderError(error), false);
});

test("isRetryableProviderError returns true for unknown error", () => {
  assert.equal(isRetryableProviderError(new Error("test")), true);
});

test("sleep resolves after specified milliseconds", async () => {
  const start = Date.now();
  await sleep(50);
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 45, `Expected ~50ms, got ${elapsed}ms`);
});

test("sleep handles zero milliseconds", async () => {
  const start = Date.now();
  await sleep(0);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 20, "Zero sleep should complete quickly");
});

test("readTrimmedEnvValue returns null for undefined", () => {
  assert.equal(readTrimmedEnvValue(undefined), null);
});

test("readTrimmedEnvValue returns null for empty string", () => {
  assert.equal(readTrimmedEnvValue(""), null);
});

test("readTrimmedEnvValue returns null for whitespace only", () => {
  assert.equal(readTrimmedEnvValue("   "), null);
});

test("readTrimmedEnvValue trims and returns value", () => {
  assert.equal(readTrimmedEnvValue("  hello  "), "hello");
});

test("parsePositiveInteger returns null for undefined", () => {
  assert.equal(parsePositiveInteger(undefined), null);
});

test("parsePositiveInteger returns null for non-numeric string", () => {
  assert.equal(parsePositiveInteger("abc"), null);
});

test("parsePositiveInteger returns null for negative number string", () => {
  assert.equal(parsePositiveInteger("-5"), null);
});

test("parsePositiveInteger returns null for zero", () => {
  assert.equal(parsePositiveInteger("0"), null);
});

test("parsePositiveInteger returns parsed positive integer", () => {
  assert.equal(parsePositiveInteger("5"), 5);
  assert.equal(parsePositiveInteger("123"), 123);
});

test("parsePositiveInteger returns null for non-integer", () => {
  assert.equal(parsePositiveInteger("5.5"), null);
});

test("parseNonNegativeInteger returns null for undefined", () => {
  assert.equal(parseNonNegativeInteger(undefined), null);
});

test("parseNonNegativeInteger returns null for non-numeric string", () => {
  assert.equal(parseNonNegativeInteger("abc"), null);
});

test("parseNonNegativeInteger returns null for negative number string", () => {
  assert.equal(parseNonNegativeInteger("-5"), null);
});

test("parseNonNegativeInteger accepts zero", () => {
  assert.equal(parseNonNegativeInteger("0"), 0);
});

test("parseNonNegativeInteger returns parsed non-negative integer", () => {
  assert.equal(parseNonNegativeInteger("0"), 0);
  assert.equal(parseNonNegativeInteger("5"), 5);
  assert.equal(parseNonNegativeInteger("123"), 123);
});

test("parseBoolean returns null for undefined", () => {
  assert.equal(parseBoolean(undefined), null);
});

test("parseBoolean returns null for non-boolean string", () => {
  assert.equal(parseBoolean("maybe"), null);
});

test("parseBoolean returns true for true-like values", () => {
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("True"), true);
  assert.equal(parseBoolean("TRUE"), true);
  assert.equal(parseBoolean("1"), true);
  assert.equal(parseBoolean("yes"), true);
  assert.equal(parseBoolean("on"), true);
});

test("parseBoolean returns false for false-like values", () => {
  assert.equal(parseBoolean("false"), false);
  assert.equal(parseBoolean("False"), false);
  assert.equal(parseBoolean("FALSE"), false);
  assert.equal(parseBoolean("0"), false);
  assert.equal(parseBoolean("no"), false);
  assert.equal(parseBoolean("off"), false);
});

test("resolveFallbackModels uses config when provided", () => {
  const config = { fallbackModels: ["model-a", "model-b", "  model-c  "] };
  const env = {};

  const result = resolveFallbackModels(config, env);

  assert.deepEqual(result, ["model-a", "model-b", "model-c"]);
});

test("resolveFallbackModels uses env when config not provided", () => {
  const config = {};
  const env = { AA_MODEL_PROVIDER_FALLBACK_MODELS: " env-model-1 , env-model-2 " };

  const result = resolveFallbackModels(config, env);

  assert.deepEqual(result, ["env-model-1", "env-model-2"]);
});

test("resolveFallbackModels filters empty strings", () => {
  const config = { fallbackModels: ["model-a", "", "  ", "model-b"] };
  const env = {};

  const result = resolveFallbackModels(config, env);

  assert.deepEqual(result, ["model-a", "model-b"]);
});

test("resolveFallbackModels returns empty array when no config or env", () => {
  const config = {};
  const env = {};

  const result = resolveFallbackModels(config, env);

  assert.deepEqual(result, []);
});