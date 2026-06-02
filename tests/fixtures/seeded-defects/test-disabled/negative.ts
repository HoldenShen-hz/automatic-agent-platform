// Seeded negative sample: a normal `test(...)` call (no skip, no only, no
// todo). The audit:test-disabled script MUST NOT report any P0 findings
// for this file.

import { test } from "node:test";

test("p0 case", () => {
  // no skips here
});
