import assert from "node:assert/strict";
import test from "node:test";

import {
  propagateDataTaint,
  getDataTaintLabels,
  hasDataTaintLabel,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("propagateDataTaint creates taint propagation record", () => {
  const result = propagateDataTaint("data_123", "plugin.test", ["confidential", "pii"]);
  assert.equal(result.originPluginId, "plugin.test");
  assert.equal(result.originatingDataId, "data_123");
  assert.equal(result.labels.length, 2);
  assert.equal(result.labels[0]!.label, "confidential");
  assert.equal(result.labels[0]!.sourcePluginId, "plugin.test");
  assert.equal(result.labels[0]!.severity, "medium");
  assert.ok(typeof result.labels[0]!.propagatedAt === "string");
});

test("propagateDataTaint sets severity based on context", () => {
  const result = propagateDataTaint("data_456", "plugin.audit", ["audit-log"]);
  assert.equal(result.labels[0]!.severity, "medium");
});

test("getDataTaintLabels returns labels for data id", () => {
  propagateDataTaint("test_data_1", "plugin.source", ["label1", "label2"]);
  const labels = getDataTaintLabels("test_data_1");
  assert.ok(labels.length >= 2);
});

test("getDataTaintLabels returns empty array for unknown data id", () => {
  const labels = getDataTaintLabels("nonexistent_data_id");
  assert.deepEqual(labels, []);
});

test("hasDataTaintLabel returns true when label exists", () => {
  propagateDataTaint("data_with_label", "plugin.alpha", ["sensitive"]);
  assert.equal(hasDataTaintLabel("data_with_label", "sensitive"), true);
});

test("hasDataTaintLabel returns false when label does not exist", () => {
  propagateDataTaint("data_without_label", "plugin.beta", ["safe"]);
  assert.equal(hasDataTaintLabel("data_without_label", "confidential"), false);
});

test("hasDataTaintLabel returns false for unknown data id", () => {
  assert.equal(hasDataTaintLabel("completely_unknown", "label"), false);
});

test("propagateDataTaint with empty labels creates empty propagation", () => {
  const result = propagateDataTaint("empty_data", "plugin.empty", []);
  assert.equal(result.labels.length, 0);
  assert.equal(result.originPluginId, "plugin.empty");
});

test("multiple taint propagations for same data id accumulate", () => {
  propagateDataTaint("multi_data", "plugin.first", ["label_a"]);
  propagateDataTaint("multi_data", "plugin.second", ["label_b"]);
  const labels = getDataTaintLabels("multi_data");
  assert.ok(labels.length >= 2);
});