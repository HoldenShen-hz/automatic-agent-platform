/**
 * Comprehensive tests for PolicyVersionManager
 * Source: src/platform/five-plane-control-plane/approval-center/approval-policy-engine/version-manager.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { PolicyVersionManager, createDefaultVersionManager } from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/index.js";
import { DEFAULT_APPROVAL_POLICY_BUNDLE } from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-policy-engine/types.js";

describe("PolicyVersionManager", () => {

  describe("constructor", () => {
    it("should create manager with initial bundle as active", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const active = manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);
      assert.ok(active);
      assert.strictEqual(active?.status, "active");
    });

    it("should use default config values", () => {
      const manager = new PolicyVersionManager();

      assert.ok(manager);
    });
  });

  describe("createDraft", () => {
    it("should create draft with incremented version", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      assert.strictEqual(draft.status, "draft");
      assert.ok(draft.version.endsWith(".1")); // Patch incremented
      assert.strictEqual(draft.previousVersion, DEFAULT_APPROVAL_POLICY_BUNDLE.version);
    });

    it("should throw when base version not found", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      assert.throws(() => {
        manager.createDraft("nonexistent-bundle", "1.0.0", "user-1");
      }, /not found/);
    });

    it("should continue patch increments from the provided base version", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const baseVersion = manager.getVersion(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
      );
      const versionParts = baseVersion!.version.split(".").map(Number);
      const major = (versionParts[0] ?? 1) + 1;
      const minor = 0;
      const patch = 0;

      // Simulate the version bump by manually setting up the base version
      const customBundle = {
        ...DEFAULT_APPROVAL_POLICY_BUNDLE,
        version: `${major}.${minor}.${patch}`,
      };
      const manager2 = new PolicyVersionManager(customBundle);

      const draft = manager2.createDraft(customBundle.bundleId, customBundle.version, "user-1");

      assert.equal(draft.version, `${major}.0.1`);
    });
  });

  describe("updateDraft", () => {
    it("should update draft timestamp", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const originalUpdatedAt = draft.updatedAt;

      const updated = manager.updateDraft(draft, "user-2");

      assert.ok(new Date(updated.updatedAt).getTime() >= new Date(originalUpdatedAt).getTime());
    });

    it("should throw when updating non-draft bundle", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const active = manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);

      assert.throws(() => {
        manager.updateDraft(active!, "user-1");
      }, /Cannot update non-draft/);
    });
  });

  describe("submitForApproval", () => {
    it("should change status to pending_approval", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const submitted = manager.submitForApproval(draft, "user-1", "Added new rule");

      assert.strictEqual(submitted.status, "pending_approval");
      assert.strictEqual(submitted.changeSummary, "Added new rule");
    });

    it("should throw when submitting non-draft bundle", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const active = manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);

      assert.throws(() => {
        manager.submitForApproval(active!, "user-1", "Test");
      }, /Cannot submit non-draft/);
    });
  });

  describe("approve", () => {
    it("should change status to approved", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const submitted = manager.submitForApproval(draft, "user-1", "Test change");
      const approved = manager.approve(submitted, "admin-user", "approval-123");

      assert.strictEqual(approved.status, "approved");
      assert.strictEqual(approved.approvedBy, "admin-user");
      assert.strictEqual(approved.approvalRequestId, "approval-123");
    });

    it("should throw when approving non-pending bundle", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      assert.throws(() => {
        manager.approve(draft, "admin-user", "approval-123");
      }, /Cannot approve bundle with status/);
    });
  });

  describe("activate", () => {
    it("should activate approved bundle and deprecate current active", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const submitted = manager.submitForApproval(draft, "user-1", "Test");
      const approved = manager.approve(submitted, "admin-user", "approval-123");
      const result = manager.activate(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        approved.version,
        "admin-user",
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.previousVersion, DEFAULT_APPROVAL_POLICY_BUNDLE.version);

      // Check the new version is active
      const active = manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);
      assert.strictEqual(active?.version, approved.version);
    });

    it("should return error when version not found", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const result = manager.activate("nonexistent-bundle", "1.0.0", "user-1");

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("not found"));
    });

    it("should return error when bundle not in approved/active status", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const result = manager.activate(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        draft.version,
        "user-1",
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("Cannot activate"));
    });
  });

  describe("deprecate", () => {
    it("should deprecate a specific version", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const deprecated = manager.deprecate(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        draft.version,
        "admin-user",
      );

      assert.strictEqual(deprecated?.status, "deprecated");
    });

    it("should return null when version not found", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const result = manager.deprecate("nonexistent-bundle", "1.0.0", "user-1");

      assert.strictEqual(result, null);
    });

    it("should throw when deprecating active version", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const active = manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);

      assert.throws(() => {
        manager.deprecate(
          DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
          active!.version,
          "user-1",
        );
      }, /Cannot deprecate/);
    });
  });

  describe("getVersion", () => {
    it("should return specific version", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const version = manager.getVersion(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
      );

      assert.ok(version);
      assert.strictEqual(version?.bundleId, DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);
    });

    it("should return undefined for non-existent version", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const result = manager.getVersion("nonexistent-bundle", "1.0.0");

      assert.strictEqual(result, undefined);
    });
  });

  describe("getActiveBundle", () => {
    it("should return active bundle", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const active = manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);

      assert.ok(active);
      assert.strictEqual(active?.status, "active");
    });

    it("should return undefined when no active bundle", () => {
      const manager = new PolicyVersionManager();

      const result = manager.getActiveBundle("nonexistent-bundle");

      assert.strictEqual(result, undefined);
    });
  });

  describe("getAllVersions", () => {
    it("should return all versions sorted descending", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      // Create a few drafts to have multiple versions
      const draft1 = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );
      manager.submitForApproval(draft1, "user-1", "Change 1");
      const draft2 = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        draft1.version,
        "user-1",
      );

      const versions = manager.getAllVersions(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);

      assert.ok(versions.length >= 2);
      // Should be sorted descending
      for (let i = 1; i < versions.length; i++) {
        assert.ok(versions[i - 1]!.version >= versions[i]!.version);
      }
    });
  });

  describe("getChangeHistory", () => {
    it("should return change history for bundle", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );
      const submitted = manager.submitForApproval(draft, "user-1", "Test change");
      const approved = manager.approve(submitted, "approver-1", "approval-123");
      manager.activate(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId, approved.version, "admin-1");

      const history = manager.getChangeHistory(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId);

      assert.ok(history.length > 0);
    });

    it("should return empty array for non-existent bundle", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const result = manager.getChangeHistory("nonexistent-bundle");

      assert.deepStrictEqual(result, []);
    });
  });

  describe("compareVersions", () => {
    it("should return differences between versions", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      const draft = manager.createDraft(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        "user-1",
      );

      const submitted = manager.submitForApproval(draft, "user-1", "Added new rule");

      const comparison = manager.compareVersions(
        DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
        DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        submitted.version,
      );

      assert.deepStrictEqual(comparison.added, []);
      assert.deepStrictEqual(comparison.removed, []);
      assert.ok(Array.isArray(comparison.modified));
    });

    it("should throw when version not found", () => {
      const manager = new PolicyVersionManager(DEFAULT_APPROVAL_POLICY_BUNDLE);

      assert.throws(() => {
        manager.compareVersions(
          DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId,
          "nonexistent",
          DEFAULT_APPROVAL_POLICY_BUNDLE.version,
        );
      }, /not found/);
    });
  });

  describe("createDefaultVersionManager", () => {
    it("should create manager with default policies", () => {
      const manager = createDefaultVersionManager();

      assert.ok(manager);
      assert.equal(manager.getActiveBundle(DEFAULT_APPROVAL_POLICY_BUNDLE.bundleId), undefined);
    });

    it("should accept custom initial bundle", () => {
      const customBundle = {
        ...DEFAULT_APPROVAL_POLICY_BUNDLE,
        bundleId: "custom-bundle",
      };

      const manager = createDefaultVersionManager(customBundle);

      const active = manager.getActiveBundle("custom-bundle");
      assert.ok(active);
    });
  });
});
