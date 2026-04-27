import assert from "node:assert/strict";
import test from "node:test";

import {
  KnowledgeAccessLogRecordSchema,
  redactKnowledgeAccessLog,
} from "../../../../../src/org-governance/knowledge-boundary/access-log/index.js";

test("KnowledgeAccessLogRecordSchema validates correct record", () => {
  const valid = {
    recordId: "log_123",
    requesterId: "user_456",
    boundaryId: "boundary_789",
    purpose: "research",
    allowed: true,
    occurredAt: "2026-04-14T12:00:00.000Z",
  };
  const result = KnowledgeAccessLogRecordSchema.parse(valid);
  assert.equal(result.recordId, "log_123");
  assert.equal(result.requesterId, "user_456");
  assert.equal(result.boundaryId, "boundary_789");
  assert.equal(result.purpose, "research");
  assert.equal(result.allowed, true);
});

test("KnowledgeAccessLogRecordSchema rejects empty recordId", () => {
  assert.throws(() => {
    KnowledgeAccessLogRecordSchema.parse({
      recordId: "",
      requesterId: "user_456",
      boundaryId: "boundary_789",
      purpose: "research",
      allowed: true,
      occurredAt: "2026-04-14T12:00:00.000Z",
    });
  });
});

test("redactKnowledgeAccessLog redacts requesterId", () => {
  const record = {
    recordId: "log_123",
    requesterId: "user_abcdef",
    boundaryId: "boundary_789",
    purpose: "research",
    allowed: true,
    occurredAt: "2026-04-14T12:00:00.000Z",
  };
  const result = redactKnowledgeAccessLog(record);
  assert.equal(result.recordId, "log_123");
  assert.equal(result.requesterId, "redacted:user");
  assert.equal(result.boundaryId, "boundary_789");
  assert.equal(result.purpose, "research");
  assert.equal(result.allowed, true);
});

test("redactKnowledgeAccessLog preserves other fields", () => {
  const record = {
    recordId: "log_abc",
    requesterId: "admin",
    boundaryId: "boundary_xyz",
    purpose: "analysis",
    allowed: false,
    occurredAt: "2026-04-14T15:30:00.000Z",
  };
  const result = redactKnowledgeAccessLog(record);
  assert.equal(result.recordId, "log_abc");
  assert.equal(result.boundaryId, "boundary_xyz");
  assert.equal(result.purpose, "analysis");
  assert.equal(result.allowed, false);
  assert.equal(result.occurredAt, "2026-04-14T15:30:00.000Z");
});

test("redactKnowledgeAccessLog handles short requesterId", () => {
  const record = {
    recordId: "log_123",
    requesterId: "ab",
    boundaryId: "boundary_789",
    purpose: "research",
    allowed: true,
    occurredAt: "2026-04-14T12:00:00.000Z",
  };
  const result = redactKnowledgeAccessLog(record);
  assert.equal(result.requesterId, "redacted:ab");
});

test("redactKnowledgeAccessLog handles 4-char requesterId", () => {
  const record = {
    recordId: "log_123",
    requesterId: "user",
    boundaryId: "boundary_789",
    purpose: "research",
    allowed: true,
    occurredAt: "2026-04-14T12:00:00.000Z",
  };
  const result = redactKnowledgeAccessLog(record);
  assert.equal(result.requesterId, "redacted:user");
});
