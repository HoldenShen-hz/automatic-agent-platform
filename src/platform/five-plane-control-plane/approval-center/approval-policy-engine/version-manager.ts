/**
 * Approval Policy Version Manager
 *
 * Manages the lifecycle of approval policy bundles including:
 * - Version creation and tracking
 * - Change history
 * - Policy activation/deprecation
 * - Draft management
 *
 * ## Version Lifecycle
 *
 * 1. draft - Policy is being edited, not yet submitted for approval
 * 2. pending_approval - Policy change is under review
 * 3. approved - Policy is approved but not yet active
 * 4. active - Policy is currently in effect
 * 5. deprecated - Policy is no longer in use
 *
 * ## Change Tracking
 *
 * Each version tracks:
 * - Who created it
 * - What changed from the previous version
 * - Approval history
 * - Activation timestamp
 */

import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
import type {
  ApprovalPolicyBundle,
  VersionedPolicyBundle,
  ApprovalPolicyRule,
} from "./types.js";

/**
 * Policy change entry for audit history.
 */
export interface PolicyChangeEntry {
  changeId: string;
  bundleId: string;
  fromVersion: string;
  toVersion: string;
  changedBy: string;
  changedAt: string;
  changeType: "created" | "updated" | "activated" | "deprecated";
  changeSummary: string;
  approvalRequestId?: string;
}

/**
 * Policy version manager configuration.
 */
export interface PolicyVersionManagerConfig {
  /** Maximum number of deprecated versions to keep */
  maxDeprecatedVersions?: number;
  /** Whether to require approval for policy changes */
  requireApprovalForChanges?: boolean;
}

/**
 * Result of activating a policy version.
 */
export interface ActivatePolicyResult {
  success: boolean;
  previousVersion: string | null;
  newVersion: string;
  error?: string;
}

/**
 * Manages versions of approval policy bundles.
 */
export class PolicyVersionManager {
  private readonly versions: Map<string, VersionedPolicyBundle> = new Map();
  private readonly changeHistory: PolicyChangeEntry[] = [];
  private readonly activeVersionId: string | null = null;
  private readonly config: Required<PolicyVersionManagerConfig>;

  public constructor(
    initialBundle?: ApprovalPolicyBundle,
    config: PolicyVersionManagerConfig = {},
  ) {
    this.config = {
      maxDeprecatedVersions: config.maxDeprecatedVersions ?? 10,
      requireApprovalForChanges: config.requireApprovalForChanges ?? true,
    };

    if (initialBundle) {
      const versioned: VersionedPolicyBundle = {
        ...initialBundle,
        status: "active",
      };
      this.versions.set(`${initialBundle.bundleId}:${initialBundle.version}`, versioned);
    }
  }

