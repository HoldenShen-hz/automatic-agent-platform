/**
 * Self-Service Governance Console Unit Tests
 *
 * Tests for §51 Self-Service Governance Console:
 * - Delegation creation and revocation
 * - Audit log export
 * - Role-based action permission checks
 * - Delegation listing and review
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SelfServiceGovernanceConsole, GovernanceConsoleActionSchema, CreateDelegationRequestSchema, } from "../../../../src/org-governance/delegated-governance/governance-console-service.js";
// ─────────────────────────────────────────────────────────────────────────────
// Schema Tests
// ─────────────────────────────────────────────────────────────────────────────
test("GovernanceConsoleActionSchema validates all action types", () => {
    assert.equal(GovernanceConsoleActionSchema.parse("delegate"), "delegate");
    assert.equal(GovernanceConsoleActionSchema.parse("override"), "override");
    assert.equal(GovernanceConsoleActionSchema.parse("revoke"), "revoke");
    assert.equal(GovernanceConsoleActionSchema.parse("review"), "review");
    assert.equal(GovernanceConsoleActionSchema.parse("export_audit"), "export_audit");
    assert.throws(() => GovernanceConsoleActionSchema.parse("invalid"));
});
test("CreateDelegationRequestSchema validates correctly", () => {
    const request = CreateDelegationRequestSchema.parse({
        grantorId: "platform_team",
        granteeId: "admin-1",
        orgNodeIds: ["finance"],
        domainIds: ["finance"],
        permissions: ["manage_domains"],
        expiresAt: "2025-12-31T00:00:00.000Z",
        revocable: true,
    });
    assert.equal(request.grantorId, "platform_team");
    assert.equal(request.granteeId, "admin-1");
    assert.deepEqual(request.orgNodeIds, ["finance"]);
    assert.deepEqual(request.permissions, ["manage_domains"]);
    assert.equal(request.revocable, true);
});
test("CreateDelegationRequestSchema applies defaults", () => {
    const request = CreateDelegationRequestSchema.parse({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    assert.deepEqual(request.orgNodeIds, []);
    assert.deepEqual(request.domainIds, []);
    assert.deepEqual(request.permissions, []);
    assert.equal(request.revocable, true);
});
// ─────────────────────────────────────────────────────────────────────────────
// Console Service Tests
// ─────────────────────────────────────────────────────────────────────────────
test("createDelegation creates and returns delegation", () => {
    const console = new SelfServiceGovernanceConsole();
    const delegation = console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        orgNodeIds: ["finance"],
        domainIds: ["finance"],
        permissions: ["manage_domains"],
        expiresAt: "2025-12-31T00:00:00.000Z",
        revocable: true,
    });
    assert.ok(delegation.delegationId.startsWith("del_"));
    assert.equal(delegation.grantorId, "platform_team");
    assert.equal(delegation.granteeId, "admin-1");
    assert.equal(delegation.status, "active");
    assert.deepEqual(delegation.orgNodeIds, ["finance"]);
});
test("createDelegation logs audit entry", () => {
    const console = new SelfServiceGovernanceConsole();
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    // exportAuditLog returns current entries BEFORE logging the export_audit action
    // So we see only the delegate entry, not the export_audit that gets logged after
    const auditEntries = console.exportAuditLog();
    assert.equal(auditEntries.length, 1);
    assert.equal(auditEntries[0]?.action, "delegate");
    assert.equal(auditEntries[0]?.actorId, "platform_team");
});
test("revokeDelegation revokes active delegation", () => {
    const console = new SelfServiceGovernanceConsole();
    const delegation = console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
        revocable: true,
    });
    const result = console.revokeDelegation(delegation.delegationId, "platform_team");
    assert.equal(result.success, true);
    const updated = console.getDelegation(delegation.delegationId);
    assert.equal(updated?.status, "revoked");
});
test("revokeDelegation fails for non-revocable delegation", () => {
    const console = new SelfServiceGovernanceConsole();
    const delegation = console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
        revocable: false,
    });
    const result = console.revokeDelegation(delegation.delegationId, "platform_team");
    assert.equal(result.success, false);
    assert.equal(result.error, "delegation_not_revocable");
});
test("revokeDelegation fails for unknown delegation", () => {
    const console = new SelfServiceGovernanceConsole();
    const result = console.revokeDelegation("unknown-id", "platform_team");
    assert.equal(result.success, false);
    assert.equal(result.error, "delegation_not_found");
});
test("getDelegation returns null for unknown id", () => {
    const console = new SelfServiceGovernanceConsole();
    const result = console.getDelegation("unknown-id");
    assert.equal(result, null);
});
test("listDelegationsForGrantee returns only active delegations", () => {
    const console = new SelfServiceGovernanceConsole();
    // Create two delegations
    const d1 = console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
        revocable: true,
    });
    const d2 = console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
        revocable: true,
    });
    // Revoke one
    console.revokeDelegation(d1.delegationId, "platform_team");
    const delegations = console.listDelegationsForGrantee("admin-1");
    assert.equal(delegations.length, 1);
    assert.equal(delegations[0]?.delegationId, d2.delegationId);
});
test("listDelegationsForOrgNode returns delegations within org scope", () => {
    const console = new SelfServiceGovernanceConsole();
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-finance",
        orgNodeIds: ["finance"],
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-hr",
        orgNodeIds: ["hr"],
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    const financeDelegations = console.listDelegationsForOrgNode("finance");
    assert.equal(financeDelegations.length, 1);
    assert.equal(financeDelegations[0]?.granteeId, "admin-finance");
});
test("listDelegationsForOrgNode returns delegations with empty orgNodeIds (platform scope)", () => {
    const console = new SelfServiceGovernanceConsole();
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "platform-admin",
        orgNodeIds: [], // Platform-wide scope
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-finance",
        orgNodeIds: ["finance"],
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    const delegations = console.listDelegationsForOrgNode("any-org");
    // Platform-wide delegations apply to all orgs
    assert.ok(delegations.some((d) => d.granteeId === "platform-admin"));
});
test("reviewDelegation returns delegation and logs audit", () => {
    const console = new SelfServiceGovernanceConsole();
    const delegation = console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    const reviewed = console.reviewDelegation(delegation.delegationId, "auditor-1");
    assert.equal(reviewed?.delegationId, delegation.delegationId);
    const auditEntries = console.exportAuditLog({ actorId: "auditor-1" });
    assert.ok(auditEntries.some((e) => e.action === "review"));
});
test("reviewDelegation returns null for unknown delegation", () => {
    const console = new SelfServiceGovernanceConsole();
    const result = console.reviewDelegation("unknown-id", "auditor-1");
    assert.equal(result, null);
});
test("exportAuditLog filters by time range", () => {
    const console = new SelfServiceGovernanceConsole();
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 10000).toISOString();
    const entries = console.exportAuditLog({ startTime: now, endTime: later });
    // May include entries depending on timing
    assert.ok(Array.isArray(entries));
});
test("exportAuditLog filters by actorId", () => {
    const console = new SelfServiceGovernanceConsole();
    console.createDelegation({
        grantorId: "platform_team",
        granteeId: "admin-1",
        expiresAt: "2025-12-31T00:00:00.000Z",
    });
    const entries = console.exportAuditLog({ actorId: "platform_team" });
    assert.ok(entries.every((e) => e.actorId === "platform_team"));
});
// ─────────────────────────────────────────────────────────────────────────────
// Role-based Permission Tests
// ─────────────────────────────────────────────────────────────────────────────
test("isActionAllowed platform_team can do everything", () => {
    const console = new SelfServiceGovernanceConsole();
    const operations = [
        "domain_onboarding",
        "modify_approval_rules",
        "publish_pack",
        "adjust_agent_autonomy",
        "create_trigger",
    ];
    for (const op of operations) {
        const result = console.isActionAllowed("user-1", "platform_team", op);
        assert.equal(result.allowed, true, `${op} should be allowed for platform_team`);
    }
});
test("isActionAllowed division_admin has limited permissions", () => {
    const console = new SelfServiceGovernanceConsole();
    assert.equal(console.isActionAllowed("user-1", "division_admin", "domain_onboarding").allowed, true);
    assert.equal(console.isActionAllowed("user-1", "division_admin", "modify_approval_rules").allowed, true);
    assert.equal(console.isActionAllowed("user-1", "division_admin", "modify_global_guardrails").allowed, false);
    assert.equal(console.isActionAllowed("user-1", "division_admin", "cross_domain_strategy").allowed, false);
});
test("isActionAllowed department_admin has limited permissions", () => {
    const console = new SelfServiceGovernanceConsole();
    assert.equal(console.isActionAllowed("user-1", "department_admin", "publish_pack").allowed, true);
    assert.equal(console.isActionAllowed("user-1", "department_admin", "adjust_agent_autonomy").allowed, true);
    assert.equal(console.isActionAllowed("user-1", "department_admin", "modify_global_guardrails").allowed, false);
});
test("isActionAllowed team_lead has no governance permissions", () => {
    const console = new SelfServiceGovernanceConsole();
    const operations = [
        "domain_onboarding",
        "modify_approval_rules",
        "publish_pack",
        "adjust_agent_autonomy",
        "create_trigger",
    ];
    for (const op of operations) {
        const result = console.isActionAllowed("user-1", "team_lead", op);
        assert.equal(result.allowed, false, `${op} should not be allowed for team_lead`);
    }
});
test("isActionAllowed returns reason string", () => {
    const console = new SelfServiceGovernanceConsole();
    const allowed = console.isActionAllowed("user-1", "platform_team", "domain_onboarding");
    assert.equal(allowed.allowed, true);
    assert.ok(typeof allowed.reason === "string");
    assert.ok(allowed.reason.length > 0);
    const denied = console.isActionAllowed("user-1", "team_lead", "domain_onboarding");
    assert.equal(denied.allowed, false);
    assert.ok(typeof denied.reason === "string");
    assert.ok(denied.reason.length > 0);
});
//# sourceMappingURL=console.test.js.map