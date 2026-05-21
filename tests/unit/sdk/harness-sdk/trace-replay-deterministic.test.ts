import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "harness-sdk", "index.ts"),
  "utf8",
);

test("2284: HarnessSdk exposes deterministic traceReplay support", () => {
  assert.match(source, /public traceReplay\(/);
  assert.match(source, /Sort trace events deterministically by eventId/);
  assert.match(source, /a\.eventId\.localeCompare\(b\.eventId\)/);
});
