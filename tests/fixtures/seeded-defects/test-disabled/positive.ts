// Seeded positive sample: a bare `test.skip()` call without any
// `@quarantine` metadata. The audit:test-disabled script MUST report a P0
// finding (rule: `disabled_tests.bare_skip`).

import { test } from "node:test";

test.skip("p0 case", () => {
  // intentionally empty: this test is disabled without ledger metadata.
});
