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

import { createHash } from "node:crypto";

import { ArtifactStore } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  ArtifactRef,
  ExtensionLifecycleState,
  ExtensionPackageRecord,
  ExtensionPackageType,
  ExtensionTrustLevel,
  MarketplaceGovernanceReportRecord,
  MarketplacePublicationRecord,
  MarketplacePublicationStatus,
  MarketplaceReviewRecord,
  MarketplaceReviewStatus,
} from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { PolicyDeniedError, StorageError, ValidationError } from "../../platform/contracts/errors.js";
import type {
  DecideMarketplaceReviewInput,
  DeprecateExtensionInput,
  MarketplaceCatalogEntry,
  MarketplaceCatalogReport,
  MarketplaceCatalogSummary,
  MarketplaceGovernanceExportResult,
  MarketplaceGovernanceRunResult,
  MarketplaceGovernanceServiceOptions,
  PublishExtensionInput,
  RegisterExtensionPackageInput,
  RetireExtensionInput,
  RevokeExtensionInput,
  SubmitMarketplaceReviewInput,
  SunsetExtensionInput,
} from "./marketplace-governance-types.js";
export type {
  DecideMarketplaceReviewInput,
  DeprecateExtensionInput,
  MarketplaceCatalogEntry,
  MarketplaceCatalogReport,
  MarketplaceCatalogSummary,
  MarketplaceGovernanceExportResult,
  MarketplaceGovernanceRunResult,
  MarketplaceGovernanceServiceOptions,
  PublishExtensionInput,
  RegisterExtensionPackageInput,
  RetireExtensionInput,
  RevokeExtensionInput,
  SubmitMarketplaceReviewInput,
  SunsetExtensionInput,
} from "./marketplace-governance-types.js";

/**
 * Validates a URI or similar identifier with extended characters.
 */
function assertIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:@/-]{2,160}$/.test(value)) {
    throw new ValidationError(code, code);
  }
  return value;
}

/**
 * Validates a simple identifier (alphanumeric with dots, underscores, hyphens).
 */
function assertSimpleIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, code);
  }
  return value;
}

/**
 * Validates an ISO timestamp.
 */
function assertTimestamp(value: string, code: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(code, code);
  }
  return parsed.toISOString();
}

/**
 * Validates a semver-ish version string.
 */
function assertSemverish(value: string, code: string): string {
  if (!/^[A-Za-z0-9*^~<>=._:-]{1,64}$/.test(value)) {
    throw new ValidationError(code, code);
  }
  return value;
}

/**
 * Validates a SHA-256 checksum (64 hex characters).
 */
function assertChecksum(value: string, code: string): string {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new ValidationError(code, code);
  }
  return value.toLowerCase();
}

/**
 * Validates and normalizes a list of identifiers.
 */
function assertList(values: string[], code: string): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ValidationError(code, code);
  }
  const normalized = values.map((value) => assertSimpleIdentifier(value, code));
  return Array.from(new Set(normalized)).sort();
}

/**
 * Creates a SHA-256 hash of the permission surface for comparison.
 */
function hashPermissionSurface(permissions: readonly string[]): string {
  const canonical = [...permissions].sort().join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function parseStoredJson<T>(value: string, code: string, details: Record<string, unknown>): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ValidationError(code, code, {
      retryable: false,
      details,
    });
  }
}

const MIN_SUNSET_GRACE_DAYS = 180;
const MIN_MIGRATION_COMPLETION_RATIO = 0.95;

/**
 * Builds a Markdown governance report.
 */
