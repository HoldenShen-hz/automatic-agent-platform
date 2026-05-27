import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDbQueueDisconnectRepairTemplate,
} from "../../../../../src/platform/five-plane-execution/recovery/execution-db-queue-disconnect-repair-service.js";

test("parseDbQueueDisconnectRepairTemplate returns empty template for null input [execution-db-queue-disconnect-repair-service]", () => {
  const result = parseDbQueueDisconnectRepairTemplate(null);

  assert.deepEqual(result.template, {});
  assert.equal(result.recoveredFromPlan, false);
});

test("parseDbQueueDisconnectRepairTemplate returns empty template for undefined input [execution-db-queue-disconnect-repair-service]", () => {
  const result = parseDbQueueDisconnectRepairTemplate(undefined);

  assert.deepEqual(result.template, {});
  assert.equal(result.recoveredFromPlan, false);
});

test("parseDbQueueDisconnectRepairTemplate returns empty template for empty string [execution-db-queue-disconnect-repair-service]", () => {
  const result = parseDbQueueDisconnectRepairTemplate("");

  assert.deepEqual(result.template, {});
  assert.equal(result.recoveredFromPlan, false);
});

test("parseDbQueueDisconnectRepairTemplate returns empty template for whitespace only [execution-db-queue-disconnect-repair-service]", () => {
  const result = parseDbQueueDisconnectRepairTemplate("   ");

  assert.deepEqual(result.template, {});
  assert.equal(result.recoveredFromPlan, false);
});

test("parseDbQueueDisconnectRepairTemplate parses valid JSON with priority [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    priority: "high",
    queueName: null,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.priority, "high");
  assert.equal(result.recoveredFromPlan, true);
});

test("parseDbQueueDisconnectRepairTemplate parses queueName [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    queueName: "critical-queue",
    dispatchTarget: "any",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.queueName, "critical-queue");
  assert.equal(result.recoveredFromPlan, true);
});

test("parseDbQueueDisconnectRepairTemplate parses queueName as null [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    queueName: null,
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.queueName, null);
});

test("parseDbQueueDisconnectRepairTemplate parses dispatchTarget values [execution-db-queue-disconnect-repair-service]", () => {
  const targets = ["any", "local_only", "prefer_remote", "require_remote"];

  for (const target of targets) {
    const planJson = JSON.stringify({ dispatchTarget: target });
    const result = parseDbQueueDisconnectRepairTemplate(planJson);
    assert.equal(result.template.dispatchTarget, target, `Failed for ${target}`);
  }
});

test("parseDbQueueDisconnectRepairTemplate ignores invalid dispatchTarget [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    dispatchTarget: "invalid_target",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.dispatchTarget, undefined);
});

test("parseDbQueueDisconnectRepairTemplate parses requiredIsolationLevel values [execution-db-queue-disconnect-repair-service]", () => {
  const levels = ["standard", "hardened", "strict"];

  for (const level of levels) {
    const planJson = JSON.stringify({ requiredIsolationLevel: level });
    const result = parseDbQueueDisconnectRepairTemplate(planJson);
    assert.equal(result.template.requiredIsolationLevel, level, `Failed for ${level}`);
  }
});

test("parseDbQueueDisconnectRepairTemplate ignores invalid isolation level [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredIsolationLevel: "invalid_level",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.requiredIsolationLevel, undefined);
});

test("parseDbQueueDisconnectRepairTemplate parses priority values [execution-db-queue-disconnect-repair-service]", () => {
  const priorities = ["low", "normal", "high", "urgent"];

  for (const priority of priorities) {
    const planJson = JSON.stringify({ priority });
    const result = parseDbQueueDisconnectRepairTemplate(planJson);
    assert.equal(result.template.priority, priority, `Failed for ${priority}`);
  }
});

test("parseDbQueueDisconnectRepairTemplate ignores invalid priority [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    priority: "invalid_priority",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.priority, undefined);
});

test("parseDbQueueDisconnectRepairTemplate parses requiredRepoVersion as string [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredRepoVersion: "v1.2.3",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.requiredRepoVersion, "v1.2.3");
  assert.equal(result.recoveredFromPlan, true);
});

test("parseDbQueueDisconnectRepairTemplate parses requiredRepoVersion as null [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredRepoVersion: null,
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.requiredRepoVersion, null);
});

