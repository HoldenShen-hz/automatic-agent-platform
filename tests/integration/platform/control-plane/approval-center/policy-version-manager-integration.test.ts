/**
 * Integration Test: Policy Version Manager
 *
 * Verifies the policy version lifecycle: draft -> submit -> approve -> activate.
 * Tests version creation, comparison, and deprecation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PolicyVersionManager } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/version-manager.js";
import {
  DEFAULT_APPROVAL_POLICY_BUNDLE,
  type ApprovalPolicyBundle,
  type ApprovalPolicyRule,
  type VersionedPolicyBundle,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/types.js";

function createTestBundle(bundleId: string, version: string, rules: ApprovalPolicyRule[] = []): ApprovalPolicyBundle {
  return {
    bundleId,
    version,
    name: `Test Bundle ${bundleId}`,
    description: "Test bundle for version manager",
    enabled: true,
    rules: rules.length > 0 ? rules : DEFAULT_APPROVAL_POLICY_BUNDLE.rules.slice(0, 1),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("policy version manager: initial bundle becomes active", () => {
  const bundle = createTestBundle("test-1", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  const active = manager.getActiveBundle("test-1");

  assert.ok(active);
  assert.strictEqual(active!.version, "1.0.0");
  assert.strictEqual(active!.status, "active");
});

test("policy version manager: createDraft creates new version", () => {
  const bundle = createTestBundle("test-2", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("test-2", "1.0.0", "user-1");

  assert.ok(draft);
  assert.strictEqual(draft.bundleId, "test-2");
  assert.ok(semanticGreater(draft.version, "1.0.0"));
  assert.strictEqual(draft.status, "draft");
  assert.strictEqual(draft.previousVersion, "1.0.0");
});

test("policy version manager: createDraft throws for unknown base version", () => {
  const bundle = createTestBundle("test-3", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.createDraft("test-3", "99.99.99", "user-1"),
    /not found/,
  );
});

test("policy version manager: submitForApproval changes status", () => {
  const bundle = createTestBundle("test-4", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-4", "1.0.0", "user-1");

  const submitted = manager.submitForApproval(draft, "user-1", "Added new rule");

  assert.strictEqual(submitted.status, "pending_approval");
  assert.strictEqual(submitted.changeSummary, "Added new rule");
});

test("policy version manager: submitForApproval throws for non-draft", () => {
  const bundle = createTestBundle("test-5", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.submitForApproval(
      { ...bundle, status: "active" } as VersionedPolicyBundle,
      "user-1",
      "Summary",
    ),
    /draft/,
  );
});

test("policy version manager: approve changes status to approved", () => {
  const bundle = createTestBundle("test-6", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-6", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Summary");

  const approved = manager.approve(submitted, "approver-1", "approval-123");

  assert.strictEqual(approved.status, "approved");
  assert.strictEqual(approved.approvedBy, "approver-1");
  assert.strictEqual(approved.approvalRequestId, "approval-123");
});

test("policy version manager: approve throws for non-pending bundle", () => {
  // Need to create manager with an initial bundle to have something to approve
  const initialBundle = createTestBundle("test-7", "1.0.0");
  const manager = new PolicyVersionManager(initialBundle);

  // Create draft and submit but then try to approve something with wrong status
  const draft = manager.createDraft("test-7", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Summary");

  // Now try to approve a non-pending bundle (simulate by using submitted status wrong)
  // Need to create a new object with explicit status override since spread creates shallow copy
  const fakeBundle: VersionedPolicyBundle = {
    ...submitted,
    status: "draft",
  };
  assert.throws(
    () => manager.approve(fakeBundle, "approver-1", "approval-123"),
    /status: draft/,
  );
});

test("policy version manager: activate promotes approved bundle to active", () => {
  const bundle = createTestBundle("test-8", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-8", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Summary");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const result = manager.activate("test-8", approved.version, "admin-1");

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.previousVersion, "1.0.0");
  assert.ok(semanticGreater(result.newVersion, "1.0.0"));

  const active = manager.getActiveBundle("test-8");
  assert.ok(active);
  assert.strictEqual(active!.version, result.newVersion);
  assert.strictEqual(active!.status, "active");
});

test("policy version manager: activate deprecates previous active version", () => {
  const bundle = createTestBundle("test-9", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-9", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Summary");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  manager.activate("test-9", approved.version, "admin-1");

  const oldVersion = manager.getVersion("test-9", "1.0.0");
  assert.strictEqual(oldVersion!.status, "deprecated");
});

test("policy version manager: activate fails for non-approved bundle", () => {
  // Create a bundle that will be stored as draft (not approved)
  const draftBundle: ApprovalPolicyBundle = {
    bundleId: "test-10",
    version: "1.0.0",
    name: "Test Bundle test-10",
    description: "Test bundle for activation failure",
    enabled: true,
    rules: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    // Note: no explicit status field - PolicyVersionManager will set it to active when passed to constructor
  };
  const manager = new PolicyVersionManager();

  // Manually add a draft version directly to the manager (bypassing the constructor behavior)
  const versionedDraft: VersionedPolicyBundle = {
    ...draftBundle,
    status: "draft",
  };
  // Use reflection to add to versions map since there's no public method
  // Instead, test the approve throwing first which validates the flow

  // For this test, we verify that a bundle that has only been submitted (not approved)
  // cannot be activated. Create the proper flow first.
  const bundle = createTestBundle("test-10b", "1.0.0");
  const mgr = new PolicyVersionManager(bundle);
  const draft = mgr.createDraft("test-10b", "1.0.0", "user-1");
  // Don't approve - just submit
  mgr.submitForApproval(draft, "user-1", "Summary");

  // Try to activate without approval - should fail
  const result = mgr.activate("test-10b", "1.0.1", "admin-1");

  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});

test("policy version manager: deprecate marks version as deprecated", () => {
  const bundle = createTestBundle("test-11", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-11", "1.0.0", "user-1");

  const deprecated = manager.deprecate("test-11", draft.version, "admin-1");

  assert.ok(deprecated);
  assert.strictEqual(deprecated!.status, "deprecated");
});

test("policy version manager: deprecate throws for active version", () => {
  const bundle = createTestBundle("test-12", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.deprecate("test-12", "1.0.0", "admin-1"),
    /active/,
  );
});

test("policy version manager: getAllVersions returns sorted versions", () => {
  const bundle = createTestBundle("test-13", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  manager.createDraft("test-13", "1.0.0", "user-1");

  const versions = manager.getAllVersions("test-13");

  assert.strictEqual(versions.length, 2);
  // Should be sorted descending by version
  assert.ok(semanticGreater(versions[0]!.version, versions[1]!.version));
});

test("policy version manager: compareVersions shows added rules", () => {
  const bundle1 = createTestBundle("test-14", "1.0.0", [
    { ruleId: "rule-1", description: "Rule 1", priority: 100, enabled: true, conditions: [], action: "allow" },
  ]);
  const manager = new PolicyVersionManager(bundle1);
  const draft = manager.createDraft("test-14", "1.0.0", "user-1");

  const updatedDraft: typeof draft = {
    ...draft,
    rules: [
      ...draft.rules,
      { ruleId: "rule-2", description: "Rule 2", priority: 90, enabled: true, conditions: [], action: "allow" },
    ],
  };
  const submitted = manager.submitForApproval(updatedDraft, "user-1", "Added rule-2");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const comparison = manager.compareVersions("test-14", "1.0.0", approved.version);

  assert.ok(comparison.added.some((r) => r.ruleId === "rule-2"));
});

test("policy version manager: compareVersions shows removed rules", () => {
  const bundle1 = createTestBundle("test-15", "1.0.0", [
    { ruleId: "rule-1", description: "Rule 1", priority: 100, enabled: true, conditions: [], action: "allow" },
    { ruleId: "rule-2", description: "Rule 2", priority: 90, enabled: true, conditions: [], action: "allow" },
  ]);
  const manager = new PolicyVersionManager(bundle1);
  const draft = manager.createDraft("test-15", "1.0.0", "user-1");

  const updatedDraft: typeof draft = {
    ...draft,
    rules: [
      { ruleId: "rule-1", description: "Rule 1", priority: 100, enabled: true, conditions: [], action: "allow" },
    ],
  };
  const submitted = manager.submitForApproval(updatedDraft, "user-1", "Removed rule-2");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const comparison = manager.compareVersions("test-15", "1.0.0", approved.version);

  assert.ok(comparison.removed.some((r) => r.ruleId === "rule-2"));
});

test("policy version manager: compareVersions shows modified rules", () => {
  const bundle1 = createTestBundle("test-16", "1.0.0", [
    { ruleId: "rule-1", description: "Rule 1", priority: 100, enabled: true, conditions: [], action: "allow" },
  ]);
  const manager = new PolicyVersionManager(bundle1);
  const draft = manager.createDraft("test-16", "1.0.0", "user-1");

  const updatedDraft: typeof draft = {
    ...draft,
    rules: [
      { ruleId: "rule-1", description: "Updated Rule 1", priority: 100, enabled: true, conditions: [], action: "require_approval" },
    ],
  };
  const submitted = manager.submitForApproval(updatedDraft, "user-1", "Updated rule-1");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const comparison = manager.compareVersions("test-16", "1.0.0", approved.version);

  assert.strictEqual(comparison.modified.length, 1);
  assert.strictEqual(comparison.modified[0]!.ruleId, "rule-1");
});

test("policy version manager: getChangeHistory returns history entries", () => {
  const bundle = createTestBundle("test-17", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-17", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Summary");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("test-17", approved.version, "admin-1");

  const history = manager.getChangeHistory("test-17");

  assert.ok(history.length >= 2);
  // Should be sorted by changedAt descending
  assert.ok(new Date(history[0]!.changedAt) >= new Date(history[1]!.changedAt));
});

test("policy version manager: getChangeHistory returns empty for unknown bundle", () => {
  const bundle = createTestBundle("test-18", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  const history = manager.getChangeHistory("unknown-bundle");

  assert.deepStrictEqual(history, []);
});

test("policy version manager: updateDraft updates timestamp", () => {
  const bundle = createTestBundle("test-19", "1.0.0");
  const manager = new PolicyVersionManager(bundle);
  const draft = manager.createDraft("test-19", "1.0.0", "user-1");
  const originalUpdatedAt = draft.updatedAt;

  const updated = manager.updateDraft(draft, "user-1");

  assert.ok(new Date(updated.updatedAt) >= new Date(originalUpdatedAt));
});

test("policy version manager: updateDraft throws for non-draft", () => {
  const bundle = createTestBundle("test-20", "1.0.0");
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.updateDraft(
      { ...bundle, status: "active" } as VersionedPolicyBundle,
      "user-1",
    ),
    /draft/,
  );
});

/**
 * Checks if versionA > versionB using semantic version comparison.
 */
function semanticGreater(versionA: string, versionB: string): boolean {
  const partsA = versionA.split(".").map(Number);
  const partsB = versionB.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}
