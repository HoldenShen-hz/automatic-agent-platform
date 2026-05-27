import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultBudgetPolicy,
  estimateLlmCallCost,
  estimateActualLlmCallCost,
  estimateCostFromUsage,
  buildModelGovernanceKey,
  readTrimmedEnvValue,
  parsePositiveInteger,
  parseNonNegativeInteger,
  parseBoolean,
  isRetryableProviderError,
} from "../../../../src/platform/five-plane-execution/execution-engine/model-call-provider-support.js";
import { ProviderError } from "../../../../src/platform/contracts/errors.js";

test("getDefaultBudgetPolicy returns expected policy [model-call-provider-support]", () => {
  const policy = getDefaultBudgetPolicy();

  assert.equal(policy.maxTaskCostUsd, 10);
  assert.equal(policy.maxDailyCostUsd, 100);
  assert.equal(policy.maxMonthlyCostUsd, 1000);
  assert.equal(policy.maxPlatformCostUsd, 0);
  assert.equal(policy.maxSteps, 100);
  assert.equal(policy.maxModelTokens, 8192);
  assert.equal(policy.maxDurationMs, 60000);
  assert.equal(policy.warnAtRatio, 0.8);
  assert.equal(policy.mode, "auto");
});

test("estimateLlmCallCost calculates correctly for known models [model-call-provider-support]", () => {
  // MiniMax-M2.7: 0.001 per 1000 tokens
  assert.equal(estimateLlmCallCost(1000, "MiniMax-M2.7"), 0.001);
  assert.equal(estimateLlmCallCost(2000, "MiniMax-M2.7"), 0.002);

  // MiniMax-M2.7-highspeed: 0.002 per 1000 tokens
  assert.equal(estimateLlmCallCost(1000, "MiniMax-M2.7-highspeed"), 0.002);

  // claude-opus-4-5: 0.015 per 1000 tokens
  assert.equal(estimateLlmCallCost(1000, "claude-opus-4-5"), 0.015);

  // gpt-4o: 0.005 per 1000 tokens
  assert.equal(estimateLlmCallCost(1000, "gpt-4o"), 0.005);
});

test("estimateLlmCallCost uses default rate for unknown models [model-call-provider-support]", () => {
  // Default rate is 0.001 per 1000 tokens
  assert.equal(estimateLlmCallCost(1000, "unknown-model"), 0.001);
  assert.equal(estimateLlmCallCost(5000, "another-unknown"), 0.005);
});

test("estimateCostFromUsage sums prompt and completion tokens [model-call-provider-support]", () => {
  assert.equal(estimateCostFromUsage(100, 200, "MiniMax-M2.7"), estimateLlmCallCost(300, "MiniMax-M2.7"));
});

test("estimateCostFromUsage handles negative tokens by treating as 0 [model-call-provider-support]", () => {
  assert.equal(estimateCostFromUsage(-100, -200, "MiniMax-M2.7"), estimateLlmCallCost(0, "MiniMax-M2.7"));
});

test("estimateActualLlmCallCost returns null for null result [model-call-provider-support]", () => {
  assert.equal(estimateActualLlmCallCost(null, "MiniMax-M2.7"), null);
});

test("estimateActualLlmCallCost calculates cost from usage [model-call-provider-support]", () => {
  const mockResult = {
    id: "test",
    content: "response",
    refusal: null,
    reasoningContent: null,
    finishReason: "stop",
    toolCalls: [],
    usage: {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    },
    model: "MiniMax-M2.7",
    provider: "minimax",
  };

  const cost = estimateActualLlmCallCost(mockResult, "MiniMax-M2.7");
  assert.equal(cost, estimateLlmCallCost(300, "MiniMax-M2.7"));
});

test("buildModelGovernanceKey formats correctly [model-call-provider-support]", () => {
  assert.equal(buildModelGovernanceKey("claude-sonnet-4"), "model:claude-sonnet-4");
  assert.equal(buildModelGovernanceKey("gpt-4o"), "model:gpt-4o");
  assert.equal(buildModelGovernanceKey("MiniMax-M2.7"), "model:MiniMax-M2.7");
});

test("readTrimmedEnvValue returns null for undefined [model-call-provider-support]", () => {
  assert.equal(readTrimmedEnvValue(undefined), null);
});

test("readTrimmedEnvValue returns null for empty string [model-call-provider-support]", () => {
  assert.equal(readTrimmedEnvValue(""), null);
});

