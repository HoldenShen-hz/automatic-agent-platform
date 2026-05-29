import assert from "node:assert/strict";
import test from "node:test";

import { serializeInspectOutput } from "../../../../src/sdk/cli/inspect.js";

test("serializeInspectOutput truncates oversized strings and preserves valid JSON", () => {
  const output = serializeInspectOutput({
    huge: "x".repeat(20_000),
  });
  const parsed = JSON.parse(output) as { huge: string };

  assert.match(parsed.huge, /\[truncated\]$/);
  assert.ok(parsed.huge.length < 17_000);
});

test("serializeInspectOutput bounds large arrays with truncation marker", () => {
  const output = serializeInspectOutput({
    items: Array.from({ length: 250 }, (_, index) => ({ index })),
  });
  const parsed = JSON.parse(output) as { items: unknown[] };

  assert.equal(parsed.items.length, 201);
  assert.equal(parsed.items.at(-1), "[truncated 50 items]");
});
