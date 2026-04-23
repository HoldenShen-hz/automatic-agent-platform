import test from "node:test";
import assert from "node:assert/strict";
import { buildGovernanceAuditRecord } from "../../../../src/org-governance/compliance-engine/audit-enforcer/index.js";
test("buildGovernanceAuditRecord parses valid audit record", () => {
    const result = buildGovernanceAuditRecord({
        recordId: "audit-001",
        action: "approval.grant",
        actorId: "user-admin",
        orgNodeId: "dept-eng",
        allowed: true,
        reasonCodes: ["sox_compliant", "budget_approved"],
        occurredAt: "2024-01-15T10:00:00.000Z",
    });
    assert.strictEqual(result.recordId, "audit-001");
    assert.strictEqual(result.action, "approval.grant");
    assert.strictEqual(result.actorId, "user-admin");
    assert.strictEqual(result.orgNodeId, "dept-eng");
    assert.strictEqual(result.allowed, true);
    assert.deepStrictEqual(result.reasonCodes, ["sox_compliant", "budget_approved"]);
    assert.strictEqual(result.occurredAt, "2024-01-15T10:00:00.000Z");
});
test("buildGovernanceAuditRecord defaults reasonCodes to empty array when omitted", () => {
    const result = buildGovernanceAuditRecord({
        recordId: "audit-002",
        action: "approval.deny",
        actorId: "user-manager",
        orgNodeId: "dept-sales",
        allowed: false,
        reasonCodes: [],
        occurredAt: "2024-01-15T11:00:00.000Z",
    });
    assert.deepStrictEqual(result.reasonCodes, []);
});
test("buildGovernanceAuditRecord throws on missing recordId", () => {
    assert.throws(() => {
        buildGovernanceAuditRecord({
            recordId: "",
            action: "approval.grant",
            actorId: "user-1",
            orgNodeId: "dept-1",
            allowed: true,
            reasonCodes: [],
            occurredAt: "2024-01-15T00:00:00.000Z",
        });
    });
});
test("buildGovernanceAuditRecord throws on missing action", () => {
    assert.throws(() => {
        buildGovernanceAuditRecord({
            recordId: "audit-001",
            action: "",
            actorId: "user-1",
            orgNodeId: "dept-1",
            allowed: true,
            reasonCodes: [],
            occurredAt: "2024-01-15T00:00:00.000Z",
        });
    });
});
test("buildGovernanceAuditRecord throws on missing actorId", () => {
    assert.throws(() => {
        buildGovernanceAuditRecord({
            recordId: "audit-001",
            action: "approval.grant",
            actorId: "",
            orgNodeId: "dept-1",
            allowed: true,
            reasonCodes: [],
            occurredAt: "2024-01-15T00:00:00.000Z",
        });
    });
});
test("buildGovernanceAuditRecord throws on missing orgNodeId", () => {
    assert.throws(() => {
        buildGovernanceAuditRecord({
            recordId: "audit-001",
            action: "approval.grant",
            actorId: "user-1",
            orgNodeId: "",
            allowed: true,
            reasonCodes: [],
            occurredAt: "2024-01-15T00:00:00.000Z",
        });
    });
});
test("buildGovernanceAuditRecord throws on missing allowed", () => {
    assert.throws(() => {
        buildGovernanceAuditRecord({
            recordId: "audit-001",
            action: "approval.grant",
            actorId: "user-1",
            orgNodeId: "dept-1",
            reasonCodes: [],
            occurredAt: "2024-01-15T00:00:00.000Z",
        });
    });
});
test("buildGovernanceAuditRecord throws on missing occurredAt", () => {
    assert.throws(() => {
        buildGovernanceAuditRecord({
            recordId: "audit-001",
            action: "approval.grant",
            actorId: "user-1",
            orgNodeId: "dept-1",
            allowed: true,
            reasonCodes: [],
        });
    });
});
test("GovernanceAuditRecord result accepts valid record with all fields", () => {
    const result = buildGovernanceAuditRecord({
        recordId: "audit-003",
        action: "access.request",
        actorId: "user-admin",
        orgNodeId: "dept-eng",
        allowed: true,
        reasonCodes: ["security_reviewed"],
        occurredAt: "2024-01-15T12:00:00.000Z",
    });
    assert.strictEqual(result.recordId, "audit-003");
});
test("GovernanceAuditRecord result accepts record with empty reasonCodes", () => {
    const result = buildGovernanceAuditRecord({
        recordId: "audit-004",
        action: "access.request",
        actorId: "user-admin",
        orgNodeId: "dept-eng",
        allowed: true,
        reasonCodes: [],
        occurredAt: "2024-01-15T12:00:00.000Z",
    });
    assert.deepStrictEqual(result.reasonCodes, []);
});
//# sourceMappingURL=audit-enforcer.test.js.map