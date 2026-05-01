/**
 * @fileoverview Unit tests for Pack Compatibility Test Generator
 *
 * Tests the PackCompatibilityTestGenerator for generating test plans
 * for Pack compatibility verification.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PackCompatibilityTestGenerator,
  type PackCompatibilityInput,
} from "../../../src/sdk/pack-sdk/pack-compatibility-test-generator.js";

test("PackCompatibilityTestGenerator.generate creates plan with manifest test case", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: [],
    eventTypes: [],
    contractSchemaIds: [],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  assert.equal(plan.manifestId, "test-pack");
  assert.equal(plan.generatedAt, "2024-01-01T00:00:00Z");
  assert.ok(Array.isArray(plan.testCases));
  assert.ok(plan.testCases.length >= 1);

  const manifestCase = plan.testCases.find((c) => c.source === "manifest");
  assert.ok(manifestCase);
  assert.ok(manifestCase?.assertion.includes("runtime"));
});

test("PackCompatibilityTestGenerator.generate includes openapi test cases", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: ["getUser", "createUser"],
    eventTypes: [],
    contractSchemaIds: [],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  const openApiCases = plan.testCases.filter((c) => c.source === "openapi");
  assert.equal(openApiCases.length, 2);
  assert.ok(openApiCases.find((c) => c.testId.includes("getUser")));
  assert.ok(openApiCases.find((c) => c.testId.includes("createUser")));
});

test("PackCompatibilityTestGenerator.generate includes event_registry test cases", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: [],
    eventTypes: ["user.created", "user.deleted"],
    contractSchemaIds: [],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  const eventCases = plan.testCases.filter((c) => c.source === "event_registry");
  assert.equal(eventCases.length, 2);
  assert.ok(eventCases.find((c) => c.testId.includes("user.created")));
  assert.ok(eventCases.find((c) => c.testId.includes("user.deleted")));
});

test("PackCompatibilityTestGenerator.generate includes contract_schema test cases", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: [],
    eventTypes: [],
    contractSchemaIds: ["UserSchema", "OrderSchema"],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  const contractCases = plan.testCases.filter((c) => c.source === "contract_schema");
  assert.equal(contractCases.length, 2);
  assert.ok(contractCases.find((c) => c.testId.includes("UserSchema")));
  assert.ok(contractCases.find((c) => c.testId.includes("OrderSchema")));
});

test("PackCompatibilityTestGenerator.generate handles empty inputs", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "empty-pack",
    openApiOperationIds: [],
    eventTypes: [],
    contractSchemaIds: [],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  assert.equal(plan.manifestId, "empty-pack");
  assert.equal(plan.testCases.length, 1); // Only manifest case
});

test("PackCompatibilityTestGenerator.generate test case IDs are unique", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: ["op1", "op2"],
    eventTypes: ["event1"],
    contractSchemaIds: ["schema1", "schema2", "schema3"],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  const testIds = plan.testCases.map((c) => c.testId);
  const uniqueIds = new Set(testIds);
  assert.equal(uniqueIds.size, testIds.length);
});

test("PackCompatibilityTestGenerator.generate test case assertions are descriptive", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: ["getUser"],
    eventTypes: ["user.created"],
    contractSchemaIds: ["UserSchema"],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  for (const testCase of plan.testCases) {
    assert.ok(testCase.assertion.length > 0);
    assert.ok(testCase.source.length > 0);
    assert.ok(testCase.testId.length > 0);
  }
});

test("PackCompatibilityTestGenerator.generate produces valid test plan structure", () => {
  const generator = new PackCompatibilityTestGenerator();
  const input: PackCompatibilityInput = {
    manifestId: "test-pack",
    openApiOperationIds: ["getUser"],
    eventTypes: [],
    contractSchemaIds: [],
  };

  const plan = generator.generate(input, "2024-01-01T00:00:00Z");

  assert.ok(plan.manifestId);
  assert.ok(plan.generatedAt);
  assert.ok(Array.isArray(plan.testCases));
  assert.equal(plan.testCases.every((c) =>
    typeof c.testId === "string" &&
    typeof c.source === "string" &&
    typeof c.assertion === "string"
  ), true);
});
