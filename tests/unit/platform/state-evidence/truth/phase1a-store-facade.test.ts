import { describe, it } from "node:test";
import assert from "node:assert";

describe("Phase1aStoreFacade re-exports", () => {
  it("should re-export AuthoritativeTaskStoreFacade as Phase1aStoreFacade", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store-facade.js"
    );

    assert.ok(mod.AuthoritativeTaskStoreFacade);
    // Phase1aStoreFacade is an alias
    assert.strictEqual(mod.AuthoritativeTaskStoreFacade, mod.Phase1aStoreFacade);
  });

  it("should have AuthoritativeTaskStoreFacade as a function", () => {
    const { AuthoritativeTaskStoreFacade } = require(
      "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store-facade.js"
    );

    assert.strictEqual(typeof AuthoritativeTaskStoreFacade, "function");
  });
});

describe("Phase1aStore re-exports", () => {
  it("should re-export AuthoritativeTaskStore as Phase1aStore", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store.js"
    );

    assert.ok(mod.AuthoritativeTaskStore);
    // Phase1aStore is an alias
    assert.strictEqual(mod.AuthoritativeTaskStore, mod.Phase1aStore);
  });

  it("should export the core store class", () => {
    const { AuthoritativeTaskStore } = require(
      "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/phase1a-store.js"
    );

    assert.strictEqual(typeof AuthoritativeTaskStore, "function");
  });
});

describe("AuthoritativeTaskStoreCompat re-exports", () => {
  it("should re-export AuthoritativeTaskStore and Phase1aStore alias", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-compat.js"
    );

    assert.ok(mod.AuthoritativeTaskStore);
    assert.strictEqual(mod.AuthoritativeTaskStore, mod.Phase1aStore);
  });
});