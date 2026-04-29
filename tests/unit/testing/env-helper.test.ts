/**
 * Unit tests for env test helper
 */

import assert from "node:assert/strict";
import test from "node:test";

import { withEnv, withEnvSync } from "../../helpers/env.js";

test("withEnv overrides environment variables", async () => {
  const originalValue = process.env.TEST_VAR;

  await withEnv({ TEST_VAR: "overridden" }, async () => {
    assert.equal(process.env.TEST_VAR, "overridden");
  });

  assert.equal(process.env.TEST_VAR, originalValue);
});

test("withEnv restores original value on error", async () => {
  const originalValue = process.env.TEST_VAR;

  try {
    await withEnv({ TEST_VAR: "new-value" }, async () => {
      assert.equal(process.env.TEST_VAR, "new-value");
      throw new Error("test error");
    });
  } catch {
    // Expected
  }

  assert.equal(process.env.TEST_VAR, originalValue);
});

test("withEnv handles undefined restoration", async () => {
  delete process.env.TEST_UNDEFINED;
  const hadVar = "TEST_UNDEFINED" in process.env;

  await withEnv({ TEST_UNDEFINED: "value" }, async () => {
    assert.equal(process.env.TEST_UNDEFINED, "value");
  });

  assert.equal("TEST_UNDEFINED" in process.env, hadVar);
});

test("withEnvSync overrides environment variables", () => {
  const originalValue = process.env.TEST_VAR_SYNC;

  withEnvSync({ TEST_VAR_SYNC: "sync-value" }, () => {
    assert.equal(process.env.TEST_VAR_SYNC, "sync-value");
  });

  assert.equal(process.env.TEST_VAR_SYNC, originalValue);
});

test("withEnvSync restores original value on error", () => {
  const originalValue = process.env.TEST_VAR_SYNC;

  try {
    withEnvSync({ TEST_VAR_SYNC: "sync-new" }, () => {
      assert.equal(process.env.TEST_VAR_SYNC, "sync-new");
      throw new Error("sync error");
    });
  } catch {
    // Expected
  }

  assert.equal(process.env.TEST_VAR_SYNC, originalValue);
});

test("withEnvSync handles undefined restoration", () => {
  delete process.env.TEST_UNDEFINED_SYNC;
  const hadVar = "TEST_UNDEFINED_SYNC" in process.env;

  withEnvSync({ TEST_UNDEFINED_SYNC: "value" }, () => {
    assert.equal(process.env.TEST_UNDEFINED_SYNC, "value");
  });

  assert.equal("TEST_UNDEFINED_SYNC" in process.env, hadVar);
});

test("withEnv handles multiple variables", async () => {
  await withEnv({ VAR_A: "a", VAR_B: "b", VAR_C: "c" }, async () => {
    assert.equal(process.env.VAR_A, "a");
    assert.equal(process.env.VAR_B, "b");
    assert.equal(process.env.VAR_C, "c");
  });
});

test("withEnvSync handles multiple variables", () => {
  withEnvSync({ VAR_X: "x", VAR_Y: "y" }, () => {
    assert.equal(process.env.VAR_X, "x");
    assert.equal(process.env.VAR_Y, "y");
  });
});