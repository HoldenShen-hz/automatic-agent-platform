import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "harness-sdk", "index.ts"),
  "utf8",
);

test("harness sdk source avoids ts-expect-error suppressions in the public entrypoint", () => {
  assert.doesNotMatch(source, new RegExp(`@ts-${"expect-error"}`));
});

test("harness sdk execute timeout is unrefed and reports lookup failures through onError", () => {
  assert.match(source, /timeoutHandle\.unref\?\.\(\)/);
  assert.match(source, /this\.lifecycleHooks\?\.onError\?\.\s*\(/);
  assert.match(source, /harness_sdk\.timeout_lookup_failed/);
});
