import assert from "node:assert/strict";
import test from "node:test";
import { describe } from "node:test";

import {
  calculateBackoffForAttempt,
  DEFAULT_DELIVERY_CONFIG,
  DEFAULT_RATE_LIMIT_CONFIG,
  toDeliveryMessageRecord,
  buildDeadLetterQuery,
  buildDeadLetterCountQuery,
  type DeliveryGuaranteeConfig,
} from "../../../../../src/platform/interface/channel-gateway/channel-gateway-delivery-support.js";

describe("channel-gateway-delivery-support", () => {
  describe("calculateBackoffForAttempt", () => {
    test("returns initial backoff for attempt 1", () => {
      const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG };
      const backoff = calculateBackoffForAttempt(config, 1);
      assert.equal(backoff, config.initialBackoffMs);
    });

    test("applies multiplier for subsequent attempts", () => {
      const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG, backoffMultiplier: 2, initialBackoffMs: 1000 };
      assert.equal(calculateBackoffForAttempt(config, 1), 1000);
      assert.equal(calculateBackoffForAttempt(config, 2), 2000);
      assert.equal(calculateBackoffForAttempt(config, 3), 4000);
    });

    test("caps backoff at maxBackoffMs", () => {
      const config: DeliveryGuaranteeConfig = { ...DEFAULT_DELIVERY_CONFIG, initialBackoffMs: 1000, maxBackoffMs: 5000, backoffMultiplier: 2 };
      assert.equal(calculateBackoffForAttempt(config, 1), 1000);
      assert.equal(calculateBackoffForAttempt(config, 2), 2000);
      assert.equal(calculateBackoffForAttempt(config, 3), 4000);
      assert.equal(calculateBackoffForAttempt(config, 4), 5000); // capped
      assert.equal(calculateBackoffForAttempt(config, 5), 5000); // still capped
    });
  });

  describe("toDeliveryMessageRecord", () => {
    test("returns null for undefined input", () => {
      assert.equal(toDeliveryMessageRecord(undefined), null);
    });

    test("converts database row to record format", () => {
      const row = { attempts: 3, max_retries: 5 };
      const record = toDeliveryMessageRecord(row);
      assert.equal(record?.attempts, 3);
      assert.equal(record?.maxRetries, 5);
    });

    test("converts numeric strings to numbers", () => {
      const row = { attempts: "2", max_retries: "7" } as unknown as { attempts: number; max_retries: number };
      const record = toDeliveryMessageRecord(row);
      assert.equal(record?.attempts, 2);
      assert.equal(record?.maxRetries, 7);
    });
  });

  describe("buildDeadLetterQuery", () => {
    test("returns base query with limit", () => {
      const { query, params } = buildDeadLetterQuery(undefined, 100);
      assert.ok(query.includes("SELECT * FROM gateway_dead_letters"));
      assert.ok(query.includes("ORDER BY moved_to_dead_letter_at DESC"));
      assert.ok(query.includes("LIMIT ?"));
      assert.deepEqual(params, [100]);
    });

    test("adds channel filter when provided", () => {
      const { query, params } = buildDeadLetterQuery("telegram", 50);
      assert.ok(query.includes("channel = ?"));
      assert.deepEqual(params, ["telegram", 50]);
    });

    test("adds cursor condition when provided", () => {
      const { query, params } = buildDeadLetterQuery(undefined, 100, "2026-04-01T00:00:00.000Z");
      assert.ok(query.includes("moved_to_dead_letter_at < ?"));
      assert.deepEqual(params, ["2026-04-01T00:00:00.000Z", 100]);
    });

    test("combines channel and cursor filters", () => {
      const { query, params } = buildDeadLetterQuery("slack", 25, "2026-04-15T00:00:00.000Z");
      assert.ok(query.includes("channel = ?"));
      assert.ok(query.includes("moved_to_dead_letter_at < ?"));
      assert.deepEqual(params, ["slack", "2026-04-15T00:00:00.000Z", 25]);
    });
  });

  describe("buildDeadLetterCountQuery", () => {
    test("returns base query grouped by channel", () => {
      const { query, params } = buildDeadLetterCountQuery(undefined);
      assert.ok(query.includes("SELECT channel, COUNT(*) as count FROM gateway_dead_letters"));
      assert.ok(query.includes("GROUP BY channel"));
      assert.deepEqual(params, []);
    });

    test("filters by channel when provided", () => {
      const { query, params } = buildDeadLetterCountQuery("webhook");
      assert.ok(query.includes("WHERE channel = ?"));
      assert.deepEqual(params, ["webhook"]);
    });
  });

  describe("DEFAULT_DELIVERY_CONFIG", () => {
    test("has expected retryable statuses", () => {
      assert.deepEqual(DEFAULT_DELIVERY_CONFIG.retryableStatuses, [408, 429, 500, 502, 503, 504]);
    });

    test("has reasonable default values", () => {
      assert.equal(DEFAULT_DELIVERY_CONFIG.maxRetries, 5);
      assert.equal(DEFAULT_DELIVERY_CONFIG.initialBackoffMs, 1000);
      assert.equal(DEFAULT_DELIVERY_CONFIG.maxBackoffMs, 60000);
      assert.equal(DEFAULT_DELIVERY_CONFIG.backoffMultiplier, 2);
      assert.equal(DEFAULT_DELIVERY_CONFIG.timeoutMs, 30000);
    });
  });

  describe("DEFAULT_RATE_LIMIT_CONFIG", () => {
    test("has expected channel limits", () => {
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram?.limit, 30);
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack?.limit, 30);
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook?.limit, 100);
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default?.limit, 50);
    });

    test("has consistent window duration", () => {
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.telegram?.windowMs, 1000);
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.slack?.windowMs, 1000);
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.webhook?.windowMs, 1000);
      assert.equal(DEFAULT_RATE_LIMIT_CONFIG.default?.windowMs, 1000);
    });
  });
});
