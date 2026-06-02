/**
 * Self-test fixture for test-to-issue map evasion detection.
 *
 * The header block intentionally does NOT declare @issue — instead the
 * metadata lives on a single-line `// hidden @issue ...` comment inside
 * the file body. The build-test-to-issue-map.mjs parser MUST recognize
 * this line-comment form (the methodology requires resilient metadata
 * discovery, since some test scaffolds only support line comments).
 *
 * The referenced AAS-ISSUE-000001 IS in the ledger, so this is a
 * "positive evasion" sample: parser must catch it, and the verify step
 * must NOT report it as orphan.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

// hidden @issue AAS-ISSUE-000001
// hidden @invariant INV-TEST-COVERAGE-EVASION-001
// hidden @gate audit:test-coverage
// hidden @severity P0

describe("test-coverage: evasion (line-comment @issue)", () => {
  it("declares the @issue tag on a single-line // comment", () => {
    assert.ok(true, "fixture file is a metadata-only seed");
  });
});
