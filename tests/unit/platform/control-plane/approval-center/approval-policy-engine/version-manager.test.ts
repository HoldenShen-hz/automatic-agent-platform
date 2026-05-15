/**
 * Unit tests for Approval Policy Version Manager
 * Tests PolicyVersionManager class for approval policy lifecycle management
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PolicyVersionManager,
  createDefaultVersionManager,
  type ApprovalPolicyBundle,
  type VersionedPolicyBundle,
  type PolicyChangeEntry,
  type PolicyVersionManagerConfig,
  type ActivatePolicyResult,
} from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/index.js";

// Mock approval policy bundle for testing
const createMockBundle = (overrides: Partial<ApprovalPolicyBundle> = {}): ApprovalPolicyBundle => ({
  bundleId: "test-bundle",
  version: "1.0.0",
  name: "Test Bundle",
  description: "Test policy bundle",
  enabled: true,
  rules: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("PolicyVersionManager initializes with optional bundle as active", () => {
  const bundle = createMockBundle({ bundleId: "init-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const active = manager.getActiveBundle("init-bundle");
  assert.ok(active);
  assert.equal(active!.status, "active");
  assert.equal(active!.version, "1.0.0");
});

test("PolicyVersionManager initializes without bundle", () => {
  const manager = new PolicyVersionManager();

  const active = manager.getActiveBundle("any-bundle");
  assert.equal(active, undefined);
});

test("PolicyVersionManager createDraft increments patch version", () => {
  const bundle = createMockBundle({ bundleId: "draft-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("draft-bundle", "1.0.0", "user-1");

  assert.equal(draft.status, "draft");
  assert.equal(draft.previousVersion, "1.0.0");
  assert.ok(draft.version.endsWith(".1")); // Patch incremented
  assert.equal(draft.createdAt !== undefined, true);
});

test("PolicyVersionManager createDraft throws for non-existent base version", () => {
  const bundle = createMockBundle({ bundleId: "nonexistent-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.createDraft("nonexistent-bundle", "99.99.99", "user-1"),
    /Base version 99.99.99 not found/,
  );
});

test("PolicyVersionManager updateDraft only works on draft bundles", () => {
  const bundle = createMockBundle({ bundleId: "update-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("update-bundle", "1.0.0", "user-1");

  // Can update draft
  const updated = manager.updateDraft(draft, "user-1");
  assert.equal(updated.status, "draft");

  // Cannot update non-draft (active)
  const active = manager.getActiveBundle("update-bundle")!;
  assert.throws(
    () => manager.updateDraft(active, "user-1"),
    /Cannot update non-draft bundle/,
  );
});

test("PolicyVersionManager submitForApproval transitions to pending_approval", () => {
  const bundle = createMockBundle({ bundleId: "submit-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("submit-bundle", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Test change summary");

  assert.equal(submitted.status, "pending_approval");
  assert.equal(submitted.changeSummary, "Test change summary");
});

test("PolicyVersionManager submitForApproval throws for non-draft", () => {
  const bundle = createMockBundle({ bundleId: "submit-non-draft", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const active = manager.getActiveBundle("submit-non-draft")!;
  assert.throws(
    () => manager.submitForApproval(active, "user-1", "Should fail"),
    /Cannot submit non-draft bundle/,
  );
});

test("PolicyVersionManager approve transitions to approved", () => {
  const bundle = createMockBundle({ bundleId: "approve-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("approve-bundle", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Ready for approval");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedBy, "approver-1");
  assert.equal(approved.approvalRequestId, "approval-123");
});

test("PolicyVersionManager approve throws for non-pending bundle", () => {
  const bundle = createMockBundle({ bundleId: "approve-wrong-status", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("approve-wrong-status", "1.0.0", "user-1");
  assert.throws(
    () => manager.approve(draft, "approver-1", "approval-123"),
    /Cannot approve bundle with status/,
  );
});

test("PolicyVersionManager activate promotes approved bundle to active", () => {
  const bundle = createMockBundle({ bundleId: "activate-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("activate-bundle", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Final change");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  const result = manager.activate("activate-bundle", approved.version, "admin-1");

  assert.equal(result.success, true);
  assert.equal(result.previousVersion, "1.0.0");
  assert.equal(result.newVersion, approved.version);

  const active = manager.getActiveBundle("activate-bundle");
  assert.ok(active);
  assert.equal(active!.status, "active");
  assert.equal(active!.version, approved.version);
});

test("PolicyVersionManager activate deprecates previous active version", () => {
  const bundle = createMockBundle({ bundleId: "deprecate-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  // Create and activate v2
  const draft = manager.createDraft("deprecate-bundle", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Update to v2");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("deprecate-bundle", approved.version, "admin-1");

  // Check all versions
  const versions = manager.getAllVersions("deprecate-bundle");
  const deprecated = versions.filter((v) => v.status === "deprecated");
  const active = versions.filter((v) => v.status === "active");

  assert.equal(deprecated.length, 1);
  assert.equal(deprecated[0]!.version, "1.0.0");
  assert.equal(active.length, 1);
  assert.ok(active[0]!.version !== "1.0.0");
});

test("PolicyVersionManager activate fails for non-approved status", () => {
  const bundle = createMockBundle({ bundleId: "activate-invalid", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("activate-invalid", "1.0.0", "user-1");
  const result = manager.activate("activate-invalid", draft.version, "admin-1");

  assert.equal(result.success, false);
  assert.ok(result.error!.includes("Cannot activate"));
});

test("PolicyVersionManager activate fails for non-existent version", () => {
  const bundle = createMockBundle({ bundleId: "activate-nonexistent", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const result = manager.activate("activate-nonexistent", "99.99.99", "admin-1");

  assert.equal(result.success, false);
  assert.ok(result.error!.includes("not found"));
});

test("PolicyVersionManager deprecate marks version as deprecated", () => {
  const bundle = createMockBundle({ bundleId: "deprecate-mark", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  // Create v2 and activate it
  const draft = manager.createDraft("deprecate-mark", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "v2");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("deprecate-mark", approved.version, "admin-1");

  // Deprecate v1
  const deprecated = manager.deprecate("deprecate-mark", "1.0.0", "admin-1");

  assert.ok(deprecated);
  assert.equal(deprecated!.status, "deprecated");
});

test("PolicyVersionManager deprecate cannot deprecate active version", () => {
  const bundle = createMockBundle({ bundleId: "deprecate-active", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.deprecate("deprecate-active", "1.0.0", "admin-1"),
    /Cannot deprecate the currently active version/,
  );
});

test("PolicyVersionManager deprecate returns null for non-existent version", () => {
  const bundle = createMockBundle({ bundleId: "deprecate-nonexistent", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const result = manager.deprecate("deprecate-nonexistent", "99.99.99", "admin-1");
  assert.equal(result, null);
});

test("PolicyVersionManager getVersion retrieves specific version", () => {
  const bundle = createMockBundle({ bundleId: "get-version", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("get-version", "1.0.0", "user-1");
  const version = manager.getVersion("get-version", draft.version);

  assert.ok(version);
  assert.equal(version!.version, draft.version);
});

test("PolicyVersionManager getVersion returns undefined for non-existent", () => {
  const bundle = createMockBundle({ bundleId: "get-nonexistent", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const version = manager.getVersion("get-nonexistent", "99.99.99");
  assert.equal(version, undefined);
});

test("PolicyVersionManager getAllVersions returns sorted versions", () => {
  const bundle = createMockBundle({ bundleId: "all-versions", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  // Create and activate first draft
  const draft1 = manager.createDraft("all-versions", "1.0.0", "user-1");
  const submitted1 = manager.submitForApproval(draft1, "user-1", "Change 1");
  const approved1 = manager.approve(submitted1, "approver-1", "approval-123");
  manager.activate("all-versions", approved1.version, "admin-1");

  // Create second draft based on activated version
  const draft2 = manager.createDraft("all-versions", approved1.version, "user-1");
  const submitted2 = manager.submitForApproval(draft2, "user-1", "Change 2");
  const approved2 = manager.approve(submitted2, "approver-2", "approval-456");
  manager.activate("all-versions", approved2.version, "admin-2");

  const versions = manager.getAllVersions("all-versions");

  // Should have initial + 2 activated versions (deprecated) + current active
  assert.ok(versions.length >= 3, `Expected at least 3 versions, got ${versions.length}`);
  // Should be sorted descending (newest first)
  assert.ok(versions[0]!.version >= versions[1]!.version);
});

test("PolicyVersionManager getChangeHistory returns history for bundle", () => {
  const bundle = createMockBundle({ bundleId: "history-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("history-bundle", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "First change");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("history-bundle", approved.version, "admin-1");

  const history = manager.getChangeHistory("history-bundle");

  assert.ok(history.length > 0);
  assert.ok(history.some((h) => h.changeType === "activated"));
});

test("PolicyVersionManager getAllChangeHistory returns all entries", () => {
  const bundle1 = createMockBundle({ bundleId: "bundle-1", version: "1.0.0" });
  const bundle2 = createMockBundle({ bundleId: "bundle-2", version: "1.0.0" });
  const manager1 = new PolicyVersionManager(bundle1);

  // Add history for bundle 1
  const draft1 = manager1.createDraft("bundle-1", "1.0.0", "user-1");
  const submitted1 = manager1.submitForApproval(draft1, "user-1", "Change 1");
  const approved1 = manager1.approve(submitted1, "approver-1", "approval-123");
  manager1.activate("bundle-1", approved1.version, "admin-1");

  // Add history for bundle 2
  const manager2 = new PolicyVersionManager(bundle2);
  const draft2 = manager2.createDraft("bundle-2", "1.0.0", "user-1");
  const submitted2 = manager2.submitForApproval(draft2, "user-1", "Change 2");
  const approved2 = manager2.approve(submitted2, "approver-2", "approval-456");
  manager2.activate("bundle-2", approved2.version, "admin-2");

  // Both managers should have history
  const history1 = manager1.getAllChangeHistory();
  const history2 = manager2.getAllChangeHistory();
  assert.ok(history1.length >= 1);
  assert.ok(history2.length >= 1);
});

test("PolicyVersionManager compareVersions identifies added rules", () => {
  const bundle = createMockBundle({ bundleId: "compare-add", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("compare-add", "1.0.0", "user-1");
  const modifiedDraft: VersionedPolicyBundle = {
    ...draft,
    rules: [
      ...draft.rules,
      {
        ruleId: "new-rule",
        description: "New rule",
        priority: 50,
        enabled: true,
        conditions: [],
        action: "allow",
      },
    ],
  };

  const submitted = manager.submitForApproval(modifiedDraft, "user-1", "Added rule");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const comparison = manager.compareVersions("compare-add", "1.0.0", approved.version);

  assert.ok(comparison.added.some((r) => r.ruleId === "new-rule"));
  assert.equal(comparison.removed.length, 0);
  assert.equal(comparison.modified.length, 0);
});

test("PolicyVersionManager compareVersions identifies removed rules", () => {
  const bundle = createMockBundle({
    bundleId: "compare-remove",
    version: "1.0.0",
    rules: [
      {
        ruleId: "to-remove",
        description: "Will be removed",
        priority: 50,
        enabled: true,
        conditions: [],
        action: "allow",
      },
    ],
  });
  const manager = new PolicyVersionManager(bundle);

  // Create draft with no rules
  const draft = manager.createDraft("compare-remove", "1.0.0", "user-1");
  const modifiedDraft: VersionedPolicyBundle = {
    ...draft,
    rules: [],
  };

  const submitted = manager.submitForApproval(modifiedDraft, "user-1", "Removed rule");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const comparison = manager.compareVersions("compare-remove", "1.0.0", approved.version);

  assert.ok(comparison.removed.some((r) => r.ruleId === "to-remove"));
  assert.equal(comparison.added.length, 0);
});

test("PolicyVersionManager compareVersions identifies modified rules", () => {
  const bundle = createMockBundle({
    bundleId: "compare-modify",
    version: "1.0.0",
    rules: [
      {
        ruleId: "existing-rule",
        description: "Original",
        priority: 50,
        enabled: true,
        conditions: [],
        action: "allow",
      },
    ],
  });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("compare-modify", "1.0.0", "user-1");
  const modifiedDraft: VersionedPolicyBundle = {
    ...draft,
    rules: [
      {
        ruleId: "existing-rule",
        description: "Modified",
        priority: 100, // Changed
        enabled: true,
        conditions: [],
        action: "deny", // Changed
      },
    ],
  };

  const submitted = manager.submitForApproval(modifiedDraft, "user-1", "Modified rule");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  const comparison = manager.compareVersions("compare-modify", "1.0.0", approved.version);

  assert.equal(comparison.added.length, 0);
  assert.equal(comparison.removed.length, 0);
  assert.equal(comparison.modified.length, 1);
  assert.equal(comparison.modified[0]!.ruleId, "existing-rule");
});

test("PolicyVersionManager compareVersions throws for missing versions", () => {
  const bundle = createMockBundle({ bundleId: "compare-missing", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  assert.throws(
    () => manager.compareVersions("compare-missing", "1.0.0", "99.99.99"),
    /One or both versions not found/,
  );
});

test("PolicyVersionManager cleanupDeprecatedVersions respects maxDeprecatedVersions", () => {
  const bundle = createMockBundle({ bundleId: "cleanup-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle, { maxDeprecatedVersions: 2, requireApprovalForChanges: true });

  // Create and activate 5 new versions
  for (let i = 0; i < 5; i++) {
    const draft = manager.createDraft("cleanup-bundle", "1.0.0", "user-1");
    const submitted = manager.submitForApproval(draft, "user-1", `Change ${i}`);
    const approved = manager.approve(submitted, "approver-1", `approval-${i}`);
    manager.activate("cleanup-bundle", approved.version, "admin-1");
  }

  const versions = manager.getAllVersions("cleanup-bundle");
  const deprecated = versions.filter((v) => v.status === "deprecated");

  // Should only have 2 deprecated versions max
  assert.ok(deprecated.length <= 2);
});

test("PolicyVersionManager changeHistory entries have correct structure", () => {
  const bundle = createMockBundle({ bundleId: "history-struct", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const draft = manager.createDraft("history-struct", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Test change");
  const approved = manager.approve(submitted, "approver-1", "approval-123");
  manager.activate("history-struct", approved.version, "admin-1");

  const history = manager.getChangeHistory("history-struct");

  assert.ok(history.length > 0);
  const entry = history[0]!;
  assert.ok(entry.changeId.startsWith("policychg_"));
  assert.equal(entry.bundleId, "history-struct");
  assert.ok(entry.fromVersion);
  assert.ok(entry.toVersion);
  assert.equal(entry.changedBy, "admin-1");
  assert.ok(entry.changedAt);
  assert.ok(["created", "updated", "activated", "deprecated"].includes(entry.changeType));
});

test("createDefaultVersionManager creates manager instance", () => {
  const manager = createDefaultVersionManager();

  assert.ok(manager instanceof PolicyVersionManager);
  assert.equal(manager.getActiveBundle("any"), undefined);
});

test("PolicyVersionManager config defaults", () => {
  const bundle = createMockBundle({ bundleId: "config-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  // Should have default config values
  const draft = manager.createDraft("config-bundle", "1.0.0", "user-1");
  const submitted = manager.submitForApproval(draft, "user-1", "Change");
  const approved = manager.approve(submitted, "approver-1", "approval-123");

  // Should be able to activate without explicit config
  const result = manager.activate("config-bundle", approved.version, "admin-1");
  assert.equal(result.success, true);
});

test("PolicyVersionManager allows re-activation of already active version", () => {
  const bundle = createMockBundle({ bundleId: "reactive-bundle", version: "1.0.0" });
  const manager = new PolicyVersionManager(bundle);

  const active = manager.getActiveBundle("reactive-bundle")!;
  const result = manager.activate("reactive-bundle", active.version, "admin-1");

  assert.equal(result.success, true);
  assert.equal(result.previousVersion, "1.0.0");
});
