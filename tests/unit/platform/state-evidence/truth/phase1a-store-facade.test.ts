import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthoritativeTaskStore,
  Phase1aStore,
} from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

test("authoritative task store generic facade re-exports the authoritative sqlite implementation", () => {
  assert.equal(typeof AuthoritativeTaskStore, "function");
});

test("Phase1aStore is exported from the facade", () => {
  assert.equal(typeof Phase1aStore, "function");
});

test("Phase1aStore is the same as AuthoritativeTaskStore (compat alias)", () => {
  assert.equal(Phase1aStore, AuthoritativeTaskStore);
});
