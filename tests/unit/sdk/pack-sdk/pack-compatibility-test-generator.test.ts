/**
 * @fileoverview Unit tests for PackCompatibilityTestGenerator
 *
 * Tests the test case generation logic for pack compatibility validation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PackCompatibilityTestGenerator } from "../../../../src/sdk/pack-sdk/pack-compatibility-test-generator.js";

test("PackCompatibilityTestGenerator.generate creates plan with manifest test case", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "test-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-04-22T00:00:00.000Z",
  );

  assert.equal(plan.manifestId, "test-pack");
  assert.equal(plan.generatedAt, "2026-04-22T00:00:00.000Z");
  assert.ok(plan.testCases.length >= 1);
  assert.ok(plan.testCases.some((tc) => tc.source === "manifest"));
});

test("PackCompatibilityTestGenerator.generate creates openapi test cases", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "api-pack",
      openApiOperationIds: ["getTask", "createTask", "updateTask"],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const openApiCases = plan.testCases.filter((tc) => tc.source === "openapi");
  assert.equal(openApiCases.length, 3);
  assert.ok(openApiCases.some((tc) => tc.testId.includes("getTask")));
  assert.ok(openApiCases.some((tc) => tc.testId.includes("createTask")));
  assert.ok(openApiCases.some((tc) => tc.testId.includes("updateTask")));
});

test("PackCompatibilityTestGenerator.generate creates event test cases", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "event-pack",
      openApiOperationIds: [],
      eventTypes: ["task.created", "task.completed", "task.failed"],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const eventCases = plan.testCases.filter((tc) => tc.source === "event_registry");
  assert.equal(eventCases.length, 3);
  assert.ok(eventCases.some((tc) => tc.testId.includes("task.created")));
  assert.ok(eventCases.some((tc) => tc.testId.includes("task.completed")));
  assert.ok(eventCases.some((tc) => tc.testId.includes("task.failed")));
});

test("PackCompatibilityTestGenerator.generate creates contract schema test cases", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "contract-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: ["runtime_execution_contract", "task_state_contract"],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const schemaCases = plan.testCases.filter((tc) => tc.source === "contract_schema");
  assert.equal(schemaCases.length, 2);
  assert.ok(schemaCases.some((tc) => tc.testId.includes("runtime_execution_contract")));
  assert.ok(schemaCases.some((tc) => tc.testId.includes("task_state_contract")));
});

test("PackCompatibilityTestGenerator.generate handles all sources together", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "full-pack",
      openApiOperationIds: ["getStatus"],
      eventTypes: ["task.started"],
      contractSchemaIds: ["health_contract"],
    },
    "2026-05-01T12:00:00.000Z",
  );

  assert.equal(plan.manifestId, "full-pack");
  assert.equal(plan.testCases.length, 3); // 1 manifest + 1 openapi + 1 event + 1 contract = 4? No, let me recount
  // Actually: 1 manifest + 1 openapi + 1 event + 1 contract = 4
  // Let me check: plan.testCases should have:
  // - manifest test case (1)
  // - openapi test case for getStatus (1)
  // - event test case for task.started (1)
  // - contract test case for health_contract (1)
  // Total: 4
  assert.equal(plan.testCases.length, 4);
});

test("PackCompatibilityTestGenerator.generate creates correct testId format for manifest", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "my-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const manifestCase = plan.testCases.find((tc) => tc.source === "manifest");
  assert.ok(manifestCase);
  assert.equal(manifestCase.testId, "my-pack:manifest:required-fields");
});

test("PackCompatibilityTestGenerator.generate creates correct testId format for openapi", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "my-pack",
      openApiOperationIds: ["listTasks"],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const openApiCase = plan.testCases.find((tc) => tc.source === "openapi");
  assert.ok(openApiCase);
  assert.equal(openApiCase.testId, "my-pack:openapi:listTasks");
  assert.ok(openApiCase.assertion.includes("listTasks"));
});

test("PackCompatibilityTestGenerator.generate creates correct testId format for events", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "event-pack",
      openApiOperationIds: [],
      eventTypes: ["execution.completed"],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const eventCase = plan.testCases.find((tc) => tc.source === "event_registry");
  assert.ok(eventCase);
  assert.equal(eventCase.testId, "event-pack:event:execution.completed");
  assert.ok(eventCase.assertion.includes("execution.completed"));
});

test("PackCompatibilityTestGenerator.generate creates correct testId format for contracts", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "contract-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: ["task_lifecycle_contract"],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const contractCase = plan.testCases.find((tc) => tc.source === "contract_schema");
  assert.ok(contractCase);
  assert.equal(contractCase.testId, "contract-pack:contract:task_lifecycle_contract");
  assert.ok(contractCase.assertion.includes("task_lifecycle_contract"));
});

test("PackCompatibilityTestGenerator.generate handles empty inputs", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "empty-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  assert.equal(plan.manifestId, "empty-pack");
  assert.equal(plan.testCases.length, 1); // Only manifest test case
  assert.equal(plan.testCases[0]!.source, "manifest");
});

test("PackCompatibilityTestGenerator.generate preserves readonly inputs", () => {
  const generator = new PackCompatibilityTestGenerator();
  const openApiIds: readonly string[] = ["op1", "op2"];
  const eventTypes: readonly string[] = ["evt1"];
  const schemaIds: readonly string[] = ["schema1"];

  const plan = generator.generate(
    {
      manifestId: "readonly-pack",
      openApiOperationIds: openApiIds,
      eventTypes: eventTypes,
      contractSchemaIds: schemaIds,
    },
    "2026-05-01T12:00:00.000Z",
  );

  assert.equal(plan.testCases.length, 5); // 1 manifest + 2 openapi + 1 event + 1 contract
  // Verify readonly arrays are properly handled
  const openApiCases = plan.testCases.filter((tc) => tc.source === "openapi");
  assert.equal(openApiCases[0]?.testId, "readonly-pack:openapi:op1");
  assert.equal(openApiCases[1]?.testId, "readonly-pack:openapi:op2");
});

test("PackCompatibilityTestGenerator.generate uses provided generatedAt timestamp", () => {
  const generator = new PackCompatibilityTestGenerator();
  const customTimestamp = "2025-01-15T10:30:00.000Z";

  const plan = generator.generate(
    {
      manifestId: "timestamp-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: [],
    },
    customTimestamp,
  );

  assert.equal(plan.generatedAt, customTimestamp);
});

test("PackCompatibilityTestGenerator.assertion contains descriptive text for manifest", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "desc-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const manifestCase = plan.testCases.find((tc) => tc.source === "manifest");
  assert.ok(manifestCase);
  assert.ok(manifestCase.assertion.includes("manifest"));
  assert.ok(manifestCase.assertion.includes("runtime"));
  assert.ok(manifestCase.assertion.includes("permissions"));
  assert.ok(manifestCase.assertion.includes("entrypoints"));
  assert.ok(manifestCase.assertion.includes("version compatibility"));
});

test("PackCompatibilityTestGenerator.assertion contains descriptive text for openapi", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "desc-pack",
      openApiOperationIds: ["myOperation"],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const openApiCase = plan.testCases.find((tc) => tc.source === "openapi");
  assert.ok(openApiCase);
  assert.ok(openApiCase.assertion.includes("myOperation"));
  assert.ok(openApiCase.assertion.includes("backward compatible"));
});

test("PackCompatibilityTestGenerator.assertion contains descriptive text for events", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "desc-pack",
      openApiOperationIds: [],
      eventTypes: ["my.event.type"],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const eventCase = plan.testCases.find((tc) => tc.source === "event_registry");
  assert.ok(eventCase);
  assert.ok(eventCase.assertion.includes("my.event.type"));
  assert.ok(eventCase.assertion.includes("replay behavior"));
  assert.ok(eventCase.assertion.includes("consumer contract"));
});

test("PackCompatibilityTestGenerator.assertion contains descriptive text for contracts", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "desc-pack",
      openApiOperationIds: [],
      eventTypes: [],
      contractSchemaIds: ["my.contract.schema"],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const contractCase = plan.testCases.find((tc) => tc.source === "contract_schema");
  assert.ok(contractCase);
  assert.ok(contractCase.assertion.includes("my.contract.schema"));
  assert.ok(contractCase.assertion.includes("validates"));
  assert.ok(contractCase.assertion.includes("canonical"));
  assert.ok(contractCase.assertion.includes("compatibility fixtures"));
});

test("PackCompatibilityTestGenerator test cases are all readonly", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "readonly-check",
      openApiOperationIds: ["op1"],
      eventTypes: ["evt1"],
      contractSchemaIds: ["schema1"],
    },
    "2026-05-01T12:00:00.000Z",
  );

  for (const testCase of plan.testCases) {
    // Verify readonly properties
    assert.equal(typeof testCase.testId, "string");
    assert.equal(typeof testCase.source, "string");
    assert.equal(typeof testCase.assertion, "string");
  }
});

test("PackCompatibilityTestGenerator.plan is readonly", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "readonly-plan",
      openApiOperationIds: ["op1"],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  // Verify plan properties are readonly
  assert.equal(typeof plan.manifestId, "string");
  assert.equal(typeof plan.generatedAt, "string");
  assert.ok(Array.isArray(plan.testCases));
  assert.equal(plan.testCases.length, 2); // 1 manifest + 1 openapi
});

test("PackCompatibilityTestGenerator handles special characters in operation IDs", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "special-pack",
      openApiOperationIds: ["get-task_by-id", "create-task_with-options", "update/task[id]"],
      eventTypes: [],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const openApiCases = plan.testCases.filter((tc) => tc.source === "openapi");
  assert.equal(openApiCases.length, 3);
  assert.ok(openApiCases[0]?.testId.includes("get-task_by-id"));
  assert.ok(openApiCases[1]?.testId.includes("create-task_with-options"));
  assert.ok(openApiCases[2]?.testId.includes("update/task[id]"));
});

test("PackCompatibilityTestGenerator handles special characters in event types", () => {
  const generator = new PackCompatibilityTestGenerator();
  const plan = generator.generate(
    {
      manifestId: "special-events",
      openApiOperationIds: [],
      eventTypes: ["platform.task.#completed", "custom.event.v2[beta]"],
      contractSchemaIds: [],
    },
    "2026-05-01T12:00:00.000Z",
  );

  const eventCases = plan.testCases.filter((tc) => tc.source === "event_registry");
  assert.equal(eventCases.length, 2);
  assert.ok(eventCases[0]?.testId.includes("platform.task.#completed"));
  assert.ok(eventCases[1]?.testId.includes("custom.event.v2[beta]"));
});

test("PackCompatibilityTestGenerator handles large number of inputs", () => {
  const generator = new PackCompatibilityTestGenerator();
  const manyOperations = Array.from({ length: 100 }, (_, i) => `operation${i}`);
  const manyEvents = Array.from({ length: 50 }, (_, i) => `event.type.${i}`);
  const manySchemas = Array.from({ length: 25 }, (_, i) => `schema.${i}`);

  const plan = generator.generate(
    {
      manifestId: "large-pack",
      openApiOperationIds: manyOperations,
      eventTypes: manyEvents,
      contractSchemaIds: manySchemas,
    },
    "2026-05-01T12:00:00.000Z",
  );

  // 1 manifest + 100 openapi + 50 events + 25 contracts = 176 total
  assert.equal(plan.testCases.length, 176);
});