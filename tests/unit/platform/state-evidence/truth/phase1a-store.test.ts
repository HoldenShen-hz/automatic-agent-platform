import assert from "node:assert/strict";
import test from "node:test";

import {
  Phase1aStore,
  AuthoritativeTaskStore,
} from "../../../../../src/platform/state-evidence/truth/phase1a-store.js";

test("Phase1aStore is the same as AuthoritativeTaskStore", () => {
  assert.equal(Phase1aStore, AuthoritativeTaskStore);
});

test("Phase1aStore can be used as type annotation", () => {
  // Verify the type exists and is accessible
  const storeClass: typeof Phase1aStore = AuthoritativeTaskStore;
  assert.ok(storeClass != null);
});
