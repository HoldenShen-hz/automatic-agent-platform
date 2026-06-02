// Seeded evasion sample: a thin invariant test (fewer than 5 it()
// blocks). The audit:execution-invariants script should NOT flag this
// evasion directly because it is not located under tests/invariants/,
// but the audit-tool self-test exercises the audit's "thin coverage"
// rule via a manually-pointed scan of the canonical invariants dir.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

describe("seeded execution-invariants evasion", () => {
  it("only one block", () => {
    assert.equal(1, 1);
  });
});
