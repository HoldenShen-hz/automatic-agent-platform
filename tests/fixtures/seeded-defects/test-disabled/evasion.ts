// Seeded evasion sample: a `describe.skip(...)` block (rather than a bare
// `test.skip`) without any `@quarantine` metadata. The audit:test-disabled
// script MUST still report a P0 finding for the describe-level skip, since
// it is also a disabling construct under §44.15.1.

import { describe, test } from "node:test";

describe.skip("p0 describe", () => {
  test("foo", () => {
    // no-op
  });
});
