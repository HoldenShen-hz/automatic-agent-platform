/**
 * @issue  AAS-ISSUE-000113
 * @invariant INV-TEST-COVERAGE-NEGATIVE-001
 * @gate   audit:test-coverage
 * @severity P0
 *
 * Seeded negative sample: the @issue tag references a real issue in the
 * ledger. The verify-test-coverage script MUST NOT report this as an
 * orphan or unbound test.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

describe("test-coverage: negative (real @issue ref)", () => {
  it("declares the @issue tag referencing a real ledger id", () => {
    assert.ok(true, "fixture file is a metadata-only seed");
  });
});