test("parseDbQueueDisconnectRepairTemplate ignores requiredRepoVersion when not string or null [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredRepoVersion: 123,
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.requiredRepoVersion, undefined);
});

test("parseDbQueueDisconnectRepairTemplate parses requiredCapabilities as string array [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredCapabilities: ["cap1", "cap2", "cap3"],
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.deepEqual(result.template.requiredCapabilities, ["cap1", "cap2", "cap3"]);
});

test("parseDbQueueDisconnectRepairTemplate deduplicates and sorts requiredCapabilities [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredCapabilities: ["cap2", "cap1", "cap2", "cap1"],
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.deepEqual(result.template.requiredCapabilities, ["cap1", "cap2"]);
});

test("parseDbQueueDisconnectRepairTemplate trims and filters empty strings from requiredCapabilities [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredCapabilities: ["cap1", "", "  ", "cap2"],
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.deepEqual(result.template.requiredCapabilities, ["cap1", "cap2"]);
});

test("parseDbQueueDisconnectRepairTemplate returns empty array for non-array requiredCapabilities [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    requiredCapabilities: "not-an-array",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.deepEqual(result.template.requiredCapabilities, []);
});

test("parseDbQueueDisconnectRepairTemplate parses dispatchAfter as ISO timestamp [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    dispatchAfter: "2025-01-15T10:30:00.000Z",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.dispatchAfter, "2025-01-15T10:30:00.000Z");
  assert.equal(result.recoveredFromPlan, true);
});

test("parseDbQueueDisconnectRepairTemplate parses dispatchAfter as null [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    dispatchAfter: null,
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.dispatchAfter, null);
});

test("parseDbQueueDisconnectRepairTemplate ignores dispatchAfter when not string or null [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    dispatchAfter: 12345,
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.dispatchAfter, undefined);
});

test("parseDbQueueDisconnectRepairTemplate marks recoveredFromPlan false when JSON is malformed [execution-db-queue-disconnect-repair-service]", () => {
  // Malformed JSON will be caught and recoveredFromPlan will be false
  const planJson = "{ this is not valid JSON }";

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  // recoveredFromPlan is false because parsing failed
  assert.equal(result.recoveredFromPlan, false);
});

test("parseDbQueueDisconnectRepairTemplate marks recoveredFromPlan true when any field recovered [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    priority: "high",
    unknownField: "value",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.priority, "high");
  assert.equal(result.recoveredFromPlan, true);
});

test("parseDbQueueDisconnectRepairTemplate handles full valid template [execution-db-queue-disconnect-repair-service]", () => {
  const planJson = JSON.stringify({
    priority: "urgent",
    queueName: "fast-lane",
    dispatchTarget: "prefer_remote",
    requiredIsolationLevel: "strict",
    requiredRepoVersion: "v2.0.0",
    requiredCapabilities: ["gpu", "high-memory"],
    dispatchAfter: "2025-01-01T00:00:00.000Z",
  });

  const result = parseDbQueueDisconnectRepairTemplate(planJson);

  assert.equal(result.template.priority, "urgent");
  assert.equal(result.template.queueName, "fast-lane");
  assert.equal(result.template.dispatchTarget, "prefer_remote");
  assert.equal(result.template.requiredIsolationLevel, "strict");
  assert.equal(result.template.requiredRepoVersion, "v2.0.0");
  assert.deepEqual(result.template.requiredCapabilities, ["gpu", "high-memory"]);
  assert.equal(result.template.dispatchAfter, "2025-01-01T00:00:00.000Z");
  assert.equal(result.recoveredFromPlan, true);
});

test("parseDbQueueDisconnectRepairTemplate handles malformed JSON [execution-db-queue-disconnect-repair-service]", () => {
  const result = parseDbQueueDisconnectRepairTemplate("{ this is not valid JSON }");

  assert.deepEqual(result.template, {});
  assert.equal(result.recoveredFromPlan, false);
});

test("parseDbQueueDisconnectRepairTemplate handles incomplete JSON without crashing [execution-db-queue-disconnect-repair-service]", () => {
  const result = parseDbQueueDisconnectRepairTemplate('{"priority": "high", "incomplete"');

  // Should return empty template, not throw
  assert.deepEqual(result.template, {});
});