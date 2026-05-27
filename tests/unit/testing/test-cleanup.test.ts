/**
 * Unit tests for test-cleanup helper
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resetAllSingletons } from "../../helpers/test-cleanup.js";

test("resetAllSingletons completes without throwing", () => {
  assert.doesNotThrow(() => resetAllSingletons());
  assert.equal(resetAllSingletons(), undefined);
});