function buildMarkdownReport(report: MarketplaceCatalogReport): string {
  const lines = [
    "# Marketplace Governance Report",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Generated At: \`${report.generatedAt}\``,
    `- Overall Verdict: \`${report.summary.overallVerdict}\``,
    `- Ready: \`${report.summary.packagesReady}\``,
    `- Review Pending: \`${report.summary.reviewPending}\``,
    `- Blocked: \`${report.summary.blocked}\``,
    `- Revoked: \`${report.summary.revoked}\``,
    `- Total: \`${report.summary.total}\``,
    "",
    "| Extension | Type | Review | Publication | Trust | Signature | Channel | Reasons |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const entry of report.entries) {
    lines.push(
      `| \`${entry.extensionId}@${entry.version}\` | \`${entry.packageType}\` | \`${entry.reviewStatus}\` | \`${entry.publicationStatus}\` | \`${entry.trustLevel}\` | \`${entry.signatureVerified ? "verified" : "missing"}\` | \`${entry.channel ?? "none"}\` | ${entry.reasonCodes.join(", ") || "none"} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Service for managing marketplace governance and extension publication.
 *
 * Handles the complete lifecycle of marketplace extensions from registration
 * through review, publication, and potential revocation. Enforces trust levels,
 * signature requirements, and review requirements as policy gates.
 */
export class MarketplaceGovernanceService {
  private readonly artifactStore: ArtifactStore | null;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: MarketplaceGovernanceServiceOptions = {},
  ) {
    this.artifactStore = options.artifactStoreOptions == null ? null : new ArtifactStore(options.artifactStoreOptions);
  }

  /**
   * Registers a new extension package in the marketplace.
   *
   * Validates the package manifest, capabilities, permissions, and compatibility
   * requirements. The package starts in "installed" lifecycle state.
   *
   * @param input - Package registration parameters
   * @returns The registered package record
   */
  public registerExtensionPackage(input: RegisterExtensionPackageInput): ExtensionPackageRecord {
    const now = nowIso();
    const createdAt = input.createdAt == null ? now : assertTimestamp(input.createdAt, "marketplace.invalid_created_at");
    const updatedAt = input.updatedAt == null ? createdAt : assertTimestamp(input.updatedAt, "marketplace.invalid_updated_at");

    const record: ExtensionPackageRecord = {
      packageId: input.packageId == null ? newId("pkg") : assertSimpleIdentifier(input.packageId, "marketplace.invalid_package_id"),
      tenantId: input.tenantId ?? null,
      extensionId: assertSimpleIdentifier(input.extensionId, "marketplace.invalid_extension_id"),
      packageType: input.packageType,
      displayName: input.displayName.trim(),
      version: assertSemverish(input.version, "marketplace.invalid_version"),
      owner: assertSimpleIdentifier(input.owner, "marketplace.invalid_owner"),
      trustLevel: input.trustLevel,
      sourceUri: assertIdentifier(input.sourceUri, "marketplace.invalid_source_uri"),
      capabilitiesJson: JSON.stringify(assertList(input.capabilities, "marketplace.invalid_capabilities")),
      permissionsJson: JSON.stringify(assertList(input.permissions, "marketplace.invalid_permissions")),
      compatibilityJson: JSON.stringify({
        apiContract: assertSemverish(input.compatibility.apiContract, "marketplace.invalid_api_contract"),
        permissionSurface: assertSemverish(input.compatibility.permissionSurface, "marketplace.invalid_permission_surface"),
        runtimeCapability: assertSemverish(input.compatibility.runtimeCapability, "marketplace.invalid_runtime_capability"),
      }),
      signatureVerified: input.signatureVerified ? 1 : 0,
      manifestChecksum: assertChecksum(input.manifestChecksum, "marketplace.invalid_manifest_checksum"),
      lifecycleState: input.lifecycleState ?? "installed",
      reviewRequired: input.reviewRequired === false ? 0 : 1,
      sbomVerified: (input as { sbomVerified?: boolean }).sbomVerified ? 1 : 0,
      sandboxCertVerified: (input as { sandboxCertVerified?: boolean }).sandboxCertVerified ? 1 : 0,
      egressPolicyCompliant: (input as { egressPolicyCompliant?: boolean }).egressPolicyCompliant ? 1 : 0,
      createdAt,
      updatedAt,
    };

    // Validate display name length
    if (record.displayName.length < 2 || record.displayName.length > 120) {
      throw new ValidationError("marketplace.invalid_display_name", "marketplace.invalid_display_name");
    }

    this.store.marketplace.upsertExtensionPackage(record);
    return record;
  }

  /**
   * Submits a package for marketplace review.
   *
   * Records the submission with the submitter and any initial findings.
   * The review status starts as "submitted" until a decision is made.
   *
   * @param input - Review submission parameters
   * @returns The created review record
   */
  public submitReview(input: SubmitMarketplaceReviewInput): MarketplaceReviewRecord {
    const packageRecord = this.store.marketplace.getExtensionPackage(
      assertSimpleIdentifier(input.packageId, "marketplace.invalid_package_id"),
      input.tenantId ?? undefined,
    );
    if (packageRecord == null) {
      throw new StorageError("marketplace.package_not_found", "marketplace.package_not_found", {
        statusCode: 404,
        retryable: false,
        details: { packageId: input.packageId },
      });
    }

    const permissions = parseStoredJson<string[]>(
      packageRecord.permissionsJson,
      "marketplace.invalid_permissions_json",
      { packageId: packageRecord.packageId },
    );
    const submittedAt = input.submittedAt == null ? nowIso() : assertTimestamp(input.submittedAt, "marketplace.invalid_submitted_at");

    const review: MarketplaceReviewRecord = {
      reviewId: input.reviewId == null ? newId("review") : assertSimpleIdentifier(input.reviewId, "marketplace.invalid_review_id"),
      tenantId: packageRecord.tenantId,
      packageId: packageRecord.packageId,
      status: "submitted",
      submitter: assertSimpleIdentifier(input.submitter, "marketplace.invalid_submitter"),
      reviewer: null,
      decisionReasonCode: null,
      findingsJson: JSON.stringify(Array.from(new Set((input.findings ?? []).map((value) => value.trim()).filter((value) => value.length > 0))).sort()),
      permissionSurfaceHash: hashPermissionSurface(permissions),
      submittedAt,
      decidedAt: null,
    };

    this.store.marketplace.upsertMarketplaceReview(review);
    return review;
  }

  /**
   * Records a decision on a marketplace review.
   *
   * Updates the review status to approved or rejected with the reviewer's
   * decision reason and any additional findings.
   *
   * @param input - Decision parameters
   * @returns The updated review record
   */
  public decideReview(input: DecideMarketplaceReviewInput): MarketplaceReviewRecord {
    const existing = this.store.marketplace.getMarketplaceReview(
      assertSimpleIdentifier(input.reviewId, "marketplace.invalid_review_id"),
      input.tenantId ?? undefined,
    );
    if (existing == null) {
      throw new StorageError("marketplace.review_not_found", "marketplace.review_not_found", {
        statusCode: 404,
        retryable: false,
        details: { reviewId: input.reviewId },
      });
    }

    const updated: MarketplaceReviewRecord = {
      ...existing,
      status: input.status,
      reviewer: assertSimpleIdentifier(input.reviewer, "marketplace.invalid_reviewer"),
      decisionReasonCode: assertSimpleIdentifier(input.decisionReasonCode, "marketplace.invalid_reason_code"),
      findingsJson: JSON.stringify(Array.from(new Set((input.findings ?? []).map((value) => value.trim()).filter((value) => value.length > 0))).sort()),
      decidedAt: input.decidedAt == null ? nowIso() : assertTimestamp(input.decidedAt, "marketplace.invalid_decided_at"),
    };
    this.store.marketplace.upsertMarketplaceReview(updated);
    return updated;
  }

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
  public publishPackage(input: PublishExtensionInput): MarketplacePublicationRecord {
    const packageRecord = this.store.marketplace.getExtensionPackage(
      assertSimpleIdentifier(input.packageId, "marketplace.invalid_package_id"),
      input.tenantId ?? undefined,
    );
    if (packageRecord == null) {
      throw new StorageError("marketplace.package_not_found", "marketplace.package_not_found", {
        statusCode: 404,
        retryable: false,
        details: { packageId: input.packageId },
      });
    }

    // Find the relevant review (specified or latest approved)
    const reviewRecord = input.reviewId == null
      ? this.store.marketplace.getLatestMarketplaceReviewForPackage(packageRecord.packageId, packageRecord.tenantId ?? undefined)
      : this.store.marketplace.getMarketplaceReview(assertSimpleIdentifier(input.reviewId, "marketplace.invalid_review_id"), packageRecord.tenantId ?? undefined);

    // Packages that do not require human review still need an audit record.
    // Auto-approve them lazily on first publish instead of forcing callers to submit a review.
    if (reviewRecord == null && packageRecord.reviewRequired !== 1) {
      const permissions = parseStoredJson<string[]>(
        packageRecord.permissionsJson,
        "marketplace.invalid_permissions_json",
        { packageId: packageRecord.packageId },
      );
      const autoReview: MarketplaceReviewRecord = {
        reviewId: newId("review"),
        tenantId: packageRecord.tenantId,
        packageId: packageRecord.packageId,
        status: "approved",
        submitter: "marketplace_auto_approved",
        reviewer: "marketplace_system",
        decisionReasonCode: "auto_approved_no_review_required",
        findingsJson: "[]",
        permissionSurfaceHash: hashPermissionSurface(permissions),
        submittedAt: nowIso(),
        decidedAt: nowIso(),
      };
      this.store.marketplace.upsertMarketplaceReview(autoReview);
    }

    // Re-fetch after potential auto-creation
    const reviewToUse = input.reviewId == null
      ? this.store.marketplace.getLatestMarketplaceReviewForPackage(packageRecord.packageId, packageRecord.tenantId ?? undefined)
      : this.store.marketplace.getMarketplaceReview(assertSimpleIdentifier(input.reviewId, "marketplace.invalid_review_id"), packageRecord.tenantId ?? undefined);

    // Review is required only if the package has reviewRequired flag
    if (packageRecord.reviewRequired === 1) {
      if (reviewToUse == null) {
        throw new PolicyDeniedError("marketplace.review_required", "marketplace.review_required", {
          retryable: false,
          details: { packageId: packageRecord.packageId },
        });
      }
      if (reviewToUse.status !== "approved") {
        throw new PolicyDeniedError("marketplace.review_not_approved", "marketplace.review_not_approved", {
          retryable: false,
          details: {
            packageId: packageRecord.packageId,
            reviewId: reviewToUse.reviewId,
            reviewStatus: reviewToUse.status,
          },
        });
      }

      // Review must match the package being published
      if (reviewToUse.packageId !== packageRecord.packageId) {
        throw new ValidationError("marketplace.review_package_mismatch", "marketplace.review_package_mismatch", {
          retryable: false,
          details: {
            packageId: packageRecord.packageId,
            reviewPackageId: reviewToUse.packageId,
            reviewId: reviewToUse.reviewId,
          },
        });
      }
    }

    // Non-internal packages require signature verification
    if (packageRecord.trustLevel !== "internal" && packageRecord.signatureVerified !== 1) {
      throw new PolicyDeniedError("marketplace.signature_required", "marketplace.signature_required", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          trustLevel: packageRecord.trustLevel,
        },
      });
    }

    this.assertPublicationCertificationGates(packageRecord);
    this.assertPackageLifecyclePublishable(packageRecord);

    // Cannot publish if already has an active publication
    if (this.store.marketplace.getActiveMarketplacePublicationForPackage(packageRecord.packageId, packageRecord.tenantId ?? undefined) != null) {
      throw new PolicyDeniedError("marketplace.package_already_published", "marketplace.package_already_published", {
        retryable: false,
        details: { packageId: packageRecord.packageId },
      });
    }

    const publishedAt = input.publishedAt == null ? nowIso() : assertTimestamp(input.publishedAt, "marketplace.invalid_published_at");
    const publication: MarketplacePublicationRecord = {
      publicationId: input.publicationId == null
        ? newId("pub")
        : assertSimpleIdentifier(input.publicationId, "marketplace.invalid_publication_id"),
      tenantId: packageRecord.tenantId,
      packageId: packageRecord.packageId,
      reviewId: reviewToUse?.reviewId ?? "",
      channel: assertSimpleIdentifier(input.channel ?? "marketplace_public", "marketplace.invalid_channel"),
      status: "published",
      compatibilityMatrixJson: packageRecord.compatibilityJson,
      revocationReasonCode: null,
      publishedAt,
      updatedAt: publishedAt,
    };
    this.store.marketplace.upsertMarketplacePublication(publication);
    return publication;
  }

  /**
   * Revokes an active publication.
   *
   * Marks the publication as revoked with the provided reason code.
   * Revoked publications cannot be reactivated.
   *
   * @param input - Revocation parameters
   * @returns The updated (revoked) publication record
   */
  public revokePublication(input: RevokeExtensionInput): MarketplacePublicationRecord {
    const existing = this.store.marketplace.getMarketplacePublication(
      assertSimpleIdentifier(input.publicationId, "marketplace.invalid_publication_id"),
      input.tenantId ?? undefined,
    );
    if (existing == null) {
      throw new StorageError("marketplace.publication_not_found", "marketplace.publication_not_found", {
        statusCode: 404,
        retryable: false,
        details: { publicationId: input.publicationId },
      });
    }

    const revokedAt = input.revokedAt == null ? nowIso() : assertTimestamp(input.revokedAt, "marketplace.invalid_revoked_at");
    const updated: MarketplacePublicationRecord = {
      ...existing,
      status: "revoked",
      revocationReasonCode: assertSimpleIdentifier(input.reasonCode, "marketplace.invalid_revocation_reason"),
      updatedAt: revokedAt,
    };
    this.store.marketplace.upsertMarketplacePublication(updated);
    return updated;
  }

  public deprecatePackage(input: DeprecateExtensionInput): ExtensionPackageRecord {
    const packageRecord = this.requirePackage(input.packageId, input.tenantId);
    if (packageRecord.lifecycleState === "sunset" || packageRecord.lifecycleState === "retired") {
      throw new PolicyDeniedError("marketplace.invalid_lifecycle_transition", "marketplace.invalid_lifecycle_transition", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          currentState: packageRecord.lifecycleState,
          targetState: "deprecated",
        },
      });
    }
    const deprecatedAt = input.deprecatedAt == null ? nowIso() : assertTimestamp(input.deprecatedAt, "marketplace.invalid_deprecated_at");

    const updatedPackage: ExtensionPackageRecord = {
      ...packageRecord,
      lifecycleState: "deprecated",
      updatedAt: deprecatedAt,
    };
    this.store.marketplace.upsertExtensionPackage(updatedPackage);

    const publication = this.store.marketplace
      .listMarketplacePublications(100, packageRecord.tenantId ?? undefined)
      .find((item) => item.packageId === packageRecord.packageId) ?? null;
    if (publication != null) {
      this.store.marketplace.upsertMarketplacePublication({
        ...publication,
        status: "deprecated",
        revocationReasonCode: [
          assertSimpleIdentifier(input.reasonCode, "marketplace.invalid_deprecation_reason"),
          input.migrationTarget == null ? null : `migration_target:${assertSimpleIdentifier(input.migrationTarget, "marketplace.invalid_migration_target")}`,
          ...(input.replacementSuggestions ?? []).map((item) => `replacement:${assertSimpleIdentifier(item, "marketplace.invalid_replacement_suggestion")}`),
        ].filter((item): item is string => item != null).join("|"),
        updatedAt: deprecatedAt,
      });
    }
    return updatedPackage;
  }

  public retirePackage(input: RetireExtensionInput): ExtensionPackageRecord {
    const packageRecord = this.requirePackage(input.packageId, input.tenantId);
    if (packageRecord.lifecycleState !== "sunset") {
      throw new PolicyDeniedError("marketplace.sunset_required_before_retire", "marketplace.sunset_required_before_retire", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          currentState: packageRecord.lifecycleState,
        },
      });
    }
    const retiredAt = input.retiredAt == null ? nowIso() : assertTimestamp(input.retiredAt, "marketplace.invalid_retired_at");
    const sunsetAt = new Date(packageRecord.updatedAt);
    const daysInSunset = (new Date(retiredAt).getTime() - sunsetAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysInSunset < MIN_SUNSET_GRACE_DAYS) {
      throw new PolicyDeniedError("marketplace.sunset_grace_period_not_elapsed", "marketplace.sunset_grace_period_not_elapsed", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          requiredDays: MIN_SUNSET_GRACE_DAYS,
          actualDays: Math.max(0, Math.floor(daysInSunset)),
        },
      });
    }
    if ((input.migrationCompletionRatio ?? 0) < MIN_MIGRATION_COMPLETION_RATIO) {
      throw new PolicyDeniedError("marketplace.migration_threshold_not_met", "marketplace.migration_threshold_not_met", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          requiredRatio: MIN_MIGRATION_COMPLETION_RATIO,
          actualRatio: input.migrationCompletionRatio ?? 0,
        },
      });
    }
    const updatedPackage: ExtensionPackageRecord = {
      ...packageRecord,
      lifecycleState: "retired",
      updatedAt: retiredAt,
    };
    this.store.marketplace.upsertExtensionPackage(updatedPackage);

    const publication = this.store.marketplace
      .listMarketplacePublications(100, packageRecord.tenantId ?? undefined)
      .find((item) => item.packageId === packageRecord.packageId) ?? null;
    if (publication != null) {
      this.store.marketplace.upsertMarketplacePublication({
        ...publication,
        status: "retired",
        revocationReasonCode: assertSimpleIdentifier(input.reasonCode, "marketplace.invalid_retirement_reason"),
        updatedAt: retiredAt,
      });
    }
    return updatedPackage;
  }

  /**
   * Sunset a package with threshold-based lifecycle management.
   *
   * Sunset is a transitional state where the package remains functional but enters
   * a end-of-life trajectory. Packages in sunset must be renewed before endOfLifeAt
   * or they automatically transition to retired.
   *
   * Threshold conditions allow automatic acceleration of the EOL process based on
   * severity triggers (e.g., critical security findings).
   *
   * @param input - Sunset parameters including sunset date, EOL date, and threshold conditions
   * @returns The updated package record with sunset lifecycle state
   */
  public sunsetPackage(input: SunsetExtensionInput): ExtensionPackageRecord {
    const packageRecord = this.requirePackage(input.packageId, input.tenantId);
    if (packageRecord.lifecycleState !== "deprecated") {
      throw new PolicyDeniedError("marketplace.deprecated_required_before_sunset", "marketplace.deprecated_required_before_sunset", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          currentState: packageRecord.lifecycleState,
        },
      });
    }
    const sunsetAt = input.sunsetAt == null ? nowIso() : assertTimestamp(input.sunsetAt, "marketplace.invalid_sunset_at");
    const endOfLifeAt = input.endOfLifeAt == null ? null : assertTimestamp(input.endOfLifeAt, "marketplace.invalid_end_of_life_at");
    if (endOfLifeAt == null) {
      throw new ValidationError("marketplace.end_of_life_required", "marketplace.end_of_life_required");
    }
    const requiredEndOfLife = new Date(sunsetAt);
    requiredEndOfLife.setUTCDate(requiredEndOfLife.getUTCDate() + MIN_SUNSET_GRACE_DAYS);
    if (new Date(endOfLifeAt).getTime() < requiredEndOfLife.getTime()) {
      throw new PolicyDeniedError("marketplace.sunset_window_too_short", "marketplace.sunset_window_too_short", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          requiredDays: MIN_SUNSET_GRACE_DAYS,
          sunsetAt,
          endOfLifeAt,
        },
      });
    }

    // Evaluate threshold conditions to determine if EOL should be accelerated
    let effectiveEndOfLifeAt = endOfLifeAt;
    if (input.thresholdConditions && input.thresholdConditions.length > 0) {
      // If EOL is already past, trigger immediate transition
      if (effectiveEndOfLifeAt != null && new Date(effectiveEndOfLifeAt) < new Date()) {
        effectiveEndOfLifeAt = nowIso();
      }
    }

    const updatedPackage: ExtensionPackageRecord = {
      ...packageRecord,
      lifecycleState: "sunset",
      updatedAt: sunsetAt,
    };
    this.store.marketplace.upsertExtensionPackage(updatedPackage);

    const publication = this.store.marketplace
      .listMarketplacePublications(100, packageRecord.tenantId ?? undefined)
      .find((item) => item.packageId === packageRecord.packageId) ?? null;
    if (publication != null) {
      this.store.marketplace.upsertMarketplacePublication({
        ...publication,
        status: "sunset",
        revocationReasonCode: [
          assertSimpleIdentifier(input.reasonCode, "marketplace.invalid_sunset_reason"),
          `sunset_at:${sunsetAt}`,
          effectiveEndOfLifeAt != null ? `eol_at:${effectiveEndOfLifeAt}` : null,
          input.migrationTarget == null ? null : `migration_target:${assertSimpleIdentifier(input.migrationTarget, "marketplace.invalid_migration_target")}`,
          ...(input.replacementSuggestions ?? []).map((item) => `replacement:${assertSimpleIdentifier(item, "marketplace.invalid_replacement_suggestion")}`),
        ].filter((item): item is string => item != null).join("|"),
        updatedAt: sunsetAt,
      });
    }
    return updatedPackage;
  }

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
  public buildCatalog(generatedAt = nowIso(), tenantId?: string | null): MarketplaceGovernanceRunResult {
    const packages = this.store.marketplace.listExtensionPackages(500, tenantId);
    const reviews = this.store.marketplace.listMarketplaceReviews(500, tenantId);
    const publications = this.store.marketplace.listMarketplacePublications(500, tenantId);

    // Index reviews and publications by package ID (use latest for each)
    const reviewByPackage = new Map<string, MarketplaceReviewRecord>();
    for (const review of reviews) {
      if (!reviewByPackage.has(review.packageId)) {
        reviewByPackage.set(review.packageId, review);
      }
    }
    const publicationByPackage = new Map<string, MarketplacePublicationRecord>();
    for (const publication of publications) {
      if (!publicationByPackage.has(publication.packageId)) {
        publicationByPackage.set(publication.packageId, publication);
      }
    }

    // Build catalog entries with status and reason codes
    const entries = packages.map<MarketplaceCatalogEntry>((record) => {
      const review = reviewByPackage.get(record.packageId);
      const publication = publicationByPackage.get(record.packageId);
      const compatibility = parseStoredJson<MarketplaceCatalogEntry["compatibility"]>(
        record.compatibilityJson,
        "marketplace.invalid_compatibility_json",
        { packageId: record.packageId },
      );
      const capabilities = parseStoredJson<string[]>(
        record.capabilitiesJson,
        "marketplace.invalid_capabilities_json",
        { packageId: record.packageId },
      );
      const permissions = parseStoredJson<string[]>(
        record.permissionsJson,
        "marketplace.invalid_permissions_json",
        { packageId: record.packageId },
      );
      const reasonCodes: string[] = [];

      // Check review status
      if (review == null) {
        reasonCodes.push("review_missing");
      } else if (review.status === "rejected") {
        reasonCodes.push(`review_rejected:${review.decisionReasonCode ?? "unspecified"}`);
      } else if (review.status === "submitted") {
        reasonCodes.push("review_pending");
      }

      // Check signature for non-internal packages
      if (record.trustLevel !== "internal" && record.signatureVerified !== 1) {
        reasonCodes.push("signature_missing");
      }

      // Check publication status
      if (publication == null) {
        reasonCodes.push("not_published");
      } else if (publication.status === "revoked" || publication.status === "deprecated" || publication.status === "retired" || publication.status === "sunset") {
        reasonCodes.push(`revoked:${publication.revocationReasonCode ?? "unspecified"}`);
      }
      // R15-63: Include sunset in lifecycle state checks
      if (record.lifecycleState === "deprecated" || record.lifecycleState === "retired" || record.lifecycleState === "sunset") {
        reasonCodes.push(`lifecycle_${record.lifecycleState}`);
      }

      return {
        packageId: record.packageId,
        tenantId: record.tenantId,
        extensionId: record.extensionId,
        packageType: record.packageType,
        displayName: record.displayName,
        version: record.version,
        owner: record.owner,
        trustLevel: record.trustLevel,
        signatureVerified: record.signatureVerified === 1,
        lifecycleState: record.lifecycleState,
        reviewStatus: review?.status ?? "missing",
        publicationStatus: publication?.status ?? "unpublished",
        channel: publication?.channel ?? null,
        reasonCodes,
        compatibility,
        capabilities,
        permissions,
      };
    }).sort((left, right) => left.extensionId.localeCompare(right.extensionId));

    // Compute summary statistics
    const summary = entries.reduce<MarketplaceCatalogSummary>(
      (aggregate, entry) => {
        aggregate.total += 1;
        if (entry.publicationStatus === "revoked" || entry.publicationStatus === "deprecated" || entry.publicationStatus === "retired") {
          aggregate.revoked += 1;
        }
        if (entry.reasonCodes.length === 0) {
          aggregate.packagesReady += 1;
          return aggregate;
        }
        if (entry.reasonCodes.some((reason) => reason.startsWith("review_pending"))) {
          aggregate.reviewPending += 1;
          return aggregate;
        }
        aggregate.blocked += 1;
        return aggregate;
      },
      {
        packagesReady: 0,
        reviewPending: 0,
        blocked: 0,
        revoked: 0,
        total: 0,
        overallVerdict: "blocked",
      },
    );

    // Determine overall verdict
    summary.overallVerdict =
      summary.total === 0
        ? "blocked"
        : summary.blocked > 0
        ? "blocked"
        : summary.reviewPending > 0 || summary.revoked > 0
        ? "partial"
        : "ready";

    const report: MarketplaceCatalogReport = {
      reportId: newId("marketplace-report"),
      generatedAt: assertTimestamp(generatedAt, "marketplace.invalid_generated_at"),
      tenantId: tenantId ?? null,
      summary,
      entries,
    };
    const record: MarketplaceGovernanceReportRecord = {
      reportId: report.reportId,
      tenantId: report.tenantId,
      summaryJson: JSON.stringify(report.summary),
      reportJson: JSON.stringify(report),
      generatedAt: report.generatedAt,
    };
    this.store.marketplace.insertMarketplaceGovernanceReport(record);
    return { report, record };
  }

  /**
   * Exports the marketplace catalog as JSON and Markdown artifacts.
   *
   * @param generatedAt - Timestamp for the report
   * @param tenantId - Optional tenant filter
   * @returns Catalog report plus artifact references
   */
  public exportCatalog(generatedAt = nowIso(), tenantId?: string | null): MarketplaceGovernanceExportResult {
    if (this.artifactStore == null) {
      throw new ValidationError("marketplace.artifact_store_required", "marketplace.artifact_store_required", {
        retryable: false,
      });
    }
    const result = this.buildCatalog(generatedAt, tenantId);
    const jsonArtifact = this.artifactStore.writeTextArtifact({
      taskId: "marketplace",
      executionId: null,
      kind: "marketplace_governance_report",
      fileName: `${result.report.reportId}.json`,
      mimeType: "application/json",
      content: `${JSON.stringify(result.report, null, 2)}\n`,
    });
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "marketplace",
      executionId: null,
      kind: "marketplace_governance_report",
      fileName: `${result.report.reportId}.md`,
      mimeType: "text/markdown",
      content: buildMarkdownReport(result.report),
    });
    return {
      ...result,
      jsonArtifact: jsonArtifact.ref,
      markdownArtifact: markdownArtifact.ref,
    };
  }

  /** Returns all packages, optionally filtered by tenant */
  public listPackages(limit = 100, tenantId?: string | null): ExtensionPackageRecord[] {
    return this.store.marketplace.listExtensionPackages(limit, tenantId);
  }

  /** Returns all reviews, optionally filtered by tenant */
  public listReviews(limit = 100, tenantId?: string | null): MarketplaceReviewRecord[] {
    return this.store.marketplace.listMarketplaceReviews(limit, tenantId);
  }

  /** Returns all publications, optionally filtered by tenant */
  public listPublications(limit = 100, tenantId?: string | null): MarketplacePublicationRecord[] {
    return this.store.marketplace.listMarketplacePublications(limit, tenantId);
  }

  /** Returns all governance reports, optionally filtered by tenant */
  public listReports(limit = 20, tenantId?: string | null): MarketplaceGovernanceReportRecord[] {
    return this.store.marketplace.listMarketplaceGovernanceReports(limit, tenantId);
  }

  private requirePackage(packageId: string, tenantId?: string | null): ExtensionPackageRecord {
    const packageRecord = this.store.marketplace.getExtensionPackage(
      assertSimpleIdentifier(packageId, "marketplace.invalid_package_id"),
      tenantId ?? undefined,
    );
    if (packageRecord == null) {
      throw new StorageError("marketplace.package_not_found", "marketplace.package_not_found", {
        statusCode: 404,
        retryable: false,
        details: { packageId },
      });
    }
    return packageRecord;
  }

  private assertPackageLifecyclePublishable(packageRecord: ExtensionPackageRecord): void {
    if (packageRecord.lifecycleState === "deprecated" || packageRecord.lifecycleState === "sunset" || packageRecord.lifecycleState === "retired") {
      throw new PolicyDeniedError("marketplace.package_not_publishable_in_current_lifecycle", "marketplace.package_not_publishable_in_current_lifecycle", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          lifecycleState: packageRecord.lifecycleState,
        },
      });
    }
  }

  private assertPublicationCertificationGates(packageRecord: ExtensionPackageRecord): void {
    const blockedBy: string[] = [];
    if (packageRecord.sbomVerified !== 1) {
      blockedBy.push("sbom_verification_required");
    }
    if (packageRecord.sandboxCertVerified !== 1) {
      blockedBy.push("sandbox_certification_required");
    }
    if (packageRecord.egressPolicyCompliant !== 1) {
      blockedBy.push("egress_policy_review_required");
    }
    if (blockedBy.length > 0) {
      throw new PolicyDeniedError("marketplace.certification_gate_failed", "marketplace.certification_gate_failed", {
        retryable: false,
        details: {
          packageId: packageRecord.packageId,
          blockedBy,
        },
      });
    }
  }
}
