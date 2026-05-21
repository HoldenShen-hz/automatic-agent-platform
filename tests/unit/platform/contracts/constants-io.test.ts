/**
 * Tests for src/platform/contracts/constants/io.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  STDERR_TAIL_BUFFER_BYTES,
} from "../../../../src/platform/contracts/constants/io.js";

describe("contracts/constants/io", () => {
  describe("STDERR_TAIL_BUFFER_BYTES", () => {
    it("should equal 4096", () => {
      assert.strictEqual(STDERR_TAIL_BUFFER_BYTES, 4_096);
    });
  });
});