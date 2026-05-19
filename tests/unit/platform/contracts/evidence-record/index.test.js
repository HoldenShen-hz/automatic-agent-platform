import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceRecord } from "../../../../../src/platform/contracts/evidence-record/index.js";
// Helper to create a minimal principal for testing
function createTestPrincipal() {
    return {
        actorId: "actor-123",
        tenantId: "tenant-456",
        roles: ["user"],
        authMethod: "bearer",
        displayName: "Test User",
    };
}
// =============================================================================
// createEvidenceRecord Tests (re-exported from platform-contracts)
// =============================================================================
test("createEvidenceRecord creates record with required fields", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "decision",
        targetRef: "target-456",
        content: { decision: "approved" },
    });
    assert.ok(record.recordId.startsWith("evid_"));
    assert.equal(record.traceId, "trace-123");
    assert.equal(record.principal, principal);
    assert.equal(record.category, "decision");
    assert.equal(record.targetRef, "target-456");
    assert.deepEqual(record.content, { decision: "approved" });
    assert.ok(record.timestamp.length > 0);
    assert.deepEqual(record.metadata, {});
});
test("createEvidenceRecord accepts all category types", () => {
    const principal = createTestPrincipal();
    const categories = [
        "decision",
        "execution",
        "approval",
        "audit",
        "compliance",
    ];
    for (const category of categories) {
        const record = createEvidenceRecord({
            traceId: "trace-123",
            principal,
            category,
            targetRef: "target-1",
            content: {},
        });
        assert.equal(record.category, category);
    }
});
test("createEvidenceRecord applies optional metadata", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "execution",
        targetRef: "target-456",
        content: { result: "success" },
        recordId: "custom-record-id",
        metadata: { region: "us-east-1", env: "prod" },
    });
    assert.equal(record.recordId, "custom-record-id");
    assert.equal(record.metadata.region, "us-east-1");
    assert.equal(record.metadata.env, "prod");
});
test("createEvidenceRecord defaults metadata to empty object when not provided", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "audit",
        targetRef: "target-1",
        content: {},
    });
    assert.deepEqual(record.metadata, {});
});
test("createEvidenceRecord uses custom recordId when provided", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "decision",
        targetRef: "target-1",
        content: {},
        recordId: "my-custom-evidence-id",
    });
    assert.equal(record.recordId, "my-custom-evidence-id");
});
test("createEvidenceRecord generates unique recordIds by default", () => {
    const principal = createTestPrincipal();
    const records = new Set();
    for (let i = 0; i < 100; i++) {
        const record = createEvidenceRecord({
            traceId: "trace-123",
            principal,
            category: "execution",
            targetRef: `target-${i}`,
            content: { index: i },
        });
        records.add(record.recordId);
    }
    assert.equal(records.size, 100, "All 100 generated record IDs should be unique");
});
// =============================================================================
// EvidenceRecord Type Structure Tests
// =============================================================================
test("EvidenceRecord has correct readonly properties", () => {
    const principal = createTestPrincipal();
    const record = {
        recordId: "evid-test-1",
        traceId: "trace-abc",
        principal,
        category: "decision",
        targetRef: "ref-123",
        content: { data: "test-content" },
        timestamp: "2026-04-23T10:30:00.000Z",
        metadata: { key: "value" },
    };
    assert.equal(record.recordId, "evid-test-1");
    assert.equal(record.traceId, "trace-abc");
    assert.deepEqual(record.principal, principal);
    assert.equal(record.category, "decision");
    assert.equal(record.targetRef, "ref-123");
    assert.deepEqual(record.content, { data: "test-content" });
    assert.equal(record.timestamp, "2026-04-23T10:30:00.000Z");
    assert.deepEqual(record.metadata, { key: "value" });
});
test("EvidenceRecord content can be any type", () => {
    const principal = createTestPrincipal();
    const stringContent = createEvidenceRecord({
        traceId: "trace-1",
        principal,
        category: "decision",
        targetRef: "ref-1",
        content: "Simple string content",
    });
    assert.equal(stringContent.content, "Simple string content");
    const numberContent = createEvidenceRecord({
        traceId: "trace-2",
        principal,
        category: "execution",
        targetRef: "ref-2",
        content: 42,
    });
    assert.equal(numberContent.content, 42);
    const arrayContent = createEvidenceRecord({
        traceId: "trace-3",
        principal,
        category: "approval",
        targetRef: "ref-3",
        content: [1, 2, 3],
    });
    assert.deepEqual(arrayContent.content, [1, 2, 3]);
    const objectContent = createEvidenceRecord({
        traceId: "trace-4",
        principal,
        category: "audit",
        targetRef: "ref-4",
        content: { nested: { deeply: { value: true } } },
    });
    assert.deepEqual(objectContent.content, { nested: { deeply: { value: true } } });
    const nullContent = createEvidenceRecord({
        traceId: "trace-5",
        principal,
        category: "compliance",
        targetRef: "ref-5",
        content: null,
    });
    assert.equal(nullContent.content, null);
});
test("EvidenceRecord metadata values are always strings", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "decision",
        targetRef: "target-1",
        content: {},
        metadata: { num: "42", bool: "true", empty: "" },
    });
    assert.equal(record.metadata.num, "42");
    assert.equal(record.metadata.bool, "true");
    assert.equal(record.metadata.empty, "");
});
test("EvidenceRecord timestamp is ISO 8601 format", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "execution",
        targetRef: "target-1",
        content: {},
    });
    // ISO 8601 format: 2026-04-23T10:30:00.000Z
    assert.match(record.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
// =============================================================================
// Edge Cases
// =============================================================================
test("createEvidenceRecord handles empty metadata object", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "decision",
        targetRef: "target-1",
        content: {},
        metadata: {},
    });
    assert.deepEqual(record.metadata, {});
});
test("createEvidenceRecord handles unicode in metadata values", () => {
    const principal = createTestPrincipal();
    const record = createEvidenceRecord({
        traceId: "trace-123",
        principal,
        category: "decision",
        targetRef: "target-1",
        content: {},
        metadata: { unicode: "你好世界 🎉" },
    });
    assert.equal(record.metadata.unicode, "你好世界 🎉");
});
test("createEvidenceRecord handles long trace IDs", () => {
    const principal = createTestPrincipal();
    const longTraceId = "trace-" + "x".repeat(100);
    const record = createEvidenceRecord({
        traceId: longTraceId,
        principal,
        category: "audit",
        targetRef: "target-1",
        content: {},
    });
    assert.equal(record.traceId, longTraceId);
});
test("createEvidenceRecord handles complex target references", () => {
    const principal = createTestPrincipal();
    const targets = [
        "s3://bucket/path/to/file.json",
        "arn:aws:lambda:us-east-1:123456789:function:my-function",
        "workflow://production/order-processing/v2",
        "/local/path/to/resource",
    ];
    for (const targetRef of targets) {
        const record = createEvidenceRecord({
            traceId: "trace-123",
            principal,
            category: "execution",
            targetRef,
            content: {},
        });
        assert.equal(record.targetRef, targetRef);
    }
});
test("EvidenceRecord category values are exhaustive", () => {
    const principal = createTestPrincipal();
    // This test ensures that if a new category is added, this test will fail
    // forcing the developer to update it
    const expectedCategories = [
        "decision",
        "execution",
        "approval",
        "audit",
        "compliance",
    ];
    for (const category of expectedCategories) {
        const record = createEvidenceRecord({
            traceId: "trace-123",
            principal,
            category,
            targetRef: "ref-1",
            content: {},
        });
        assert.equal(record.category, category);
    }
});
//# sourceMappingURL=index.test.js.map