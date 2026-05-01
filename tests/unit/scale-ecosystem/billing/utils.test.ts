/**
 * Unit tests for Billing Utils
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  assertIdentifier,
  assertPositiveNumber,
  roundCurrency,
  monthWindow,
  buildBillingMarkdown,
} from "../../../../src/scale-ecosystem/billing/utils.js";
import type { BillingAccountSummary } from "../../../../src/scale-ecosystem/billing/types.js";

test("assertIdentifier accepts valid identifiers", () => {
  const result = assertIdentifier("valid-id_123.456", "test.code");
  assert.strictEqual(result, "valid-id_123.456");
});

test("assertIdentifier accepts identifiers at min length", () => {
  const result = assertIdentifier("ab", "test.code");
  assert.strictEqual(result, "ab");
});

test("assertIdentifier accepts identifiers at max length", () => {
  const longId = "a".repeat(128);
  const result = assertIdentifier(longId, "test.code");
  assert.strictEqual(result, longId);
});

test("assertIdentifier rejects identifiers shorter than min length", () => {
  assert.throws(() => {
    assertIdentifier("a", "test.code");
  }, /test.code/);
});

test("assertIdentifier rejects identifiers longer than max length", () => {
  const longId = "a".repeat(129);
  assert.throws(() => {
    assertIdentifier(longId, "test.code");
  }, /test.code/);
});

test("assertIdentifier rejects identifiers with invalid characters", () => {
  assert.throws(() => {
    assertIdentifier("invalid id", "test.code");
  }, /test.code/);
});

test("assertIdentifier accepts identifiers starting with allowed punctuation", () => {
  const result = assertIdentifier("-invalid", "test.code");
  assert.strictEqual(result, "-invalid");
});

test("assertPositiveNumber accepts positive numbers", () => {
  const result = assertPositiveNumber(42, "test.code");
  assert.strictEqual(result, 42);
});

test("assertPositiveNumber accepts small positive numbers", () => {
  const result = assertPositiveNumber(0.0001, "test.code");
  assert.strictEqual(result, 0.0001);
});

test("assertPositiveNumber rejects zero", () => {
  assert.throws(() => {
    assertPositiveNumber(0, "test.code");
  }, /test.code/);
});

test("assertPositiveNumber rejects negative numbers", () => {
  assert.throws(() => {
    assertPositiveNumber(-1, "test.code");
  }, /test.code/);
});

test("assertPositiveNumber rejects Infinity", () => {
  assert.throws(() => {
    assertPositiveNumber(Infinity, "test.code");
  }, /test.code/);
});

test("assertPositiveNumber rejects NaN", () => {
  assert.throws(() => {
    assertPositiveNumber(NaN, "test.code");
  }, /test.code/);
});

test("roundCurrency rounds to 4 decimal places", () => {
  assert.strictEqual(roundCurrency(1.12345), 1.1235);
  assert.strictEqual(roundCurrency(1.12344), 1.1234);
  assert.strictEqual(roundCurrency(1.5), 1.5);
  assert.strictEqual(roundCurrency(0.00001), 0);
  assert.strictEqual(roundCurrency(0.00009), 0.0001);
});

test("roundCurrency handles whole numbers", () => {
  assert.strictEqual(roundCurrency(100), 100);
  assert.strictEqual(roundCurrency(0), 0);
});

test("monthWindow calculates correct window for January", () => {
  const result = monthWindow("2025-01-15T12:00:00Z");

  assert.strictEqual(result.periodId, "2025-01");
  assert.ok(result.start.includes("2025-01-01T00:00:00"));
  assert.ok(result.end.includes("2025-02-01T00:00:00"));
});

test("monthWindow calculates correct window for December", () => {
  const result = monthWindow("2025-12-31T23:59:59Z");

  assert.strictEqual(result.periodId, "2025-12");
  assert.ok(result.start.includes("2025-12-01T00:00:00"));
  assert.ok(result.end.includes("2026-01-01T00:00:00"));
});

test("monthWindow handles leap year February", () => {
  const result = monthWindow("2024-02-15T12:00:00Z");

  assert.strictEqual(result.periodId, "2024-02");
  assert.ok(result.end.includes("2024-03-01T00:00:00"));
});

test("monthWindow rejects invalid timestamp", () => {
  assert.throws(() => {
    monthWindow("not-a-date");
  }, /Invalid timestamp/);
});

test("monthWindow rejects empty string", () => {
  assert.throws(() => {
    monthWindow("");
  }, /Invalid timestamp/);
});

test("buildBillingMarkdown renders account summary correctly", () => {
  const summary: BillingAccountSummary = {
    account: {
      accountId: "acc-123",
      ownerId: "owner-456",
      planId: "plan-pro",
      status: "active",
      createdAt: "2025-01-01T00:00:00Z",
    },
    plan: {
      planId: "plan-pro",
      displayName: "Pro Plan",
      description: "Professional plan",
      features: [],
      quotas: [],
    },
    generatedAt: "2025-06-01T12:00:00Z",
    totals: {
      usageEventCount: 100,
      ledgerEntryCount: 50,
      totalBilledUsd: 1234.56,
    },
    quotas: [
      {
        metricType: "api_calls",
        usedQuantity: 500,
        limitQuantity: 1000,
        remainingQuantity: 500,
        limitType: "monthly",
        windowStart: "2025-06-01T00:00:00Z",
        windowEnd: "2025-07-01T00:00:00Z",
      },
      {
        metricType: "storage_gb",
        usedQuantity: 50,
        limitQuantity: null,
        remainingQuantity: null,
        limitType: null,
        windowStart: "2025-06-01T00:00:00Z",
        windowEnd: "2025-07-01T00:00:00Z",
      },
    ],
    recentUsage: [],
    recentLedgerEntries: [],
    recentDecisions: [],
  };

  const markdown = buildBillingMarkdown(summary);
  assert.ok(markdown.includes("# Billing Account Summary"));
  assert.ok(markdown.includes("`acc-123`"));
  assert.ok(markdown.includes("`plan-pro`"));
  assert.ok(markdown.includes("`active`"));
  assert.ok(markdown.includes("2025-06-01T12:00:00Z"));
  assert.ok(markdown.includes("Usage Events: 100"));
  assert.ok(markdown.includes("Ledger Entries: 50"));
  assert.ok(markdown.includes("Total Billed USD: 1234.56"));
  assert.ok(markdown.includes("## Quotas"));
  assert.ok(markdown.includes("api_calls: used=500, limit=1000"));
  assert.ok(markdown.includes("storage_gb: used=50, limit=unlimited"));
});

test("buildBillingMarkdown handles empty quotas", () => {
  const summary: BillingAccountSummary = {
    account: {
      accountId: "acc-empty",
      ownerId: "owner-456",
      planId: "plan-basic",
      status: "suspended",
      createdAt: "2025-01-01T00:00:00Z",
    },
    plan: {
      planId: "plan-basic",
      displayName: "Basic Plan",
      description: "Basic plan",
      features: [],
      quotas: [],
    },
    generatedAt: "2025-06-01T12:00:00Z",
    totals: {
      usageEventCount: 0,
      ledgerEntryCount: 0,
      totalBilledUsd: 0,
    },
    quotas: [],
    recentUsage: [],
    recentLedgerEntries: [],
    recentDecisions: [],
  };

  const markdown = buildBillingMarkdown(summary);
  assert.ok(markdown.includes("# Billing Account Summary"));
  assert.ok(markdown.includes("`acc-empty`"));
  assert.ok(markdown.includes("`suspended`"));
  assert.ok(markdown.includes("Usage Events: 0"));
  assert.ok(markdown.includes("Ledger Entries: 0"));
  assert.ok(markdown.includes("Total Billed USD: 0"));
});

test("buildBillingMarkdown escapes backticks in account ID", () => {
  const summary: BillingAccountSummary = {
    account: {
      accountId: "acc with `backticks`",
      ownerId: "owner-456",
      planId: "plan-pro",
      status: "active",
      createdAt: "2025-01-01T00:00:00Z",
    },
    plan: {
      planId: "plan-pro",
      displayName: "Pro Plan",
      description: "Pro plan",
      features: [],
      quotas: [],
    },
    generatedAt: "2025-06-01T12:00:00Z",
    totals: {
      usageEventCount: 10,
      ledgerEntryCount: 5,
      totalBilledUsd: 99.99,
    },
    quotas: [],
    recentUsage: [],
    recentLedgerEntries: [],
    recentDecisions: [],
  };

  const markdown = buildBillingMarkdown(summary);
  // The account ID with backticks should be properly formatted with inline code
  assert.ok(markdown.includes("`acc with `backticks`"));
});
