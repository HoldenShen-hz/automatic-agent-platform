import assert from "node:assert/strict";
import test from "node:test";
import { createProjectionUpdate } from "../../../../../src/platform/contracts/projection-update/index.js";
// =============================================================================
// ProjectionUpdate Contract Tests
// =============================================================================
test("createProjectionUpdate returns object matching ProjectionUpdate interface", () => {
    const result = createProjectionUpdate({
        projectionId: "proj-contract-test",
        projectionType: "contract-test-type",
        version: 1,
        sourceEvents: ["evt-contract-1"],
        patch: { field: "value" },
        triggeredBy: "contract-tester",
    });
    // Type check: result should be assignable to ProjectionUpdate
    const _check = result;
    assert.equal(result.projectionId, "proj-contract-test");
    assert.equal(result.projectionType, "contract-test-type");
    assert.equal(result.version, 1);
    assert.deepEqual(result.sourceEvents, ["evt-contract-1"]);
    assert.deepEqual(result.patch, { field: "value" });
});
test("createProjectionUpdate includes all required metadata fields", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-meta",
        projectionType: "meta-type",
        version: 2,
        sourceEvents: [],
        patch: {},
        triggeredBy: "meta-trigger",
    });
    assert.ok(update.metadata);
    assert.equal(update.metadata.triggeredBy, "meta-trigger");
    assert.ok(update.metadata.idempotencyKey);
    assert.ok(update.metadata.idempotencyKey.length > 0);
});
test("createProjectionUpdate metadata.rebuiltAt is absent when not provided", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-no-rebuilt",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "system",
    });
    assert.equal(update.metadata.rebuiltAt, undefined);
});
test("createProjectionUpdate includes rebuiltAt when provided", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-with-rebuilt",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "rebuilder",
        rebuiltAt: "2026-03-15T10:00:00.000Z",
    });
    assert.equal(update.metadata.rebuiltAt, "2026-03-15T10:00:00.000Z");
});
test("createProjectionUpdate idempotencyKey can be customized", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-custom-key",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "system",
        idempotencyKey: "my-custom-key-xyz",
    });
    assert.equal(update.metadata.idempotencyKey, "my-custom-key-xyz");
});
test("createProjectionUpdate auto-generates idempotencyKey when not provided", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-auto-key",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "system",
    });
    assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
});
test("createProjectionUpdate generates distinct keys on each call", () => {
    const keys = new Set();
    const updates = Array.from({ length: 50 }, () => createProjectionUpdate({
        projectionId: "proj-distinct",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "system",
    }));
    for (const update of updates) {
        keys.add(update.metadata.idempotencyKey);
    }
    assert.equal(keys.size, 50, "Each update should have a unique idempotencyKey");
});
test("createProjectionUpdate sets timestamp to current ISO time", () => {
    const before = new Date().toISOString();
    const update = createProjectionUpdate({
        projectionId: "proj-timestamp",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "system",
    });
    const after = new Date().toISOString();
    assert.ok(update.timestamp >= before);
    assert.ok(update.timestamp <= after);
});
test("createProjectionUpdate preserves patch contents exactly", () => {
    const complexPatch = {
        numbers: [1, 2, 3, 4, 5],
        nested: { deep: { value: 42 } },
        bool: true,
        null: null,
        string: "test-string",
    };
    const update = createProjectionUpdate({
        projectionId: "proj-complex-patch",
        projectionType: "test",
        version: 1,
        sourceEvents: ["evt-1", "evt-2", "evt-3"],
        patch: complexPatch,
        triggeredBy: "test",
    });
    assert.deepEqual(update.patch, complexPatch);
    assert.equal(update.patch.nested.deep.value, 42);
});
test("createProjectionUpdate allows empty sourceEvents array", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-empty-events",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test",
    });
    assert.deepEqual(update.sourceEvents, []);
    assert.equal(update.sourceEvents.length, 0);
});
test("createProjectionUpdate handles version numbers correctly", () => {
    const versions = [0, 1, 100, 999999];
    for (const version of versions) {
        const update = createProjectionUpdate({
            projectionId: `proj-v${version}`,
            projectionType: "test",
            version,
            sourceEvents: [],
            patch: {},
            triggeredBy: "test",
        });
        assert.equal(update.version, version);
    }
});
test("ProjectionUpdate interface structure validation", () => {
    const update = {
        projectionId: "proj-interface",
        projectionType: "interface-test",
        version: 5,
        timestamp: "2026-04-24T12:00:00.000Z",
        sourceEvents: ["evt-a", "evt-b"],
        patch: { key: "value" },
        metadata: {
            triggeredBy: "interface-validator",
            idempotencyKey: "key-interface",
        },
    };
    assert.equal(update.projectionId, "proj-interface");
    assert.equal(update.projectionType, "interface-test");
    assert.equal(update.version, 5);
    assert.equal(update.timestamp, "2026-04-24T12:00:00.000Z");
    assert.deepEqual(update.sourceEvents, ["evt-a", "evt-b"]);
    assert.deepEqual(update.patch, { key: "value" });
    assert.equal(update.metadata.triggeredBy, "interface-validator");
    assert.equal(update.metadata.idempotencyKey, "key-interface");
    assert.equal(update.metadata.rebuiltAt, undefined);
});
test("ProjectionUpdate interface allows optional rebuiltAt in metadata", () => {
    const update = {
        projectionId: "proj-optional",
        projectionType: "test",
        version: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
        sourceEvents: [],
        patch: {},
        metadata: {
            rebuiltAt: "2026-01-02T00:00:00.000Z",
            triggeredBy: "test",
            idempotencyKey: "key-opt",
        },
    };
    assert.equal(update.metadata.rebuiltAt, "2026-01-02T00:00:00.000Z");
});
test("createProjectionUpdate patch is readonly Record<string, unknown>", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-readonly-patch",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: { readonly: true },
        triggeredBy: "test",
    });
    // Verify patch is typed correctly
    const _patch = update.patch;
    assert.equal(update.patch.readonly, true);
});
test("createProjectionUpdate with maximum field values", () => {
    const longId = "proj-" + "a".repeat(200);
    const update = createProjectionUpdate({
        projectionId: longId,
        projectionType: "max-test",
        version: Number.MAX_SAFE_INTEGER,
        sourceEvents: Array.from({ length: 100 }, (_, i) => `evt-${i}`),
        patch: { max: true },
        triggeredBy: "max-tester",
        idempotencyKey: "max-key",
    });
    assert.equal(update.projectionId, longId);
    assert.equal(update.version, Number.MAX_SAFE_INTEGER);
    assert.equal(update.sourceEvents.length, 100);
    assert.equal(update.metadata.idempotencyKey, "max-key");
});
test("createProjectionUpdate handles special characters in triggeredBy", () => {
    const specialTriggers = [
        "user@example.com",
        "system-process-123",
        "urn:example:entity",
        "emoji-trigger-🎯",
    ];
    for (const triggeredBy of specialTriggers) {
        const update = createProjectionUpdate({
            projectionId: `proj-special-${triggeredBy.length}`,
            projectionType: "test",
            version: 1,
            sourceEvents: [],
            patch: {},
            triggeredBy,
        });
        assert.equal(update.metadata.triggeredBy, triggeredBy);
    }
});
test("createProjectionUpdate sourceEvents immutability", () => {
    const events = ["evt-1", "evt-2", "evt-3"];
    const update = createProjectionUpdate({
        projectionId: "proj-immutable",
        projectionType: "test",
        version: 1,
        sourceEvents: events,
        patch: {},
        triggeredBy: "test",
    });
    // Verify sourceEvents is readonly
    const _events = update.sourceEvents;
    assert.deepEqual(update.sourceEvents, events);
});
test("createProjectionUpdate metadata immutability", () => {
    const update = createProjectionUpdate({
        projectionId: "proj-meta-immutable",
        projectionType: "test",
        version: 1,
        sourceEvents: [],
        patch: {},
        triggeredBy: "test",
    });
    // Verify metadata is readonly
    const _metadata = update.metadata;
    assert.equal(update.metadata.triggeredBy, "test");
});
//# sourceMappingURL=projection-update.test.js.map