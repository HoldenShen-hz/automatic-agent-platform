/**
 * Unit tests for Approval Delegation functions
 *
 * @see src/org-governance/approval-routing/delegation/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalDelegationSchema, resolveDelegatedApprover, } from "../../../../src/org-governance/approval-routing/delegation/index.js";
function createDelegation(overrides = {}) {
    const now = new Date();
    const later = new Date(now.getTime() + 3600_000);
    return {
        delegationId: overrides.delegationId ?? "delegation-1",
        approverId: overrides.approverId ?? "approver-1",
        delegateApproverId: overrides.delegateApproverId ?? "delegate-1",
        scopeNodeIds: overrides.scopeNodeIds ?? [],
        startsAt: overrides.startsAt ?? now.toISOString(),
        expiresAt: overrides.expiresAt ?? later.toISOString(),
        active: overrides.active ?? true,
        ...overrides,
    };
}
test("ApprovalDelegationSchema parses valid delegation", () => {
    const delegation = createDelegation();
    const result = ApprovalDelegationSchema.safeParse(delegation);
    assert.equal(result.success, true);
});
test("ApprovalDelegationSchema requires non-empty delegationId", () => {
    const delegation = createDelegation({ delegationId: "" });
    const result = ApprovalDelegationSchema.safeParse(delegation);
    assert.equal(result.success, false);
});
test("ApprovalDelegationSchema requires non-empty approverId", () => {
    const delegation = createDelegation({ approverId: "" });
    const result = ApprovalDelegationSchema.safeParse(delegation);
    assert.equal(result.success, false);
});
test("ApprovalDelegationSchema requires non-empty delegateApproverId", () => {
    const delegation = createDelegation({ delegateApproverId: "" });
    const result = ApprovalDelegationSchema.safeParse(delegation);
    assert.equal(result.success, false);
});
test("ApprovalDelegationSchema has correct defaults", () => {
    const delegation = {
        delegationId: "delegation-1",
        approverId: "approver-1",
        delegateApproverId: "delegate-1",
        startsAt: "2026-01-01T00:00:00Z",
        expiresAt: "2026-12-31T23:59:59Z",
    };
    const result = ApprovalDelegationSchema.safeParse(delegation);
    assert.equal(result.success, true);
    if (result.success) {
        assert.deepEqual(result.data.scopeNodeIds, []);
        assert.equal(result.data.active, true);
    }
});
test("resolveDelegatedApprover returns delegate when active and in scope", () => {
    const delegations = [
        createDelegation({
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            scopeNodeIds: ["team-1"],
            active: true,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-1", "team-1", new Date().toISOString());
    assert.equal(result, "delegate-1");
});
test("resolveDelegatedApprover returns original approver when no delegation matches", () => {
    const delegations = [];
    const result = resolveDelegatedApprover(delegations, "approver-1", "team-1", new Date().toISOString());
    assert.equal(result, "approver-1");
});
test("resolveDelegatedApprover returns original approver when delegation is inactive", () => {
    const delegations = [
        createDelegation({
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            active: false,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-1", "team-1", new Date().toISOString());
    assert.equal(result, "approver-1");
});
test("resolveDelegatedApprover returns original approver when delegation is expired", () => {
    const past = new Date(Date.now() - 3600_000);
    const delegations = [
        createDelegation({
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            startsAt: new Date(Date.now() - 7200_000).toISOString(),
            expiresAt: past.toISOString(),
            active: true,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-1", "team-1", new Date().toISOString());
    assert.equal(result, "approver-1");
});
test("resolveDelegatedApprover returns original approver when delegation has not started", () => {
    const future = new Date(Date.now() + 3600_000);
    const delegations = [
        createDelegation({
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            startsAt: future.toISOString(),
            expiresAt: new Date(Date.now() + 7200_000).toISOString(),
            active: true,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-1", "team-1", new Date().toISOString());
    assert.equal(result, "approver-1");
});
test("resolveDelegatedApprover returns original approver when node not in scope", () => {
    const delegations = [
        createDelegation({
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            scopeNodeIds: ["team-1"],
            active: true,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-1", "team-2", new Date().toISOString());
    assert.equal(result, "approver-1");
});
test("resolveDelegatedApprover matches when scope is empty (applies to all)", () => {
    const delegations = [
        createDelegation({
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            scopeNodeIds: [],
            active: true,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-1", "any-team", new Date().toISOString());
    assert.equal(result, "delegate-1");
});
test("resolveDelegatedApprover matches correct approver when multiple delegations exist", () => {
    const delegations = [
        createDelegation({
            delegationId: "delegation-1",
            approverId: "approver-1",
            delegateApproverId: "delegate-1",
            scopeNodeIds: [],
            active: true,
        }),
        createDelegation({
            delegationId: "delegation-2",
            approverId: "approver-2",
            delegateApproverId: "delegate-2",
            scopeNodeIds: [],
            active: true,
        }),
    ];
    const result = resolveDelegatedApprover(delegations, "approver-2", "any-team", new Date().toISOString());
    assert.equal(result, "delegate-2");
});
//# sourceMappingURL=delegation.test.js.map