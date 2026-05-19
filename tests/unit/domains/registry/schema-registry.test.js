import assert from "node:assert/strict";
import test from "node:test";
import { SchemaRegistry, getSchemaRegistry, resetSchemaRegistry, } from "../../../src/domains/registry/schema-registry.js";
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry Registration Tests
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.register stores schema entry", () => {
    const registry = new SchemaRegistry();
    const entry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task-input",
        version: "1.0.0",
        schema: { type: "object", properties: { name: { type: "string" } } },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const result = registry.register(entry);
    assert.equal(result.domainId, "test-domain");
    assert.equal(result.schemaId, "task-input");
    assert.equal(result.version, "1.0.0");
    assert.equal(result.isActive, true);
});
test("SchemaRegistry.register rejects duplicate version", () => {
    const registry = new SchemaRegistry();
    const entry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task-input",
        version: "1.0.0",
        schema: { type: "object" },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    registry.register(entry);
    assert.throws(() => {
        registry.register(entry);
    }, /duplicate_version/);
});
test("SchemaRegistry.register marks previous version as deprecated when adding new version", () => {
    const registry = new SchemaRegistry();
    const entry1 = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task-input",
        version: "1.0.0",
        schema: { type: "object" },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const entry2 = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task-input",
        version: "2.0.0",
        schema: { type: "object", properties: { name: { type: "string" } } },
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    registry.register(entry1);
    registry.register(entry2);
    // Version 1.0.0 should now be deprecated
    const v1 = registry.getVersion("test-domain", "input", "task-input", "1.0.0");
    assert.notEqual(v1, null);
    assert.equal(v1.isActive, false);
    assert.notEqual(v1.deprecatedAt, null);
});
test("SchemaRegistry.register accepts different schema types for same schemaId", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    registry.register({
        domainId: "test-domain",
        schemaType: "output",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const inputSchema = registry.getLatest("test-domain", "input", "task");
    const outputSchema = registry.getLatest("test-domain", "output", "task");
    assert.notEqual(inputSchema, null);
    assert.notEqual(outputSchema, null);
    assert.equal(inputSchema.schemaType, "input");
    assert.equal(outputSchema.schemaType, "output");
});
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry getLatest Tests
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.getLatest returns latest active version", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: { type: "object" },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: false,
    });
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: { type: "object" },
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const latest = registry.getLatest("test-domain", "input", "task");
    assert.notEqual(latest, null);
    assert.equal(latest.version, "2.0.0");
});
test("SchemaRegistry.getLatest returns null for unknown domain", () => {
    const registry = new SchemaRegistry();
    const result = registry.getLatest("unknown", "input", "schema");
    assert.equal(result, null);
});
test("SchemaRegistry.getLatest returns null for unknown schemaId", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "known",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const result = registry.getLatest("test-domain", "input", "unknown");
    assert.equal(result, null);
});
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry getVersion Tests
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.getVersion returns specific version", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: { type: "object" },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const result = registry.getVersion("test-domain", "input", "task", "1.0.0");
    assert.notEqual(result, null);
    assert.equal(result.version, "1.0.0");
});
test("SchemaRegistry.getVersion returns null for unknown version", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const result = registry.getVersion("test-domain", "input", "task", "99.0.0");
    assert.equal(result, null);
});
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry listVersions Tests
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.listVersions returns all versions sorted by createdAt", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: {},
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const versions = registry.listVersions("test-domain", "input", "task");
    assert.equal(versions.length, 2);
    assert.equal(versions[0].version, "1.0.0");
    assert.equal(versions[1].version, "2.0.0");
});
test("SchemaRegistry.listVersions returns empty array for unknown schema", () => {
    const registry = new SchemaRegistry();
    const result = registry.listVersions("unknown", "input", "unknown");
    assert.deepEqual(result, []);
});
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry checkCompatibility Tests (R8-29)
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.checkCompatibility returns compatible for same version", () => {
    const registry = new SchemaRegistry();
    const entry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: { type: "object" },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const result = registry.checkCompatibility(entry, entry);
    assert.equal(result.compatible, true);
    assert.deepEqual(result.breakingChanges, []);
});
test("SchemaRegistry.checkCompatibility detects removed required fields", () => {
    const registry = new SchemaRegistry();
    const fromEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {
            type: "object",
            properties: {
                requiredField: { type: "string", required: true },
                optionalField: { type: "number" },
            },
        },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const toEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: {
            type: "object",
            properties: {
                optionalField: { type: "number" },
            },
        },
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const result = registry.checkCompatibility(fromEntry, toEntry);
    assert.equal(result.compatible, false);
    assert.ok(result.breakingChanges.some((c) => c.includes("requiredField")));
});
test("SchemaRegistry.checkCompatibility detects changed field types", () => {
    const registry = new SchemaRegistry();
    const fromEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {
            type: "object",
            properties: {
                field: { type: "string" },
            },
        },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const toEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: {
            type: "object",
            properties: {
                field: { type: "number" },
            },
        },
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const result = registry.checkCompatibility(fromEntry, toEntry);
    assert.equal(result.compatible, false);
    assert.ok(result.breakingChanges.some((c) => c.includes("field") && c.includes("string") && c.includes("number")));
});
test("SchemaRegistry.checkCompatibility warns about new optional fields", () => {
    const registry = new SchemaRegistry();
    const fromEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: { type: "object", properties: {} },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const toEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: {
            type: "object",
            properties: {
                newField: { type: "string" },
            },
        },
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const result = registry.checkCompatibility(fromEntry, toEntry);
    assert.equal(result.compatible, true);
    assert.ok(result.warnings.some((w) => w.includes("newField")));
    assert.ok(result.migrationHints.some((h) => h.includes("newField")));
});
test("SchemaRegistry.checkCompatibility is compatible when only adding optional fields", () => {
    const registry = new SchemaRegistry();
    const fromEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {
            type: "object",
            properties: {
                existingField: { type: "string" },
            },
        },
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const toEntry = {
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: {
            type: "object",
            properties: {
                existingField: { type: "string" },
                newOptionalField: { type: "number" },
            },
        },
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    };
    const result = registry.checkCompatibility(fromEntry, toEntry);
    assert.equal(result.compatible, true);
});
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry deprecate Tests
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.deprecate marks version as inactive", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const result = registry.deprecate("test-domain", "input", "task", "1.0.0", "2024-12-01T00:00:00.000Z");
    assert.equal(result, true);
    const entry = registry.getVersion("test-domain", "input", "task", "1.0.0");
    assert.notEqual(entry, null);
    assert.equal(entry.isActive, false);
    assert.equal(entry.deprecatedAt, "2024-12-01T00:00:00.000Z");
});
test("SchemaRegistry.deprecate returns false for unknown version", () => {
    const registry = new SchemaRegistry();
    const result = registry.deprecate("unknown", "input", "schema", "1.0.0", "2024-12-01T00:00:00.000Z");
    assert.equal(result, false);
});
// ─────────────────────────────────────────────────────────────────────────────
// SchemaRegistry listForDomain Tests
// ─────────────────────────────────────────────────────────────────────────────
test("SchemaRegistry.listForDomain returns all active schemas for domain", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    registry.register({
        domainId: "test-domain",
        schemaType: "output",
        schemaId: "result",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const schemas = registry.listForDomain("test-domain");
    assert.equal(schemas.length, 2);
});
test("SchemaRegistry.listForDomain excludes deprecated schemas", () => {
    const registry = new SchemaRegistry();
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: false,
    });
    registry.register({
        domainId: "test-domain",
        schemaType: "input",
        schemaId: "task",
        version: "2.0.0",
        schema: {},
        createdAt: "2024-06-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    const schemas = registry.listForDomain("test-domain");
    assert.equal(schemas.length, 1);
    assert.equal(schemas[0].version, "2.0.0");
});
// ─────────────────────────────────────────────────────────────────────────────
// Global SchemaRegistry Instance Tests
// ─────────────────────────────────────────────────────────────────────────────
test("getSchemaRegistry returns singleton instance", () => {
    resetSchemaRegistry();
    const instance1 = getSchemaRegistry();
    const instance2 = getSchemaRegistry();
    assert.equal(instance1, instance2);
});
test("resetSchemaRegistry clears singleton", () => {
    resetSchemaRegistry();
    const instance1 = getSchemaRegistry();
    resetSchemaRegistry();
    const instance2 = getSchemaRegistry();
    assert.notEqual(instance1, instance2);
});
test("resetSchemaRegistry followed by getSchemaRegistry returns fresh instance", () => {
    const registry = getSchemaRegistry();
    registry.register({
        domainId: "before-reset",
        schemaType: "input",
        schemaId: "schema",
        version: "1.0.0",
        schema: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isActive: true,
    });
    resetSchemaRegistry();
    const freshRegistry = getSchemaRegistry();
    const schemas = freshRegistry.listForDomain("before-reset");
    assert.deepEqual(schemas, []);
});
//# sourceMappingURL=schema-registry.test.js.map