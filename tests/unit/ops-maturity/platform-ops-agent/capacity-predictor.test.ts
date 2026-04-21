import assert from "node:assert/strict";
import test from "node:test";

import { predictOpsCapacityRisk } from "../../../../src/ops-maturity/platform-ops-agent/capacity-predictor/index.js";

test("predictOpsCapacityRisk returns high when ratio >= 2", () => {
  assert.equal(predictOpsCapacityRisk(50, 100), "high");
  assert.equal(predictOpsCapacityRisk(50, 150), "high");
});

test("predictOpsCapacityRisk returns medium when ratio >= 1.2", () => {
  assert.equal(predictOpsCapacityRisk(100, 125), "medium");
  assert.equal(predictOpsCapacityRisk(100, 130), "medium");
});

test("predictOpsCapacityRisk returns low when ratio < 1.2", () => {
  assert.equal(predictOpsCapacityRisk(100, 110), "low");
  assert.equal(predictOpsCapacityRisk(100, 50), "low");
});

test("predictOpsCapacityRisk handles zero current load", () => {
  assert.equal(predictOpsCapacityRisk(0, 100), "high");
  assert.equal(predictOpsCapacityRisk(0, 0), "low");
});

test("predictOpsCapacityRisk handles equal loads", () => {
  assert.equal(predictOpsCapacityRisk(100, 100), "medium"); // ratio = 1.0, not < 1.2
});

test("predictOpsCapacityRisk handles boundary at 2.0", () => {
  assert.equal(predictOpsCapacityRisk(50, 99.9), "medium"); // ratio < 2
  assert.equal(predictOpsCapacityRisk(50, 100), "high"); // ratio >= 2
});

test("predictOpsCapacityRisk handles boundary at 1.2", () => {
  assert.equal(predictOpsCapacityRisk(100, 119), "low"); // ratio < 1.2
  assert.equal(predictOpsCapacityRisk(100, 120), "medium"); // ratio >= 1.2
});