  /**
   * Creates a new draft version of a policy bundle.
   *
   * @param bundleId - The bundle ID for the new draft
   * @param baseVersion - Version to base the draft on
   * @param createdBy - Who is creating the draft
   * @returns The new draft bundle
   */
  public createDraft(
    bundleId: string,
    baseVersion: string,
    createdBy: string,
  ): VersionedPolicyBundle {
    const base = this.getVersion(bundleId, baseVersion);
    if (!base) {
      throw new Error(`Base version ${baseVersion} not found for bundle ${bundleId}`);
    }

    const versionParts = base.version.split(".").map(Number);
    const major = versionParts[0] ?? 1;
    const minor = versionParts[1] ?? 0;
    const patch = versionParts[2] ?? 0;
    const newVersion = `${major}.${minor}.${patch + 1}`;

    const draft: VersionedPolicyBundle = {
      ...base,
      bundleId,
      version: newVersion,
      status: "draft",
      previousVersion: base.version,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    this.versions.set(`${bundleId}:${newVersion}`, draft);
    return draft;
  }

  /**
   * Updates a draft policy bundle.
   *
   * @param bundle - The updated draft bundle
   * @param updatedBy - Who is updating the draft
   * @returns The updated draft bundle
   */
  public updateDraft(
    bundle: VersionedPolicyBundle,
    updatedBy: string,
  ): VersionedPolicyBundle {
    if (bundle.status !== "draft") {
      throw new Error(`Cannot update non-draft bundle with status: ${bundle.status}`);
    }

    const updated: VersionedPolicyBundle = {
      ...bundle,
      updatedAt: nowIso(),
    };

    return updated;
  }

  /**
   * Submits a draft for approval.
   *
   * @param bundle - The draft to submit
   * @param submittedBy - Who is submitting for approval
   * @param changeSummary - Description of what changed
   * @returns The bundle with pending_approval status
   */
  public submitForApproval(
    bundle: VersionedPolicyBundle,
    submittedBy: string,
    changeSummary: string,
  ): VersionedPolicyBundle {
    if (bundle.status !== "draft") {
      throw new Error(`Cannot submit non-draft bundle for approval: ${bundle.status}`);
    }

    const submitted: VersionedPolicyBundle = {
      ...bundle,
      status: "pending_approval",
      updatedAt: nowIso(),
      changeSummary,
    };

    this.versions.set(`${bundle.bundleId}:${bundle.version}`, submitted);
    return submitted;
  }

  /**
   * Approves a pending policy bundle.
   *
   * @param bundle - The bundle to approve
   * @param approvedBy - Who approved the bundle
   * @param approvalRequestId - The approval request ID
   * @returns The approved bundle
   */
  public approve(
    bundle: VersionedPolicyBundle,
    approvedBy: string,
    approvalRequestId: string,
  ): VersionedPolicyBundle {
    if (bundle.status !== "pending_approval") {
      throw new Error(`Cannot approve bundle with status: ${bundle.status}`);
    }

    const approved: VersionedPolicyBundle = {
      ...bundle,
      status: "approved",
      approvedBy,
      approvalRequestId,
      updatedAt: nowIso(),
    };

    this.versions.set(`${bundle.bundleId}:${bundle.version}`, approved);
    return approved;
  }

  /**
   * Activates an approved policy bundle.
   *
   * @param bundleId - The bundle ID
   * @param version - The version to activate
   * @param activatedBy - Who activated it
   * @returns The activation result
   */
  public activate(
    bundleId: string,
    version: string,
    activatedBy: string,
  ): ActivatePolicyResult {
    const bundle = this.getVersion(bundleId, version);
    if (!bundle) {
      return {
        success: false,
        previousVersion: null,
        newVersion: version,
        error: `Version ${version} not found`,
      };
    }

    if (bundle.status !== "approved" && bundle.status !== "active") {
      return {
        success: false,
        previousVersion: null,
        newVersion: version,
        error: `Cannot activate bundle with status: ${bundle.status}`,
      };
    }

    const activeBundle = this.getActiveBundle(bundleId);
    const previousVersion = activeBundle?.version ?? null;

    // Deprecate the current active version
    if (activeBundle) {
      const deprecated: VersionedPolicyBundle = {
        ...activeBundle,
        status: "deprecated",
        updatedAt: nowIso(),
      };
      this.versions.set(`${bundleId}:${deprecated.version}`, deprecated);
      this.addChangeEntry(bundleId, previousVersion!, version, activatedBy, "deprecated");
    }

    // Activate the new version
    const activated: VersionedPolicyBundle = {
      ...bundle,
      status: "active",
      updatedAt: nowIso(),
    };
    this.versions.set(`${bundleId}:${version}`, activated);
    this.addChangeEntry(bundleId, previousVersion ?? "none", version, activatedBy, "activated");

    // Cleanup old deprecated versions
    this.cleanupDeprecatedVersions(bundleId);

    return {
      success: true,
      previousVersion,
      newVersion: version,
    };
  }

  /**
   * Deprecates a specific version of a policy bundle.
   *
   * @param bundleId - The bundle ID
   * @param version - The version to deprecate
   * @param deprecatedBy - Who deprecated it
   * @returns The deprecated bundle
   */
  public deprecate(
    bundleId: string,
    version: string,
    deprecatedBy: string,
  ): VersionedPolicyBundle | null {
    const bundle = this.getVersion(bundleId, version);
    if (!bundle) {
      return null;
    }

    if (bundle.status === "active") {
      throw new Error("Cannot deprecate the currently active version");
    }

    const deprecated: VersionedPolicyBundle = {
      ...bundle,
      status: "deprecated",
      updatedAt: nowIso(),
    };

    this.versions.set(`${bundleId}:${version}`, deprecated);
    this.addChangeEntry(bundleId, bundle.version, bundle.version, deprecatedBy, "deprecated");

    return deprecated;
  }

  /**
   * Gets a specific version of a policy bundle.
   *
   * @param bundleId - The bundle ID
   * @param version - The version string
   * @returns The bundle or undefined if not found
   */
  public getVersion(bundleId: string, version: string): VersionedPolicyBundle | undefined {
    return this.versions.get(`${bundleId}:${version}`);
  }

  /**
   * Gets the currently active version of a policy bundle.
   *
   * @param bundleId - The bundle ID
   * @returns The active bundle or undefined if none
   */
  public getActiveBundle(bundleId: string): VersionedPolicyBundle | undefined {
    for (const bundle of this.versions.values()) {
      if (bundle.bundleId === bundleId && bundle.status === "active") {
        return bundle;
      }
    }
    return undefined;
  }

  /**
   * Gets all versions of a policy bundle.
   *
   * @param bundleId - The bundle ID
   * @returns All versions sorted by version descending
   */
  public getAllVersions(bundleId: string): VersionedPolicyBundle[] {
    return [...this.versions.values()]
      .filter((b) => b.bundleId === bundleId)
      .sort((a, b) => b.version.localeCompare(a.version));
  }

  /**
   * Gets the change history for a policy bundle.
   *
   * @param bundleId - The bundle ID
   * @returns Change history entries
   */
  public getChangeHistory(bundleId: string): PolicyChangeEntry[] {
    return this.changeHistory
      .filter((e) => e.bundleId === bundleId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }

  /**
   * Gets all change history entries.
   */
  public getAllChangeHistory(): PolicyChangeEntry[] {
    return [...this.changeHistory].sort((a, b) =>
      b.changedAt.localeCompare(a.changedAt),
    );
  }

  /**
   * Compares two versions and returns the differences.
   *
   * @param bundleId - The bundle ID
   * @param fromVersion - The source version
   * @param toVersion - The target version
   * @returns Description of changes between versions
   */
  public compareVersions(
    bundleId: string,
    fromVersion: string,
    toVersion: string,
  ): {
    added: ApprovalPolicyRule[];
    removed: ApprovalPolicyRule[];
    modified: Array<{ ruleId: string; from: ApprovalPolicyRule; to: ApprovalPolicyRule }>;
  } {
    const from = this.getVersion(bundleId, fromVersion);
    const to = this.getVersion(bundleId, toVersion);

    if (!from || !to) {
      throw new Error("One or both versions not found");
    }

    const fromRuleMap = new Map(from.rules.map((r) => [r.ruleId, r]));
    const toRuleMap = new Map(to.rules.map((r) => [r.ruleId, r]));

    const added: ApprovalPolicyRule[] = [];
    const removed: ApprovalPolicyRule[] = [];
    const modified: Array<{ ruleId: string; from: ApprovalPolicyRule; to: ApprovalPolicyRule }> = [];

    for (const [ruleId, toRule] of toRuleMap) {
      if (!fromRuleMap.has(ruleId)) {
        added.push(toRule);
      } else {
        const fromRule = fromRuleMap.get(ruleId)!;
        if (JSON.stringify(fromRule) !== JSON.stringify(toRule)) {
          modified.push({ ruleId, from: fromRule, to: toRule });
        }
      }
    }

    for (const [ruleId, fromRule] of fromRuleMap) {
      if (!toRuleMap.has(ruleId)) {
        removed.push(fromRule);
      }
    }

    return { added, removed, modified };
  }

  /**
   * Adds a change entry to the history.
   */
  private addChangeEntry(
    bundleId: string,
    fromVersion: string,
    toVersion: string,
    changedBy: string,
    changeType: PolicyChangeEntry["changeType"],
  ): void {
    const entry: PolicyChangeEntry = {
      changeId: newId("policychg"),
      bundleId,
      fromVersion,
      toVersion,
      changedBy,
      changedAt: nowIso(),
      changeType,
      changeSummary: `Policy ${changeType} from ${fromVersion} to ${toVersion}`,
    };
    this.changeHistory.push(entry);
  }

  /**
   * Cleans up old deprecated versions beyond the configured limit.
   */
  private cleanupDeprecatedVersions(bundleId: string): void {
    const deprecated = [...this.versions.values()]
      .filter((b) => b.bundleId === bundleId && b.status === "deprecated")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const toRemove = deprecated.slice(this.config.maxDeprecatedVersions);
    for (const bundle of toRemove) {
      this.versions.delete(`${bundleId}:${bundle.version}`);
    }
  }
}

/**
 * Creates a version manager with default policies.
 */
export function createDefaultVersionManager(
  bundle?: ApprovalPolicyBundle,
): PolicyVersionManager {
  return new PolicyVersionManager(bundle);
}
