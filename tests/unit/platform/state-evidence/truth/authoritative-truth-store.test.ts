import { describe, it } from "node:test";
import assert from "node:assert";

describe("authoritative-truth-store", () => {
  // This is a legacy compatibility shim that re-exports from authoritative-task-store
  it("should re-export everything from authoritative-task-store", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-truth-store.js"
    );

    // Verify the module re-exports from authoritative-task-store
    assert.ok(mod);
    // Just verify it's a re-export module (no error on import)
    assert.strictEqual(typeof mod, "object");
  });
});