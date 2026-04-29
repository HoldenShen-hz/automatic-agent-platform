/**
 * Integration Test: SchemaRegistry
 *
 * Tests schema registry with version management,
 * compatibility checking, and lifecycle management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SchemaRegistry,
  getSchemaRegistry,
  resetSchemaRegistry,
  type SchemaVersionEntry,
} from "../../../../src/domains/registry/schema-registry.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

function createSchemaEntry(
  domainId: string,
  schemaType: "input" | "output" | "contract",
  schemaId: string,
  version: string,
  schema: Record<string, unknown>,
  createdAt: string,
): SchemaVersionEntry {
  return {
    domainId,
    schemaType,
    schemaId,
    version,
    schema,
    createdAt,
    deprecatedAt: null,
    isActive: true,
  };
}

test("SchemaRegistry integration: registers multiple schema versions and retrieves latest", () => {
  const registry = new SchemaRegistry();

  registry.register(
    createSchemaEntry(
      "coding-domain",
      "input",
      "task-input",
      "1.0.0",
      { type: "object", properties: { code: { type: "string" } } },
      "2024-01-01T00:00:00.000Z",
    ),
  );

  registry.register(
    createSchemaEntry(
      "coding-domain",
      "input",
      "task-input",
      "2.0.0",
      { type: "object", properties: { code: { type: "string" }, language: { type: "string" } } },
      "2024-06-01T00:00:00.000Z",
    ),
  );

  const latest = registry.getLatest("coding-domain", "input", "task-input");
  assert.notEqual(latest, null);
  assert.equal(latest!.version, "2.0.0");
  assert.equal(latest!.isActive, true);

  const v1 = registry.getVersion("coding-domain", "input", "task-input", "1.0.0");
  assert.notEqual(v1, null);
  assert.equal(v1!.isActive, false);
});

test("SchemaRegistry integration: listVersions returns all versions sorted by createdAt", () => {
  const registry = new SchemaRegistry();

  registry.register(
    createSchemaEntry("test-domain", "output", "result", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  registry.register(
    createSchemaEntry("test-domain", "output", "result", "2.0.0", { type: "object" }, "2024-03-01T00:00:00.000Z"),
  );

  registry.register(
    createSchemaEntry("test-domain", "output", "result", "3.0.0", { type: "object" }, "2024-06-01T00:00:00.000Z"),
  );

  const versions = registry.listVersions("test-domain", "output", "result");
  assert.equal(versions.length, 3);
  assert.equal(versions[0]!.version, "1.0.0");
  assert.equal(versions[1]!.version, "2.0.0");
  assert.equal(versions[2]!.version, "3.0.0");
});

test("SchemaRegistry integration: checkCompatibility detects breaking changes", () => {
  const registry = new SchemaRegistry();

  const v1 = createSchemaEntry(
    "api-domain",
    "input",
    "user-data",
    "1.0.0",
    {
      type: "object",
      properties: {
        id: { type: "string", required: true },
        name: { type: "string", required: true },
        email: { type: "string" },
      },
    },
    "2024-01-01T00:00:00.000Z",
  );

  const v2 = createSchemaEntry(
    "api-domain",
    "input",
    "user-data",
    "2.0.0",
    {
      type: "object",
      properties: {
        id: { type: "string", required: true },
        email: { type: "string" },
      },
    },
    "2024-06-01T00:00:00.000Z",
  );

  registry.register(v1);
  registry.register(v2);

  const result = registry.checkCompatibility(v1, v2);
  assert.equal(result.compatible, false);
  assert.ok(result.breakingChanges.some((c) => c.includes("name")));
});

test("SchemaRegistry integration: checkCompatibility allows additive changes", () => {
  const registry = new SchemaRegistry();

  const v1 = createSchemaEntry(
    "api-domain",
    "input",
    "user-data",
    "1.0.0",
    {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    },
    "2024-01-01T00:00:00.000Z",
  );

  const v2 = createSchemaEntry(
    "api-domain",
    "input",
    "user-data",
    "2.0.0",
    {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
    },
    "2024-06-01T00:00:00.000Z",
  );

  registry.register(v1);
  registry.register(v2);

  const result = registry.checkCompatibility(v1, v2);
  assert.equal(result.compatible, true);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.migrationHints.length > 0);
});

test("SchemaRegistry integration: deprecate marks version inactive", () => {
  const registry = new SchemaRegistry();

  registry.register(
    createSchemaEntry("deprecated-domain", "input", "schema", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  const success = registry.deprecate("deprecated-domain", "input", "schema", "1.0.0", "2024-12-01T00:00:00.000Z");
  assert.equal(success, true);

  const entry = registry.getVersion("deprecated-domain", "input", "schema", "1.0.0");
  assert.notEqual(entry, null);
  assert.equal(entry!.isActive, false);
  assert.equal(entry!.deprecatedAt, "2024-12-01T00:00:00.000Z");
});

test("SchemaRegistry integration: listForDomain returns only active schemas", () => {
  const registry = new SchemaRegistry();

  registry.register(
    createSchemaEntry("multi-schema-domain", "input", "schema-a", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  registry.register(
    createSchemaEntry("multi-schema-domain", "input", "schema-b", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  registry.register(
    createSchemaEntry("multi-schema-domain", "output", "result-a", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  const schemas = registry.listForDomain("multi-schema-domain");
  assert.equal(schemas.length, 3);
});

test("SchemaRegistry integration: rejects duplicate version registration", () => {
  const registry = new SchemaRegistry();

  const entry = createSchemaEntry("dup-domain", "input", "schema", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z");
  registry.register(entry);

  assert.throws(() => {
    registry.register(entry);
  }, ValidationError);
});

test("SchemaRegistry integration: handles different schema types independently", () => {
  const registry = new SchemaRegistry();

  registry.register(
    createSchemaEntry("type-domain", "input", "task", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  registry.register(
    createSchemaEntry("type-domain", "output", "task", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  registry.register(
    createSchemaEntry("type-domain", "contract", "task", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  const input = registry.getLatest("type-domain", "input", "task");
  const output = registry.getLatest("type-domain", "output", "task");
  const contract = registry.getLatest("type-domain", "contract", "task");

  assert.notEqual(input, null);
  assert.notEqual(output, null);
  assert.notEqual(contract, null);
  assert.equal(input!.schemaType, "input");
  assert.equal(output!.schemaType, "output");
  assert.equal(contract!.schemaType, "contract");
});

test("SchemaRegistry integration: getSchemaRegistry returns singleton", () => {
  resetSchemaRegistry();

  const instance1 = getSchemaRegistry();
  const instance2 = getSchemaRegistry();

  assert.equal(instance1, instance2);
});

test("SchemaRegistry integration: resetSchemaRegistry clears singleton", () => {
  resetSchemaRegistry();

  const instance1 = getSchemaRegistry();
  instance1.register(
    createSchemaEntry("before-reset", "input", "schema", "1.0.0", { type: "object" }, "2024-01-01T00:00:00.000Z"),
  );

  resetSchemaRegistry();

  const instance2 = getSchemaRegistry();
  const schemas = instance2.listForDomain("before-reset");
  assert.equal(schemas.length, 0);

  assert.notEqual(instance1, instance2);
});

test("SchemaRegistry integration: returns null for non-existent schemas", () => {
  const registry = new SchemaRegistry();

  const latest = registry.getLatest("non-existent", "input", "schema");
  assert.equal(latest, null);

  const version = registry.getVersion("non-existent", "input", "schema", "1.0.0");
  assert.equal(version, null);

  const versions = registry.listVersions("non-existent", "input", "schema");
  assert.deepEqual(versions, []);
});

test("SchemaRegistry integration: handles schema with type changes", () => {
  const registry = new SchemaRegistry();

  const v1 = createSchemaEntry(
    "type-change-domain",
    "input",
    "field",
    "1.0.0",
    { type: "object", properties: { count: { type: "number" } } },
    "2024-01-01T00:00:00.000Z",
  );

  const v2 = createSchemaEntry(
    "type-change-domain",
    "input",
    "field",
    "2.0.0",
    { type: "object", properties: { count: { type: "string" } } },
    "2024-06-01T00:00:00.000Z",
  );

  registry.register(v1);
  registry.register(v2);

  const result = registry.checkCompatibility(v1, v2);
  assert.equal(result.compatible, false);
  assert.ok(result.breakingChanges.some((c) => c.includes("count")));
});
