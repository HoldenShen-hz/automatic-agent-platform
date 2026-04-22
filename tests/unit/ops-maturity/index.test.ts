import assert from "node:assert/strict";
import test from "node:test";

import {
  AnomalyDetectionService,
  ChaosExperimentScheduler,
  PlatformOpsAgentService,
} from "../../../src/ops-maturity/index.js";

test("ops-maturity root barrel exposes chaos and monitoring services", () => {
  assert.equal(typeof ChaosExperimentScheduler, "function");
  assert.equal(typeof AnomalyDetectionService, "function");
});

test("ops-maturity root barrel preserves existing lifecycle service exports", () => {
  assert.equal(typeof PlatformOpsAgentService, "function");
});
