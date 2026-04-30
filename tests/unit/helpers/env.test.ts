/**
 * Unit tests for tests/helpers/env.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withEnv, withEnvSync } from "../../helpers/env.js";

describe("env helpers", () => {
  describe("withEnvSync", () => {
    it("should set environment variables within callback", () => {
      withEnvSync({ TEST_VAR: "test-value" }, () => {
        assert.strictEqual(process.env.TEST_VAR, "test-value");
      });
    });

    it("should restore original values after callback", () => {
      const original = process.env.TEST_VAR;
      withEnvSync({ TEST_VAR: "test-value" }, () => {
        process.env.TEST_VAR = "modified-inside";
      });
      assert.strictEqual(process.env.TEST_VAR, original);
    });

    it("should delete variable if original was undefined", () => {
      delete process.env.TEST_VAR_UNDEFINED;
      withEnvSync({ TEST_VAR_UNDEFINED: "new-value" }, () => {
        assert.strictEqual(process.env.TEST_VAR_UNDEFINED, "new-value");
      });
      assert.strictEqual(process.env.TEST_VAR_UNDEFINED, undefined);
    });

    it("should handle multiple variables", () => {
      withEnvSync({ VAR_A: "a", VAR_B: "b", VAR_C: "c" }, () => {
        assert.strictEqual(process.env.VAR_A, "a");
        assert.strictEqual(process.env.VAR_B, "b");
        assert.strictEqual(process.env.VAR_C, "c");
      });
    });

    it("should restore original values even if callback throws", () => {
      const original = process.env.TEST_RESTORE;
      try {
        withEnvSync({ TEST_RESTORE: "new-value" }, () => {
          throw new Error("intentional error");
        });
      } catch {
        // Expected
      }
      assert.strictEqual(process.env.TEST_RESTORE, original);
    });

    it("should not affect other env vars", () => {
      // Save PATH
      const originalPath = process.env.PATH;
      withEnvSync({ TEST_PATH_AFFECT: "value" }, () => {
        assert.strictEqual(process.env.PATH, originalPath);
      });
      assert.strictEqual(process.env.PATH, originalPath);
    });
  });

  describe("withEnv (async)", () => {
    it("should set environment variables within async callback", async () => {
      await withEnv({ TEST_ASYNC: "async-value" }, async () => {
        assert.strictEqual(process.env.TEST_ASYNC, "async-value");
      });
    });

    it("should restore original values after async callback", async () => {
      const original = process.env.TEST_ASYNC_RESTORE;
      await withEnv({ TEST_ASYNC_RESTORE: "async-value" }, async () => {
        process.env.TEST_ASYNC_RESTORE = "modified-inside";
      });
      assert.strictEqual(process.env.TEST_ASYNC_RESTORE, original);
    });

    it("should delete variable if original was undefined (async)", async () => {
      delete process.env.TEST_ASYNC_UNDEFINED;
      await withEnv({ TEST_ASYNC_UNDEFINED: "new-value" }, async () => {
        assert.strictEqual(process.env.TEST_ASYNC_UNDEFINED, "new-value");
      });
      assert.strictEqual(process.env.TEST_ASYNC_UNDEFINED, undefined);
    });

    it("should handle async callback that returns promise", async () => {
      // Note: withEnv returns void, but we can verify the callback was executed
      let callbackExecuted = false;
      await withEnv({ TEST_PROMISE: "promise-value" }, async () => {
        callbackExecuted = true;
        assert.strictEqual(process.env.TEST_PROMISE, "promise-value");
      });
      assert.ok(callbackExecuted);
    });

    it("should restore original values even if async callback throws", async () => {
      const original = process.env.TEST_ASYNC_ERROR;
      try {
        await withEnv({ TEST_ASYNC_ERROR: "new-value" }, async () => {
          throw new Error("intentional async error");
        });
      } catch {
        // Expected
      }
      assert.strictEqual(process.env.TEST_ASYNC_ERROR, original);
    });

    it("should work with sync function passed to async withEnv", async () => {
      const original = process.env.TEST_SYNC_IN_ASYNC;
      await withEnv({ TEST_SYNC_IN_ASYNC: "value" }, () => {
        assert.strictEqual(process.env.TEST_SYNC_IN_ASYNC, "value");
      });
      assert.strictEqual(process.env.TEST_SYNC_IN_ASYNC, original);
    });
  });

  describe("edge cases", () => {
    it("should handle empty overrides object", () => {
      const original = { ...process.env };
      withEnvSync({}, () => {
        // No changes should be made
        assert.strictEqual(process.env.TEST_NONE, original.TEST_NONE);
      });
    });

    it("should handle async empty overrides", async () => {
      const original = { ...process.env };
      await withEnv({}, async () => {
        // No changes should be made
        assert.strictEqual(process.env.TEST_ASYNC_NONE, original.TEST_ASYNC_NONE);
      });
    });

    it("should handle string value of 'undefined'", () => {
      // This tests that setting a string "undefined" works (not the JS undefined)
      withEnvSync({ TEST_STRING_UNDEFINED: "undefined" }, () => {
        assert.strictEqual(process.env.TEST_STRING_UNDEFINED, "undefined");
      });
    });

    it("should handle empty string value", () => {
      withEnvSync({ TEST_EMPTY: "" }, () => {
        assert.strictEqual(process.env.TEST_EMPTY, "");
      });
    });
  });
});
