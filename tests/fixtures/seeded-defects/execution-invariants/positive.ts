// Seeded positive sample: a thin invariant test (only 1 it() block).
// The audit:execution-invariants script MUST flag this as a P1 thin-coverage
// finding in single-file mode.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

describe("seeded execution-invariants positive", () => {
  it("only one block", () => {
    assert.equal(1, 1);
  });
});
