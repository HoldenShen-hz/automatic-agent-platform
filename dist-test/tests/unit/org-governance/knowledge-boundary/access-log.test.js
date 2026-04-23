import assert from "node:assert/strict";
import test from "node:test";
import { redactKnowledgeAccessLog, KnowledgeAccessLogRecordSchema } from "../../../../src/org-governance/knowledge-boundary/access-log/index.js";
test("redactKnowledgeAccessLog redacts requesterId with prefix and first 4 chars", () => {
    const record = {
        recordId: "log_123",
        requesterId: "user_alice_test",
        boundaryId: "kb_finance",
        purpose: "audit",
        allowed: true,
        occurredAt: "2026-04-20T00:00:00.000Z",
    };
    const redacted = redactKnowledgeAccessLog(record);
    assert.strictEqual(redacted.recordId, "log_123");
    assert.strictEqual(redacted.requesterId, "redacted:user");
    assert.strictEqual(redacted.boundaryId, "kb_finance");
    assert.strictEqual(redacted.purpose, "audit");
    assert.strictEqual(redacted.allowed, true);
    assert.strictEqual(redacted.occurredAt, "2026-04-20T00:00:00.000Z");
});
test("redactKnowledgeAccessLog handles short requesterId", () => {
    const record = {
        recordId: "log_456",
        requesterId: "ab",
        boundaryId: "kb_hr",
        purpose: "review",
        allowed: false,
        occurredAt: "2026-04-21T00:00:00.000Z",
    };
    const redacted = redactKnowledgeAccessLog(record);
    assert.strictEqual(redacted.requesterId, "redacted:ab");
});
test("redactKnowledgeAccessLog does not mutate original record", () => {
    const record = {
        recordId: "log_789",
        requesterId: "original_user",
        boundaryId: "kb_legal",
        purpose: "compliance",
        allowed: true,
        occurredAt: "2026-04-22T00:00:00.000Z",
    };
    redactKnowledgeAccessLog(record);
    assert.strictEqual(record.requesterId, "original_user");
});
test("KnowledgeAccessLogRecordSchema validates correct record", () => {
    const validRecord = {
        recordId: "log_valid",
        requesterId: "user_123",
        boundaryId: "kb_test",
        purpose: "testing",
        allowed: true,
        occurredAt: "2026-04-23T00:00:00.000Z",
    };
    const result = KnowledgeAccessLogRecordSchema.safeParse(validRecord);
    assert.strictEqual(result.success, true);
});
test("KnowledgeAccessLogRecordSchema rejects empty recordId", () => {
    const invalidRecord = {
        recordId: "",
        requesterId: "user_123",
        boundaryId: "kb_test",
        purpose: "testing",
        allowed: true,
        occurredAt: "2026-04-23T00:00:00.000Z",
    };
    const result = KnowledgeAccessLogRecordSchema.safeParse(invalidRecord);
    assert.strictEqual(result.success, false);
});
//# sourceMappingURL=access-log.test.js.map