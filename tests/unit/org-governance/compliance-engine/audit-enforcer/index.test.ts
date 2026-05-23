import assert from "node:assert/strict";
import test from "node:test";

import { buildGovernanceAuditRecord, GovernanceAuditRecordSchema } from "../../../../../src/org-governance/compliance-engine/audit-enforcer/index.js";

test("buildGovernanceAuditRecord creates valid record", () => {
  const input = {
    recordId: "audit_123",
    action: "approve_request",
    actorId: "user_456",
    orgNodeId: "team_alpha",
    allowed: true,
    reasonCodes: [],
    occurredAt: "2026-04-26T10:00:00Z",
  };

  const result = buildGovernanceAuditRecord(input);

  assert.equal(result.recordId, "audit_123");
  assert.equal(result.action, "approve_request");
  assert.equal(result.actorId, "user_456");
  assert.equal(result.orgNodeId, "team_alpha");
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasonCodes, []);
});

test("buildGovernanceAuditRecord sets default reasonCodes", () => {
  const input = {
    recordId: "audit_789",
    action: "reject_request",
    actorId: "user_123",
    orgNodeId: "team_beta",
    allowed: false,
    reasonCodes: [],
    occurredAt: "2026-04-26T11:00:00Z",
  };

  const result = buildGovernanceAuditRecord(input);

  assert.deepEqual(result.reasonCodes, []);
});

test("GovernanceAuditRecordSchema rejects empty recordId", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "",
      action: "test_action",
      actorId: "user_1",
      orgNodeId: "node_1",
      allowed: true,
      reasonCodes: [],
      occurredAt: "2026-04-26T12:00:00Z",
    });
  });
});

test("GovernanceAuditRecordSchema rejects empty action", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "rec_1",
      action: "",
      actorId: "user_1",
      orgNodeId: "node_1",
      allowed: true,
      reasonCodes: [],
      occurredAt: "2026-04-26T12:00:00Z",
    });
  });
});

test("GovernanceAuditRecordSchema rejects empty actorId", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "rec_1",
      action: "action",
      actorId: "",
      orgNodeId: "node_1",
      allowed: true,
      reasonCodes: [],
      occurredAt: "2026-04-26T12:00:00Z",
    });
  });
});

test("GovernanceAuditRecordSchema rejects empty orgNodeId", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "rec_1",
      action: "action",
      actorId: "user_1",
      orgNodeId: "",
      allowed: true,
      reasonCodes: [],
      occurredAt: "2026-04-26T12:00:00Z",
    });
  });
});

test("GovernanceAuditRecordSchema rejects empty occurredAt", () => {
  assert.throws(() => {
    GovernanceAuditRecordSchema.parse({
      recordId: "rec_1",
      action: "action",
      actorId: "user_1",
      orgNodeId: "node_1",
      allowed: true,
      reasonCodes: [],
      occurredAt: "",
    });
  });
});

test("buildGovernanceAuditRecord preserves provided reasonCodes", () => {
  const input = {
    recordId: "audit_complex",
    action: "escalate",
    actorId: "manager_1",
    orgNodeId: "division_1",
    allowed: false,
    reasonCodes: ["threshold_exceeded", "risk_critical"],
    occurredAt: "2026-04-26T13:00:00Z",
  };

  const result = buildGovernanceAuditRecord(input);

  assert.deepEqual(result.reasonCodes, ["threshold_exceeded", "risk_critical"]);
});

test("buildGovernanceAuditRecord validates through schema", () => {
  const input = {
    recordId: "valid_audit",
    action: "approve",
    actorId: "admin_1",
    orgNodeId: "org_abc",
    allowed: true,
    reasonCodes: ["auto_approved"],
    occurredAt: "2026-04-26T14:00:00Z",
  };

  const result = buildGovernanceAuditRecord(input);
  // Should not throw - validates the record
  assert.equal(result.recordId, "valid_audit");
});
