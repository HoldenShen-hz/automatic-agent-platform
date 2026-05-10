import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

import { HarnessRunStatusSchema } from "../../../../src/platform/contracts/executable-contracts/schemas.js";

test("R18-14: golden snapshot documents the canonical HarnessRunStatus enum including cancelled", () => {
  const snapshot = JSON.parse(
    readFileSync("tests/golden/snapshots/harness-run-status-enum-v1.golden", "utf8"),
  ) as {
    totalStatuses: number;
    statuses: string[];
  };

  const canonicalStatuses = HarnessRunStatusSchema.options;

  assert.equal(snapshot.totalStatuses, canonicalStatuses.length);
  assert.deepEqual(snapshot.statuses, canonicalStatuses);
  assert.ok(snapshot.statuses.includes("cancelled"));
});
