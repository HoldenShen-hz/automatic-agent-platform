/**
 * Marketplace Governance Service
 *
 * Manages the extension marketplace governance lifecycle including package registration,
 * review submission, review decisions, publication, and revocation. Enforces policies
 * around signature verification, trust levels, and review requirements before packages
 * can be published to the marketplace.
 *
 * Publication lifecycle:
 * 1. Register extension package with manifest and capabilities
 * 2. Submit for marketplace review (if review required)
 * 3. Reviewer approves or rejects the submission
 * 4. Approved packages can be published to a channel
 * 5. Publications can be revoked
 *
 * Trust levels and signature requirements:
 * - Internal packages do not require signature verification
 * - External packages must have signature verified before publication
 *
 * @see docs_zh/architecture/00-platform-architecture.md for marketplace architecture
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactRef, ExtensionLifecycleState, ExtensionPackageRecord, ExtensionPackageType, ExtensionTrustLevel, MarketplaceGovernanceReportRecord, MarketplacePublicationRecord, MarketplacePublicationStatus, MarketplaceReviewRecord, MarketplaceReviewStatus } from "../../platform/contracts/types/domain.js";
/** Input for registering a new extension package */
export interface RegisterExtensionPackageInput {
    /** Optional package ID (auto-generated if not provided) */
    packageId?: string;
    /** Tenant scope for this package (null for global) */
    tenantId?: string | null;
    /** Extension identifier this package implements */
    extensionId: string;
    /** Type of package (tool, workflow, integration, etc.) */
    packageType: ExtensionPackageType;
    /** Human-readable display name */
    displayName: string;
    /** Version string (semver-ish) */
    version: string;
    /** Owner identifier */
    owner: string;
    /** Trust level classification */
    trustLevel: ExtensionTrustLevel;
    /** URI to the package source */
    sourceUri: string;
    /** Capabilities provided by this package */
    capabilities: string[];
    /** Permissions required by this package */
    permissions: string[];
    /** Compatibility requirements for this package */
    compatibility: {
        apiContract: string;
        permissionSurface: string;
        runtimeCapability: string;
    };
    /** Whether the package signature has been verified */
    signatureVerified: boolean;
    /** SHA-256 checksum of the manifest */
    manifestChecksum: string;
    /** Current lifecycle state (defaults to installed) */
    lifecycleState?: ExtensionLifecycleState;
    /** Whether review is required before publication */
    reviewRequired?: boolean;
    /** Creation timestamp override */
    createdAt?: string;
    /** Update timestamp override */
    updatedAt?: string;
}
/** Input for submitting a package for marketplace review */
export interface SubmitMarketplaceReviewInput {
    /** Optional review ID (auto-generated if not provided) */
    reviewId?: string;
    /** Tenant scope */
    tenantId?: string | null;
    /** Package to submit for review */
    packageId: string;
    /** Submitter identifier */
    submitter: string;
    /** Optional initial findings */
    findings?: string[];
    /** Submission timestamp override */
    submittedAt?: string;
}
/** Input for a review decision */
export interface DecideMarketplaceReviewInput {
    /** Review ID to decide */
    reviewId: string;
    /** Tenant scope */
    tenantId?: string | null;
    /** Decision status */
    status: Extract<MarketplaceReviewStatus, "approved" | "rejected">;
    /** Reviewer identifier */
    reviewer: string;
    /** Reason code for the decision */
    decisionReasonCode: string;
    /** Optional final findings */
    findings?: string[];
    /** Decision timestamp override */
    decidedAt?: string;
}
/** Input for publishing an approved package */
export interface PublishExtensionInput {
    /** Optional publication ID (auto-generated if not provided) */
    publicationId?: string;
    /** Tenant scope */
    tenantId?: string | null;
    /** Package to publish */
    packageId: string;
    /** Review that approved this package (latest approved if not specified) */
    reviewId?: string;
    /** Channel to publish to (defaults to marketplace_public) */
    channel?: string;
    /** Publication timestamp override */
    publishedAt?: string;
}
/** Input for revoking a publication */
export interface RevokeExtensionInput {
    /** Publication to revoke */
    publicationId: string;
    /** Tenant scope */
    tenantId?: string | null;
    /** Reason code for revocation */
    reasonCode: string;
    /** Revocation timestamp override */
    revokedAt?: string;
}
export interface DeprecateExtensionInput {
    packageId: string;
    tenantId?: string | null;
    reasonCode: string;
    deprecatedAt?: string;
}
export interface RetireExtensionInput {
    packageId: string;
    tenantId?: string | null;
    reasonCode: string;
    retiredAt?: string;
}
/** Entry in the marketplace catalog */
export interface MarketplaceCatalogEntry {
    packageId: string;
    tenantId: string | null;
    extensionId: string;
    packageType: ExtensionPackageType;
    displayName: string;
    version: string;
    owner: string;
    trustLevel: ExtensionTrustLevel;
    signatureVerified: boolean;
    lifecycleState: ExtensionLifecycleState;
    reviewStatus: MarketplaceReviewStatus | "missing";
    publicationStatus: MarketplacePublicationStatus | "unpublished";
    channel: string | null;
    reasonCodes: string[];
    compatibility: {
        apiContract: string;
        permissionSurface: string;
        runtimeCapability: string;
    };
    capabilities: string[];
    permissions: string[];
}
/** Summary statistics for the marketplace catalog */
export interface MarketplaceCatalogSummary {
    packagesReady: number;
    reviewPending: number;
    blocked: number;
    revoked: number;
    total: number;
    overallVerdict: "ready" | "partial" | "blocked";
}
/** Complete marketplace governance catalog report */
export interface MarketplaceCatalogReport {
    reportId: string;
    generatedAt: string;
    tenantId: string | null;
    summary: MarketplaceCatalogSummary;
    entries: MarketplaceCatalogEntry[];
}
/** Result of running marketplace governance */
export interface MarketplaceGovernanceRunResult {
    report: MarketplaceCatalogReport;
    record: MarketplaceGovernanceReportRecord;
}
/** Result of exporting the marketplace catalog */
export interface MarketplaceGovernanceExportResult extends MarketplaceGovernanceRunResult {
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/** Options for MarketplaceGovernanceService */
export interface MarketplaceGovernanceServiceOptions {
    artifactStoreOptions?: ArtifactStoreOptions;
}
/**
 * Service for managing marketplace governance and extension publication.
 *
 * Handles the complete lifecycle of marketplace extensions from registration
 * through review, publication, and potential revocation. Enforces trust levels,
 * signature requirements, and review requirements as policy gates.
 */
export declare class MarketplaceGovernanceService {
    private readonly db;
    private readonly store;
    private readonly artifactStore;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: MarketplaceGovernanceServiceOptions);
    /**
     * Registers a new extension package in the marketplace.
     *
     * Validates the package manifest, capabilities, permissions, and compatibility
     * requirements. The package starts in "installed" lifecycle state.
     *
     * @param input - Package registration parameters
     * @returns The registered package record
     */
    registerExtensionPackage(input: RegisterExtensionPackageInput): ExtensionPackageRecord;
    /**
     * Submits a package for marketplace review.
     *
     * Records the submission with the submitter and any initial findings.
     * The review status starts as "submitted" until a decision is made.
     *
     * @param input - Review submission parameters
     * @returns The created review record
     */
    submitReview(input: SubmitMarketplaceReviewInput): MarketplaceReviewRecord;
    /**
     * Records a decision on a marketplace review.
     *
     * Updates the review status to approved or rejected with the reviewer's
     * decision reason and any additional findings.
     *
     * @param input - Decision parameters
     * @returns The updated review record
     */
    decideReview(input: DecideMarketplaceReviewInput): MarketplaceReviewRecord;
    /**
     * Publishes an approved package to a marketplace channel.
     *
     * Validates all publication prerequisites:
     * - Package must exist
     * - Review must be approved (or package must not require review)
     * - Non-internal packages must have signature verified
     * - Package must not already have an active publication
     *
     * @param input - Publication parameters
     * @returns The created publication record
     */
    publishPackage(input: PublishExtensionInput): MarketplacePublicationRecord;
    /**
     * Revokes an active publication.
     *
     * Marks the publication as revoked with the provided reason code.
     * Revoked publications cannot be reactivated.
     *
     * @param input - Revocation parameters
     * @returns The updated (revoked) publication record
     */
    revokePublication(input: RevokeExtensionInput): MarketplacePublicationRecord;
    deprecatePackage(input: DeprecateExtensionInput): ExtensionPackageRecord;
    retirePackage(input: RetireExtensionInput): ExtensionPackageRecord;
    /**
     * Builds a complete marketplace governance catalog.
     *
     * Collects all packages, their reviews, and publications to produce
     * a comprehensive catalog with status and reason codes for each entry.
     *
     * @param generatedAt - Timestamp for the report (defaults to now)
     * @param tenantId - Optional tenant filter
     * @returns Catalog report and governance report record
     */
    buildCatalog(generatedAt?: string, tenantId?: string | null): MarketplaceGovernanceRunResult;
    /**
     * Exports the marketplace catalog as JSON and Markdown artifacts.
     *
     * @param generatedAt - Timestamp for the report
     * @param tenantId - Optional tenant filter
     * @returns Catalog report plus artifact references
     */
    exportCatalog(generatedAt?: string, tenantId?: string | null): MarketplaceGovernanceExportResult;
    /** Returns all packages, optionally filtered by tenant */
    listPackages(limit?: number, tenantId?: string | null): ExtensionPackageRecord[];
    /** Returns all reviews, optionally filtered by tenant */
    listReviews(limit?: number, tenantId?: string | null): MarketplaceReviewRecord[];
    /** Returns all publications, optionally filtered by tenant */
    listPublications(limit?: number, tenantId?: string | null): MarketplacePublicationRecord[];
    /** Returns all governance reports, optionally filtered by tenant */
    listReports(limit?: number, tenantId?: string | null): MarketplaceGovernanceReportRecord[];
    private requirePackage;
}
