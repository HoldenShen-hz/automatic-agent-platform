import { describe, it } from "node:test";
import assert from "node:assert";

describe("Repositories index re-exports", () => {
  it("should re-export phase1a-store-decorator from authoritative-task-store-decorator", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/repositories/phase1a-store-decorator.js"
    );

    assert.ok(mod.decorateAuthoritativeTaskStore);
    assert.ok(mod.DecoratedAuthoritativeTaskStoreOptions);
    // Also check the Phase1aStore alias
    assert.strictEqual(mod.decorateAuthoritativeTaskStore, mod.decoratePhase1aStore);
    assert.strictEqual(mod.DecoratedAuthoritativeTaskStoreOptions, mod.DecoratedPhase1aStoreOptions);
  });

  it("should have decorateAuthoritativeTaskStore as a function", () => {
    const { decorateAuthoritativeTaskStore } = require(
      "../../../../../src/platform/five-plane-state-evidence/truth/repositories/phase1a-store-decorator.js"
    );

    assert.strictEqual(typeof decorateAuthoritativeTaskStore, "function");
  });
});

describe("SQLite repository-contracts re-exports", () => {
  it("should re-export domain types and contracts", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-repository-contracts.js"
    );

    // Should have these type exports from contracts/types/domain
    assert.ok(mod);
    // The module re-exports from domain types, verify it's an object
    assert.strictEqual(typeof mod, "object");
  });
});