test("readTrimmedEnvValue returns null for whitespace-only string [model-call-provider-support]", () => {
  assert.equal(readTrimmedEnvValue("   "), null);
  assert.equal(readTrimmedEnvValue("\t"), null);
  assert.equal(readTrimmedEnvValue("\n"), null);
});

test("readTrimmedEnvValue trims and returns non-empty string [model-call-provider-support]", () => {
  assert.equal(readTrimmedEnvValue("  value  "), "value");
  assert.equal(readTrimmedEnvValue("\tvalue\t"), "value");
});

test("parsePositiveInteger returns null for undefined [model-call-provider-support]", () => {
  assert.equal(parsePositiveInteger(undefined), null);
});

test("parsePositiveInteger returns null for non-numeric string [model-call-provider-support]", () => {
  assert.equal(parsePositiveInteger("abc"), null);
});

test("parsePositiveInteger returns null for zero [model-call-provider-support]", () => {
  assert.equal(parsePositiveInteger("0"), null);
});

test("parsePositiveInteger returns null for negative numbers [model-call-provider-support]", () => {
  assert.equal(parsePositiveInteger("-1"), null);
  assert.equal(parsePositiveInteger("-100"), null);
});

test("parsePositiveInteger returns parsed integer for valid positive numbers [model-call-provider-support]", () => {
  assert.equal(parsePositiveInteger("1"), 1);
  assert.equal(parsePositiveInteger("100"), 100);
  assert.equal(parsePositiveInteger("999999"), 999999);
});

test("parsePositiveInteger returns null for floats [model-call-provider-support]", () => {
  assert.equal(parsePositiveInteger("1.5"), null);
  assert.equal(parsePositiveInteger("3.14"), null);
});

test("parseNonNegativeInteger returns null for undefined [model-call-provider-support]", () => {
  assert.equal(parseNonNegativeInteger(undefined), null);
});

test("parseNonNegativeInteger returns null for non-numeric string [model-call-provider-support]", () => {
  assert.equal(parseNonNegativeInteger("abc"), null);
});

test("parseNonNegativeInteger returns null for negative numbers [model-call-provider-support]", () => {
  assert.equal(parseNonNegativeInteger("-1"), null);
});

test("parseNonNegativeInteger returns 0 for zero [model-call-provider-support]", () => {
  assert.equal(parseNonNegativeInteger("0"), 0);
});

test("parseNonNegativeInteger returns parsed integer for valid non-negative numbers [model-call-provider-support]", () => {
  assert.equal(parseNonNegativeInteger("0"), 0);
  assert.equal(parseNonNegativeInteger("1"), 1);
  assert.equal(parseNonNegativeInteger("100"), 100);
});

test("parseBoolean returns null for undefined [model-call-provider-support]", () => {
  assert.equal(parseBoolean(undefined), null);
});

test("parseBoolean returns true for truthy string values [model-call-provider-support]", () => {
  assert.equal(parseBoolean("1"), true);
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("yes"), true);
  assert.equal(parseBoolean("on"), true);
});

test("parseBoolean returns false for falsy string values [model-call-provider-support]", () => {
  assert.equal(parseBoolean("0"), false);
  assert.equal(parseBoolean("false"), false);
  assert.equal(parseBoolean("no"), false);
  assert.equal(parseBoolean("off"), false);
});

test("parseBoolean returns null for non-boolean strings [model-call-provider-support]", () => {
  assert.equal(parseBoolean("maybe"), null);
  assert.equal(parseBoolean("yep"), null);
  assert.equal(parseBoolean("nope"), null);
});

test("isRetryableProviderError returns true for non-ProviderError [model-call-provider-support]", () => {
  assert.equal(isRetryableProviderError(new Error("test")), true);
  assert.equal(isRetryableProviderError("string error"), true);
  assert.equal(isRetryableProviderError({ message: "test" }), true);
});

test("isRetryableProviderError returns retryable flag from ProviderError [model-call-provider-support]", () => {
  const retryableError = new ProviderError("rate_limit", "Rate limited", { retryable: true });
  const nonRetryableError = new ProviderError("auth_failed", "Auth failed", { retryable: false });

  assert.equal(isRetryableProviderError(retryableError), true);
  assert.equal(isRetryableProviderError(nonRetryableError), false);
});

test("isRetryableProviderError handles objects with retryable property [model-call-provider-support]", () => {
  assert.equal(isRetryableProviderError({ retryable: true }), true);
  assert.equal(isRetryableProviderError({ retryable: false }), false);
});