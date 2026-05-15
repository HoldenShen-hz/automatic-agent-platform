import assert from "node:assert/strict";
import test from "node:test";

import {
  isSqliteWriteContentionError as genericIsSqliteWriteContentionError,
  SqliteDatabase as GenericSqliteDatabase,
} from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import {
  isSqliteWriteContentionError as nestedIsSqliteWriteContentionError,
  SqliteDatabase as NestedSqliteDatabase,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import {
  AuthoritativeTaskStore as GenericAuthoritativeTaskStore,
  Phase1aStore as GenericPhase1aStore,
} from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  AuthoritativeTaskStore as CompatAuthoritativeTaskStore,
  Phase1aStore as CompatPhase1aStore,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-compat.js";
import * as GenericPhase1aStoreModule from "../../../../../src/platform/five-plane-state-evidence/truth/phase1a-store.js";
import * as GenericPhase1aStoreFacadeModule from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store-facade.js";
import {
  AuthoritativeTaskStore as NestedAuthoritativeTaskStore,
  Phase1aStore as NestedPhase1aStore,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store.js";
import {
  AuthoritativeTaskStoreFacade,
  Phase1aStoreFacade,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store-facade.js";

test("storage generic sqlite facade re-exports nested sqlite database implementation", () => {
  assert.equal(GenericSqliteDatabase, NestedSqliteDatabase);
  assert.equal(genericIsSqliteWriteContentionError, nestedIsSqliteWriteContentionError);
});

test("authoritative task store facades re-export the split compatibility layer", () => {
  assert.equal(GenericAuthoritativeTaskStore, CompatAuthoritativeTaskStore);
  assert.equal(GenericPhase1aStore, CompatPhase1aStore);
  assert.equal(GenericPhase1aStoreModule.AuthoritativeTaskStore, CompatAuthoritativeTaskStore);
  assert.equal(GenericPhase1aStoreModule.Phase1aStore, CompatPhase1aStore);
});

test("phase1a sqlite facades preserve the core and facade aliases", () => {
  assert.equal(NestedAuthoritativeTaskStore, NestedPhase1aStore);
  assert.equal(AuthoritativeTaskStoreFacade, Phase1aStoreFacade);
  assert.equal(GenericPhase1aStoreFacadeModule.AuthoritativeTaskStoreFacade, AuthoritativeTaskStoreFacade);
  assert.equal(GenericPhase1aStoreFacadeModule.Phase1aStoreFacade, Phase1aStoreFacade);
});
