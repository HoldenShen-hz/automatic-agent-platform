import assert from "node:assert/strict";
import test from "node:test";

import { ChangepointDetectorService } from "../../../../../src/ops-maturity/drift-detection/changepoint-detector/index.js";

test("ChangepointDetectorService detects large score shifts", () => {
  const service = new ChangepointDetectorService();
  const result = service.detect([
    { observedAt: "2026-04-20T00:00:00.000Z", score: 0.9 },
    { observedAt: "2026-04-20T00:01:00.000Z", score: 0.88 },
    { observedAt: "2026-04-20T00:02:00.000Z", score: 0.87 },
    { observedAt: "2026-04-20T00:03:00.000Z", score: 0.5 },
    { observedAt: "2026-04-20T00:04:00.000Z", score: 0.45 },
    { observedAt: "2026-04-20T00:05:00.000Z", score: 0.4 },
  ]);

  assert.equal(result.detected, true);
  assert.equal(result.reasonCode, "drift.changepoint_detected");
});
