/**
 * Tests for src/platform/contracts/constants/time.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  DEFAULT_LOCK_TTL_MS,
  MS_PER_SECOND,
  SECONDS_PER_HOUR,
  MS_PER_HOUR,
  FIVE_SECONDS_MS,
  MS_PER_MINUTE,
  TWO_MINUTES_MS,
  FIVE_MINUTES_MS,
  SECONDS_PER_DAY,
  MS_PER_DAY,
} from "../../../../src/platform/contracts/constants/time.js";

describe("contracts/constants/time", () => {
  describe("DEFAULT_LOCK_TTL_MS", () => {
    it("should be 30 seconds in milliseconds", () => {
      assert.strictEqual(DEFAULT_LOCK_TTL_MS, 30_000);
    });
  });

  describe("MS_PER_SECOND", () => {
    it("should equal 1000", () => {
      assert.strictEqual(MS_PER_SECOND, 1_000);
    });
  });

  describe("SECONDS_PER_HOUR", () => {
    it("should equal 3600", () => {
      assert.strictEqual(SECONDS_PER_HOUR, 3_600);
    });
  });

  describe("MS_PER_HOUR", () => {
    it("should equal 3600000", () => {
      assert.strictEqual(MS_PER_HOUR, 3_600_000);
    });
    it("should equal SECONDS_PER_HOUR * MS_PER_SECOND", () => {
      assert.strictEqual(MS_PER_HOUR, SECONDS_PER_HOUR * MS_PER_SECOND);
    });
  });

  describe("FIVE_SECONDS_MS", () => {
    it("should equal 5000", () => {
      assert.strictEqual(FIVE_SECONDS_MS, 5_000);
    });
  });

  describe("MS_PER_MINUTE", () => {
    it("should equal 60000", () => {
      assert.strictEqual(MS_PER_MINUTE, 60_000);
    });
    it("should equal 60 * MS_PER_SECOND", () => {
      assert.strictEqual(MS_PER_MINUTE, 60 * MS_PER_SECOND);
    });
  });

  describe("TWO_MINUTES_MS", () => {
    it("should equal 120000", () => {
      assert.strictEqual(TWO_MINUTES_MS, 120_000);
    });
  });

  describe("FIVE_MINUTES_MS", () => {
    it("should equal 300000", () => {
      assert.strictEqual(FIVE_MINUTES_MS, 300_000);
    });
    it("should equal 5 * MS_PER_MINUTE", () => {
      assert.strictEqual(FIVE_MINUTES_MS, 5 * MS_PER_MINUTE);
    });
  });

  describe("SECONDS_PER_DAY", () => {
    it("should equal 86400", () => {
      assert.strictEqual(SECONDS_PER_DAY, 86_400);
    });
    it("should equal 24 * SECONDS_PER_HOUR", () => {
      assert.strictEqual(SECONDS_PER_DAY, 24 * SECONDS_PER_HOUR);
    });
  });

  describe("MS_PER_DAY", () => {
    it("should equal 86400000", () => {
      assert.strictEqual(MS_PER_DAY, 86_400_000);
    });
    it("should equal SECONDS_PER_DAY * MS_PER_SECOND", () => {
      assert.strictEqual(MS_PER_DAY, SECONDS_PER_DAY * MS_PER_SECOND);
    });
    it("should equal 24 * MS_PER_HOUR", () => {
      assert.strictEqual(MS_PER_DAY, 24 * MS_PER_HOUR);
    });
  });
});