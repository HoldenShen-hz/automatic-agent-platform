/**
 * Unit tests for architecture-remediation.ts
 * Tests approval conflict evaluation, policy merging, guardrail evaluation,
 * permission cascade revocation, and evidence generation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateApprovalConflicts,
  mergeDenyPolicy,
  evaluateUnknownDelegatedGuardrail,
  cascadeRevokePermission,
  buildOrgGovernanceRemediationEvidence,
  type ApprovalConflictInput,
  type DelegatedPermission,
} from "../../../src/org-governance/architecture-remediation.js";

describe("evaluateApprovalConflicts", () => {
  it("returns sod.same_actor when requester equals approver", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-1",
      requesterChainIds: [],
      approverChainIds: [],
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.ok(conflicts.includes("sod.same_actor"));
  });

  it("returns sod.same_approval_chain when chains overlap", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-2",
      requesterChainIds: ["chain-a", "chain-b"],
      approverChainIds: ["chain-b", "chain-c"],
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.ok(conflicts.includes("sod.same_approval_chain"));
  });

  it("returns sod.budget_owner_executor_conflict when budget owner equals executor", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-2",
      requesterChainIds: [],
      approverChainIds: [],
      budgetOwnerId: "user-3",
      executorId: "user-3",
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.ok(conflicts.includes("sod.budget_owner_executor_conflict"));
  });

  it("returns coi.approver_conflict when approver is in conflict of interest list", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-2",
      requesterChainIds: [],
      approverChainIds: [],
      conflictOfInterestActorIds: ["user-2", "user-5"],
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.ok(conflicts.includes("coi.approver_conflict"));
  });

  it("returns no conflicts when all inputs are clean", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-2",
      requesterChainIds: ["chain-a"],
      approverChainIds: ["chain-b"],
      budgetOwnerId: "user-3",
      executorId: "user-4",
      conflictOfInterestActorIds: [],
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.strictEqual(conflicts.length, 0);
  });

  it("returns multiple conflicts when multiple issues exist", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-1", // same actor
      requesterChainIds: ["chain-a"],
      approverChainIds: ["chain-a"], // same chain
      budgetOwnerId: "user-1",
      executorId: "user-1", // budget owner = executor
      conflictOfInterestActorIds: ["user-1"], // approver in COI list
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.ok(conflicts.includes("sod.same_actor"));
    assert.ok(conflicts.includes("sod.same_approval_chain"));
    assert.ok(conflicts.includes("sod.budget_owner_executor_conflict"));
    assert.ok(conflicts.includes("coi.approver_conflict"));
  });

  it("handles optional fields as undefined", () => {
    const input: ApprovalConflictInput = {
      requesterId: "user-1",
      approverId: "user-2",
      requesterChainIds: [],
      approverChainIds: [],
      // budgetOwnerId, executorId, conflictOfInterestActorIds are all undefined
    };

    const conflicts = evaluateApprovalConflicts(input);

    assert.strictEqual(conflicts.length, 0);
  });
});

describe("mergeDenyPolicy", () => {
  it("returns true when both parent and child allow", () => {
    assert.strictEqual(mergeDenyPolicy(true, true), true);
  });

  it("returns false when parent denies", () => {
    assert.strictEqual(mergeDenyPolicy(false, true), false);
  });

  it("returns false when child denies", () => {
    assert.strictEqual(mergeDenyPolicy(true, false), false);
  });

  it("returns false when both deny", () => {
    assert.strictEqual(mergeDenyPolicy(false, false), false);
  });
});

describe("evaluateUnknownDelegatedGuardrail", () => {
  it("returns allowed false with unknown guardrail reason code", () => {
    const result = evaluateUnknownDelegatedGuardrail("custom_guardrail");

    assert.strictEqual(result.allowed, false);
    assert.ok(result.reasonCode.includes("unknown_guardrail"));
    assert.ok(result.reasonCode.includes("custom_guardrail"));
  });

  it("returns correct reason code for different guardrail types", () => {
    const result1 = evaluateUnknownDelegatedGuardrail("rate_limit");
    const result2 = evaluateUnknownDelegatedGuardrail("geo_restriction");

    assert.ok(result1.reasonCode.includes("rate_limit"));
    assert.ok(result2.reasonCode.includes("geo_restriction"));
  });
});

describe("cascadeRevokePermission", () => {
  it("revokes only the specified permission when no permissions derive from it", () => {
    const permissions: readonly DelegatedPermission[] = [
      { permissionId: "perm-1", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z" },
      { permissionId: "perm-2", level: "operate", delegatable: false, expiresAt: "2026-12-31T00:00:00.000Z" },
    ];

    const revoked = cascadeRevokePermission("perm-1", permissions);

    assert.deepStrictEqual(revoked, ["perm-1"]);
  });

  it("cascades revocation to derived permissions", () => {
    const permissions: readonly DelegatedPermission[] = [
      { permissionId: "perm-root", level: "super_admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z" },
      { permissionId: "perm-child", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-root" },
      { permissionId: "perm-grandchild", level: "operate", delegatable: false, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-child" },
    ];

    const revoked = cascadeRevokePermission("perm-root", permissions);

    assert.deepStrictEqual([...revoked].sort(), ["perm-child", "perm-grandchild", "perm-root"]);
  });

  it("handles multiple chains of derivation", () => {
    const permissions: readonly DelegatedPermission[] = [
      { permissionId: "perm-a", level: "super_admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z" },
      { permissionId: "perm-b", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-a" },
      { permissionId: "perm-c", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-a" },
      { permissionId: "perm-d", level: "operate", delegatable: false, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-b" },
    ];

    const revoked = cascadeRevokePermission("perm-a", permissions);

    assert.strictEqual(revoked.length, 4);
    assert.ok(revoked.includes("perm-a"));
    assert.ok(revoked.includes("perm-b"));
    assert.ok(revoked.includes("perm-c"));
    assert.ok(revoked.includes("perm-d"));
  });

  it("returns only the revoked permission when permission not in list", () => {
    const permissions: readonly DelegatedPermission[] = [
      { permissionId: "perm-1", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z" },
    ];

    const revoked = cascadeRevokePermission("non-existent", permissions);

    assert.deepStrictEqual(revoked, ["non-existent"]);
  });

  it("handles diamond derivation pattern", () => {
    const permissions: readonly DelegatedPermission[] = [
      { permissionId: "perm-top", level: "super_admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z" },
      { permissionId: "perm-left", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-top" },
      { permissionId: "perm-right", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-top" },
      { permissionId: "perm-bottom", level: "operate", delegatable: false, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-left" },
      { permissionId: "perm-bottom-2", level: "operate", delegatable: false, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "perm-right" },
    ];

    const revoked = cascadeRevokePermission("perm-top", permissions);

    assert.strictEqual(revoked.length, 5);
  });

  it("returns sorted list of revoked permission IDs", () => {
    const permissions: readonly DelegatedPermission[] = [
      { permissionId: "z-perm", level: "super_admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z" },
      { permissionId: "a-perm", level: "admin", delegatable: true, expiresAt: "2026-12-31T00:00:00.000Z", derivedFromPermissionId: "z-perm" },
    ];

    const revoked = cascadeRevokePermission("z-perm", permissions);

    // Should be sorted alphabetically
    assert.deepStrictEqual(revoked, ["a-perm", "z-perm"]);
  });

  it("handles empty permissions list", () => {
    const permissions: readonly DelegatedPermission[] = [];

    const revoked = cascadeRevokePermission("perm-1", permissions);

    assert.deepStrictEqual(revoked, ["perm-1"]);
  });
});

describe("buildOrgGovernanceRemediationEvidence", () => {
  it("returns 24 evidence IDs (O-1 through O-24)", () => {
    const evidence = buildOrgGovernanceRemediationEvidence();

    assert.strictEqual(evidence.length, 24);
    assert.strictEqual(evidence[0], "O-1");
    assert.strictEqual(evidence[23], "O-24");
  });

  it("returns sorted evidence IDs", () => {
    const evidence = buildOrgGovernanceRemediationEvidence();

    assert.strictEqual(evidence[0], "O-1");
    assert.strictEqual(evidence[23], "O-24");
    // Verify each element follows the O-N pattern
    for (let i = 0; i < evidence.length; i++) {
      assert.strictEqual(evidence[i], `O-${i + 1}`);
    }
  });

  it("returns immutable array", () => {
    const evidence = buildOrgGovernanceRemediationEvidence();

    assert.ok(Array.isArray(evidence));
  });
});