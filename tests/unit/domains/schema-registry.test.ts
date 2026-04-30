import assert from "node:assert/strict";
import test from "node:test";

import { SchemaRegistry, getSchemaRegistry, resetSchemaRegistry } from "../../../src/domains/registry/schema-registry.js";

function makeSchemaEntry(domainId: string, schemaType: "input" | "output" | "contract", schemaId: string, version: string, isActive = true): Parameters<SchemaRegistry["register"]>[0] {
  return {
    domainId,
    schemaType,
    schemaId,
    version,
    schema: { type: "object", properties: { field_a: { type: "string" } } },
    createdAt: "2024-01-01T00:00:00.000Z",
    deprecatedAt: null,
    isActive,
  };
}

test("SchemaRegistry.register stores entry", () => {
  const registry = new SchemaRegistry();
  const entry = makeSchemaEntry("test_domain", "input", "input_schema", "1.0.0");
  const registered = registry.register(entry);

  assert.equal(registered.domainId, "test_domain");
  assert.equal(registered.schemaId, "input_schema");
  assert.equal(registered.version, "1.0.0");
});

test("SchemaRegistry.register rejects duplicate version", () => {
  const registry = new SchemaRegistry();
  const entry = makeSchemaEntry("test_domain", "input", "dup_schema", "1.0.0");
  registry.register(entry);

  assert.throws(() => {
    registry.register(entry);
  }, /Schema dup_schema version 1.0.0 already registered\.|duplicate_version/);
});

test("SchemaRegistry.getLatest returns latest active version", () => {
  const registry = new SchemaRegistry();
  registry.register(makeSchemaEntry("domain_a", "input", "schema_x", "1.0.0", false));
  registry.register(makeSchemaEntry("domain_a", "input", "schema_x", "2.0.0", true));

  const latest = registry.getLatest("domain_a", "input", "schema_x");
  assert.notEqual(latest, null);
  assert.equal(latest!.version, "2.0.0");
});

test("SchemaRegistry.getLatest returns null when no versions exist", () => {
  const registry = new SchemaRegistry();
  const result = registry.getLatest("nonexistent", "input", "schema_x");
  assert.equal(result, null);
});

test("SchemaRegistry.getVersion returns specific version", () => {
  const registry = new SchemaRegistry();
  registry.register(makeSchemaEntry("domain_b", "output", "out_schema", "1.0.0", false));
  registry.register(makeSchemaEntry("domain_b", "output", "out_schema", "2.0.0", true));

  const v1 = registry.getVersion("domain_b", "output", "out_schema", "1.0.0");
  const v2 = registry.getVersion("domain_b", "output", "out_schema", "2.0.0");

  assert.notEqual(v1, null);
  assert.equal(v1!.version, "1.0.0");
  assert.notEqual(v2, null);
  assert.equal(v2!.version, "2.0.0");
});

test("SchemaRegistry.getVersion returns null for unknown version", () => {
  const registry = new SchemaRegistry();
  const result = registry.getVersion("domain_c", "input", "schema", "99.0.0");
  assert.equal(result, null);
});

test("SchemaRegistry.listVersions returns all versions sorted by createdAt", () => {
  const registry = new SchemaRegistry();
  registry.register(makeSchemaEntry("domain_d", "contract", "contract_schema", "1.0.0"));
  registry.register(makeSchemaEntry("domain_d", "contract", "contract_schema", "2.0.0"));
  registry.register(makeSchemaEntry("domain_d", "contract", "contract_schema", "3.0.0"));

  const versions = registry.listVersions("domain_d", "contract", "contract_schema");
  assert.equal(versions.length, 3);
  assert.equal(versions[0].version, "1.0.0");
  assert.equal(versions[2].version, "3.0.0");
});

test("SchemaRegistry.checkCompatibility detects no changes for same version", () => {
  const registry = new SchemaRegistry();
  const entry = makeSchemaEntry("domain_e", "input", "check_schema", "1.0.0");

  const result = registry.checkCompatibility(entry, entry);
  assert.equal(result.compatible, true);
  assert.equal(result.breakingChanges.length, 0);
});

