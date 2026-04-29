/**
 * Unit tests for test-cleanup helper
 */

import assert from "node:assert/strict";
import test from "node:test";

import { resetAllSingletons } from "../../helpers/test-cleanup.js";

test("resetAllSingletons does not throw", () => {
  resetAllSingletons();
});