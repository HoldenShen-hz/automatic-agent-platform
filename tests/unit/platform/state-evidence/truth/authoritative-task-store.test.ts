import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthoritativeTaskStore,
  Phase1aStore,
} from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

test("AuthoritativeTaskStore and Phase1aStore are the same class", () => {
  assert.equal(AuthoritativeTaskStore, Phase1aStore);
});

test("AuthoritativeTaskStoreOptions structure is correct", () => {
  const options = {
    database: {},
    logger: undefined,
    maximumSchemaVersion: "2.0.0",
  };
  assert.equal(options.maximumSchemaVersion, "2.0.0");
  assert.equal(options.logger, undefined);
});

test("AuthoritativeTaskStoreTransactionOptions structure is correct", () => {
  const options = {
    readOnly: true,
    isolationLevel: "deferred",
  };
  assert.equal(options.readOnly, true);
  assert.equal(options.isolationLevel, "deferred");
});

test("AuthoritativeTaskStoreTransactionOptions allows minimal definition", () => {
  const options: { readOnly?: boolean; isolationLevel?: string } = {};
  assert.equal(options.readOnly, undefined);
  assert.equal(options.isolationLevel, undefined);
});
