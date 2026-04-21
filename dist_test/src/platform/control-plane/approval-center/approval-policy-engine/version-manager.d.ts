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
import type { ApprovalPolicyBundle, VersionedPolicyBundle, ApprovalPolicyRule } from "./types.js";
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
export declare class PolicyVersionManager {
    private readonly versions;
    private readonly changeHistory;
    private readonly activeVersionId;
    private readonly config;
    constructor(initialBundle?: ApprovalPolicyBundle, config?: PolicyVersionManagerConfig);
    /**
     * Creates a new draft version of a policy bundle.
     *
     * @param bundleId - The bundle ID for the new draft
     * @param baseVersion - Version to base the draft on
     * @param createdBy - Who is creating the draft
     * @returns The new draft bundle
     */
    createDraft(bundleId: string, baseVersion: string, createdBy: string): VersionedPolicyBundle;
    /**
     * Updates a draft policy bundle.
     *
     * @param bundle - The updated draft bundle
     * @param updatedBy - Who is updating the draft
     * @returns The updated draft bundle
     */
    updateDraft(bundle: VersionedPolicyBundle, updatedBy: string): VersionedPolicyBundle;
    /**
     * Submits a draft for approval.
     *
     * @param bundle - The draft to submit
     * @param submittedBy - Who is submitting for approval
     * @param changeSummary - Description of what changed
     * @returns The bundle with pending_approval status
     */
    submitForApproval(bundle: VersionedPolicyBundle, submittedBy: string, changeSummary: string): VersionedPolicyBundle;
    /**
     * Approves a pending policy bundle.
     *
     * @param bundle - The bundle to approve
     * @param approvedBy - Who approved the bundle
     * @param approvalRequestId - The approval request ID
     * @returns The approved bundle
     */
    approve(bundle: VersionedPolicyBundle, approvedBy: string, approvalRequestId: string): VersionedPolicyBundle;
    /**
     * Activates an approved policy bundle.
     *
     * @param bundleId - The bundle ID
     * @param version - The version to activate
     * @param activatedBy - Who activated it
     * @returns The activation result
     */
    activate(bundleId: string, version: string, activatedBy: string): ActivatePolicyResult;
    /**
     * Deprecates a specific version of a policy bundle.
     *
     * @param bundleId - The bundle ID
     * @param version - The version to deprecate
     * @param deprecatedBy - Who deprecated it
     * @returns The deprecated bundle
     */
    deprecate(bundleId: string, version: string, deprecatedBy: string): VersionedPolicyBundle | null;
    /**
     * Gets a specific version of a policy bundle.
     *
     * @param bundleId - The bundle ID
     * @param version - The version string
     * @returns The bundle or undefined if not found
     */
    getVersion(bundleId: string, version: string): VersionedPolicyBundle | undefined;
    /**
     * Gets the currently active version of a policy bundle.
     *
     * @param bundleId - The bundle ID
     * @returns The active bundle or undefined if none
     */
    getActiveBundle(bundleId: string): VersionedPolicyBundle | undefined;
    /**
     * Gets all versions of a policy bundle.
     *
     * @param bundleId - The bundle ID
     * @returns All versions sorted by version descending
     */
    getAllVersions(bundleId: string): VersionedPolicyBundle[];
    /**
     * Gets the change history for a policy bundle.
     *
     * @param bundleId - The bundle ID
     * @returns Change history entries
     */
    getChangeHistory(bundleId: string): PolicyChangeEntry[];
    /**
     * Gets all change history entries.
     */
    getAllChangeHistory(): PolicyChangeEntry[];
    /**
     * Compares two versions and returns the differences.
     *
     * @param bundleId - The bundle ID
     * @param fromVersion - The source version
     * @param toVersion - The target version
     * @returns Description of changes between versions
     */
    compareVersions(bundleId: string, fromVersion: string, toVersion: string): {
        added: ApprovalPolicyRule[];
        removed: ApprovalPolicyRule[];
        modified: Array<{
            ruleId: string;
            from: ApprovalPolicyRule;
            to: ApprovalPolicyRule;
        }>;
    };
    /**
     * Adds a change entry to the history.
     */
    private addChangeEntry;
    /**
     * Cleans up old deprecated versions beyond the configured limit.
     */
    private cleanupDeprecatedVersions;
}
/**
 * Creates a version manager with default policies.
 */
export declare function createDefaultVersionManager(bundle?: ApprovalPolicyBundle): PolicyVersionManager;
