/**
 * @issue  AAS-ISSUE-DOES-NOT-EXIST-999
 * @invariant INV-TEST-COVERAGE-POSITIVE-001
 * @gate   audit:test-coverage
 * @severity P0
 *
 * Seeded positive sample: the @issue tag references a non-existent
 * issue id. The verify-test-coverage script MUST report this as an
 * unbound test (unknown ref) and as an orphan test.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

describe("test-coverage: positive (unknown @issue ref)", () => {
  it("declares the @issue tag referencing a non-existent ledger id", () => {
    assert.ok(true, "fixture file is a metadata-only seed");
  });
});