test("SchemaRegistry.checkCompatibility detects breaking changes", () => {
  const registry = new SchemaRegistry();
  const fromEntry: Parameters<SchemaRegistry["register"]>[0] = {
    domainId: "domain_f",
    schemaType: "output",
    schemaId: "compat_test",
    version: "1.0.0",
    schema: {
      type: "object",
      properties: {
        required_field: { type: "string", required: true },
      },
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    deprecatedAt: null,
    isActive: true,
  };

  const toEntry: Parameters<SchemaRegistry["register"]>[0] = {
    domainId: "domain_f",
    schemaType: "output",
    schemaId: "compat_test",
    version: "2.0.0",
    schema: {
      type: "object",
      properties: {},
    },
    createdAt: "2024-02-01T00:00:00.000Z",
    deprecatedAt: null,
    isActive: true,
  };

  const result = registry.checkCompatibility(fromEntry, toEntry);
  assert.equal(result.compatible, false);
  assert.ok(result.breakingChanges.some((c) => c.includes("required_field")));
});

test("SchemaRegistry.checkCompatibility warns on new optional fields", () => {
  const registry = new SchemaRegistry();
  const fromEntry: Parameters<SchemaRegistry["register"]>[0] = {
    domainId: "domain_g",
    schemaType: "input",
    schemaId: "optional_test",
    version: "1.0.0",
    schema: { type: "object", properties: {} },
    createdAt: "2024-01-01T00:00:00.000Z",
    deprecatedAt: null,
    isActive: true,
  };

  const toEntry: Parameters<SchemaRegistry["register"]>[0] = {
    domainId: "domain_g",
    schemaType: "input",
    schemaId: "optional_test",
    version: "2.0.0",
    schema: {
      type: "object",
      properties: { new_optional: { type: "string" } },
    },
    createdAt: "2024-02-01T00:00:00.000Z",
    deprecatedAt: null,
    isActive: true,
  };

  const result = registry.checkCompatibility(fromEntry, toEntry);
  assert.equal(result.compatible, true);
  assert.ok(result.warnings.some((w) => w.includes("new_optional")));
  assert.ok(result.migrationHints.some((h) => h.includes("new_optional")));
});

test("SchemaRegistry.deprecate marks version as inactive", () => {
  const registry = new SchemaRegistry();
  registry.register(makeSchemaEntry("domain_h", "input", "dep_schema", "1.0.0"));

  const deprecated = registry.deprecate("domain_h", "input", "dep_schema", "1.0.0", "2024-06-01T00:00:00.000Z");
  assert.equal(deprecated, true);

  const entry = registry.getVersion("domain_h", "input", "dep_schema", "1.0.0");
  assert.notEqual(entry, null);
  assert.equal(entry!.isActive, false);
  assert.ok(entry!.deprecatedAt != null);
});

test("SchemaRegistry.deprecate returns false for unknown schema", () => {
  const registry = new SchemaRegistry();
  const result = registry.deprecate("nonexistent", "input", "schema", "1.0.0", "2024-06-01T00:00:00.000Z");
  assert.equal(result, false);
});

test("SchemaRegistry.listForDomain returns active schemas for domain", () => {
  const registry = new SchemaRegistry();
  registry.register(makeSchemaEntry("domain_i", "input", "in1", "1.0.0", true));
  registry.register(makeSchemaEntry("domain_i", "output", "out1", "1.0.0", true));
  registry.register(makeSchemaEntry("domain_i", "input", "in2", "1.0.0", false));
  registry.register(makeSchemaEntry("other_domain", "input", "other", "1.0.0", true));

  const listed = registry.listForDomain("domain_i");
  assert.equal(listed.length, 2);
  assert.ok(listed.every((e) => e.domainId === "domain_i" && e.isActive));
});

test("getSchemaRegistry returns singleton instance", () => {
  resetSchemaRegistry();
  const instance1 = getSchemaRegistry();
  const instance2 = getSchemaRegistry();
  assert.strictEqual(instance1, instance2);
});

test("resetSchemaRegistry clears singleton", () => {
  const instance1 = getSchemaRegistry();
  resetSchemaRegistry();
  const instance2 = getSchemaRegistry();
  assert.notStrictEqual(instance1, instance2);
});
