import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGovernanceAuditRecord,
  GovernanceAuditRecordSchema,
} from "../../../src/org-governance/org-model/org-node/index.js";

test("buildGovernanceAuditRecord creates valid record", () => {
  const record = buildGovernanceAuditRecord({
    recordId: "audit_1",
    action: "access_decision",
    actorId: "user_1",
    orgNodeId: "node_1",
    allowed: true,
    reasonCodes: ["policy_allow"],
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.strictEqual(record.recordId, "audit_1");
  assert.strictEqual(record.action, "access_decision");
  assert.strictEqual(record.allowed, true);
});

test("GovernanceAuditRecordSchema validates required fields", () => {
  const validRecord = {
    recordId: "audit_1",
    action: "access",
    actorId: "user_1",
    orgNodeId: "node_1",
    allowed: false,
    occurredAt: "2026-04-20T00:00:00.000Z",
  };

  const parsed = GovernanceAuditRecordSchema.parse(validRecord);
  assert.deepStrictEqual(parsed.reasonCodes, []); // default
});

test("GovernanceAuditRecordSchema rejects empty recordId", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "",
      action: "access",
      actorId: "user_1",
      orgNodeId: "node_1",
      allowed: true,
      occurredAt: "2026-04-20T00:00:00.000Z",
    });
  });
});

test("GovernanceAuditRecordSchema rejects empty actorId", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "audit_1",
      action: "access",
      actorId: "",
      orgNodeId: "node_1",
      allowed: true,
      occurredAt: "2026-04-20T00:00:00.000Z",
    });
  });
});