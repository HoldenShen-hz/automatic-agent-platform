import assert from "node:assert/strict";
import test from "node:test";

import { summarizeTaskMetrics } from "../../../../src/interaction/dashboard/metric-aggregator/index.js";

test("R19-48 summarizes authoritative task statuses instead of legacy aliases", () => {
  const summary = summarizeTaskMetrics([
    "completed",
    "running",
    "failed",
    "pending",
    "queued",
    "scheduled",
    "cancelled",
    "aborted",
    "unknown",
  ]);

  assert.deepEqual(summary, {
    total: 9,
    done: 1,
    inProgress: 1,
    failed: 1,
    pending: 3,
    cancelled: 2,
  });
});
