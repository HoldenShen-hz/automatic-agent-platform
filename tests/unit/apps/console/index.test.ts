import assert from "node:assert/strict";
import test from "node:test";

import { CONSOLE_APP_MANIFEST } from "../../../../src/apps/console/index.js";

test("console app manifest exposes operator console capabilities", () => {
  assert.equal(CONSOLE_APP_MANIFEST.kind, "console");
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("operator_console"));
});
