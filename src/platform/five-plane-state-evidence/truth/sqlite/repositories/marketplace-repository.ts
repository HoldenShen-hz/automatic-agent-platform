import type {
  ExtensionPackageRecord,
  MarketplaceGovernanceReportRecord,
  MarketplacePublicationRecord,
  MarketplaceReviewRecord,
} from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
import { execute, queryAll, queryOne } from "../query-helper.js";

/**
 * Standalone repository boundary for extension package / review / publication /
 * governance records.
 */
export class MarketplaceRepository {
  public constructor(private readonly db: AuthoritativeSqlDatabase) {}

  public upsertMarketplaceReview(record: MarketplaceReviewRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO marketplace_reviews (
        review_id, tenant_id, package_id, status, submitter, reviewer, decision_reason_code,
        findings_json, permission_surface_hash, submitted_at, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(review_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        package_id = excluded.package_id,
        status = excluded.status,
        submitter = excluded.submitter,
        reviewer = excluded.reviewer,
        decision_reason_code = excluded.decision_reason_code,
        findings_json = excluded.findings_json,
        permission_surface_hash = excluded.permission_surface_hash,
        submitted_at = excluded.submitted_at,
        decided_at = excluded.decided_at`,
      record.reviewId,
      record.tenantId,
      record.packageId,
      record.status,
      record.submitter,
      record.reviewer,
      record.decisionReasonCode,
      record.findingsJson,
      record.permissionSurfaceHash,
      record.submittedAt,
      record.decidedAt,
    );
  }

  public upsertMarketplacePublication(record: MarketplacePublicationRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO marketplace_publications (
        publication_id, tenant_id, package_id, review_id, channel, status, compatibility_matrix_json,
        revocation_reason_code, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(publication_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        package_id = excluded.package_id,
        review_id = excluded.review_id,
        channel = excluded.channel,
        status = excluded.status,
        compatibility_matrix_json = excluded.compatibility_matrix_json,
        revocation_reason_code = excluded.revocation_reason_code,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at`,
      record.publicationId,
      record.tenantId,
      record.packageId,
      record.reviewId,
      record.channel,
      record.status,
      record.compatibilityMatrixJson,
      record.revocationReasonCode,
      record.publishedAt,
      record.updatedAt,
    );
  }

  public insertMarketplaceGovernanceReport(record: MarketplaceGovernanceReportRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO marketplace_governance_reports (
        report_id, tenant_id, summary_json, report_json, generated_at
      ) VALUES (?, ?, ?, ?, ?)`,
      record.reportId,
      record.tenantId,
      record.summaryJson,
      record.reportJson,
      record.generatedAt,
    );
  }

  public upsertExtensionPackage(record: ExtensionPackageRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO extension_packages (
        package_id, tenant_id, extension_id, package_type, display_name, version, owner, trust_level,
        source_uri, capabilities_json, permissions_json, compatibility_json, signature_verified,
        manifest_checksum, lifecycle_state, review_required, sbom_verified, sandbox_cert_verified,
        egress_policy_compliant, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(package_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        extension_id = excluded.extension_id,
        package_type = excluded.package_type,
        display_name = excluded.display_name,
        version = excluded.version,
        owner = excluded.owner,
        trust_level = excluded.trust_level,
        source_uri = excluded.source_uri,
        capabilities_json = excluded.capabilities_json,
        permissions_json = excluded.permissions_json,
        compatibility_json = excluded.compatibility_json,
        signature_verified = excluded.signature_verified,
        manifest_checksum = excluded.manifest_checksum,
        lifecycle_state = excluded.lifecycle_state,
        review_required = excluded.review_required,
        sbom_verified = excluded.sbom_verified,
        sandbox_cert_verified = excluded.sandbox_cert_verified,
        egress_policy_compliant = excluded.egress_policy_compliant,
        updated_at = excluded.updated_at`,
      record.packageId,
      record.tenantId,
      record.extensionId,
      record.packageType,
      record.displayName,
      record.version,
      record.owner,
      record.trustLevel,
      record.sourceUri,
      record.capabilitiesJson,
      record.permissionsJson,
      record.compatibilityJson,
      record.signatureVerified,
      record.manifestChecksum,
      record.lifecycleState,
      record.reviewRequired,
      record.sbomVerified,
      record.sandboxCertVerified,
      record.egressPolicyCompliant,
      record.createdAt,
      record.updatedAt,
    );
  }

  public getExtensionPackage(packageId: string, tenantId?: string | null): ExtensionPackageRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         package_id AS packageId,
         tenant_id AS tenantId,
         extension_id AS extensionId,
         package_type AS packageType,
         display_name AS displayName,
         version,
         owner,
         trust_level AS trustLevel,
         source_uri AS sourceUri,
         capabilities_json AS capabilitiesJson,
         permissions_json AS permissionsJson,
         compatibility_json AS compatibilityJson,
         signature_verified AS signatureVerified,
         manifest_checksum AS manifestChecksum,
         lifecycle_state AS lifecycleState,
         review_required AS reviewRequired,
         sbom_verified AS sbomVerified,
         sandbox_cert_verified AS sandboxCertVerified,
         egress_policy_compliant AS egressPolicyCompliant,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM extension_packages
       WHERE package_id = ?`;
    if (scopedTenantId === undefined) {
      return queryOne<ExtensionPackageRecord>(this.db.connection, `${sql} LIMIT 1`, packageId) ?? null;
    }
    return queryOne<ExtensionPackageRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ? LIMIT 1`,
      packageId,
      scopedTenantId,
    ) ?? null;
  }

  public listExtensionPackages(limit = 100, tenantId?: string | null): ExtensionPackageRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         package_id AS packageId,
         tenant_id AS tenantId,
         extension_id AS extensionId,
         package_type AS packageType,
         display_name AS displayName,
         version,
         owner,
         trust_level AS trustLevel,
         source_uri AS sourceUri,
         capabilities_json AS capabilitiesJson,
         permissions_json AS permissionsJson,
         compatibility_json AS compatibilityJson,
         signature_verified AS signatureVerified,
         manifest_checksum AS manifestChecksum,
         lifecycle_state AS lifecycleState,
         review_required AS reviewRequired,
         sbom_verified AS sbomVerified,
         sandbox_cert_verified AS sandboxCertVerified,
         egress_policy_compliant AS egressPolicyCompliant,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM extension_packages`;
    if (scopedTenantId === undefined) {
      return queryAll<ExtensionPackageRecord>(
        this.db.connection,
        `${sql} ORDER BY updated_at DESC, package_id DESC LIMIT ?`,
        safeLimit,
      );
    }
    return queryAll<ExtensionPackageRecord>(
      this.db.connection,
      `${sql} WHERE tenant_id IS ? ORDER BY updated_at DESC, package_id DESC LIMIT ?`,
      scopedTenantId,
      safeLimit,
    );
  }

  public getMarketplaceReview(reviewId: string, tenantId?: string | null): MarketplaceReviewRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         review_id AS reviewId,
         tenant_id AS tenantId,
         package_id AS packageId,
         status,
         submitter,
         reviewer,
         decision_reason_code AS decisionReasonCode,
         findings_json AS findingsJson,
         permission_surface_hash AS permissionSurfaceHash,
         submitted_at AS submittedAt,
         decided_at AS decidedAt
       FROM marketplace_reviews
       WHERE review_id = ?`;
    if (scopedTenantId === undefined) {
      return queryOne<MarketplaceReviewRecord>(this.db.connection, `${sql} LIMIT 1`, reviewId) ?? null;
    }
    return queryOne<MarketplaceReviewRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ? LIMIT 1`,
      reviewId,
      scopedTenantId,
    ) ?? null;
  }

  public listMarketplaceReviews(limit = 100, tenantId?: string | null): MarketplaceReviewRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         review_id AS reviewId,
         tenant_id AS tenantId,
         package_id AS packageId,
         status,
         submitter,
         reviewer,
         decision_reason_code AS decisionReasonCode,
         findings_json AS findingsJson,
         permission_surface_hash AS permissionSurfaceHash,
         submitted_at AS submittedAt,
         decided_at AS decidedAt
       FROM marketplace_reviews`;
    if (scopedTenantId === undefined) {
      return queryAll<MarketplaceReviewRecord>(
        this.db.connection,
        `${sql} ORDER BY submitted_at DESC, review_id DESC LIMIT ?`,
        safeLimit,
      );
    }
    return queryAll<MarketplaceReviewRecord>(
      this.db.connection,
      `${sql} WHERE tenant_id IS ? ORDER BY submitted_at DESC, review_id DESC LIMIT ?`,
      scopedTenantId,
      safeLimit,
    );
  }

  public getLatestMarketplaceReviewForPackage(packageId: string, tenantId?: string | null): MarketplaceReviewRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         review_id AS reviewId,
         tenant_id AS tenantId,
         package_id AS packageId,
         status,
         submitter,
         reviewer,
         decision_reason_code AS decisionReasonCode,
         findings_json AS findingsJson,
         permission_surface_hash AS permissionSurfaceHash,
         submitted_at AS submittedAt,
         decided_at AS decidedAt
       FROM marketplace_reviews
       WHERE package_id = ?`;
    if (scopedTenantId === undefined) {
      return queryOne<MarketplaceReviewRecord>(
        this.db.connection,
        `${sql} ORDER BY submitted_at DESC, review_id DESC LIMIT 1`,
        packageId,
      ) ?? null;
    }
    return queryOne<MarketplaceReviewRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ? ORDER BY submitted_at DESC, review_id DESC LIMIT 1`,
      packageId,
      scopedTenantId,
    ) ?? null;
  }

  public getMarketplacePublication(publicationId: string, tenantId?: string | null): MarketplacePublicationRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         publication_id AS publicationId,
         tenant_id AS tenantId,
         package_id AS packageId,
         review_id AS reviewId,
         channel,
         status,
         compatibility_matrix_json AS compatibilityMatrixJson,
         revocation_reason_code AS revocationReasonCode,
         published_at AS publishedAt,
         updated_at AS updatedAt
       FROM marketplace_publications
       WHERE publication_id = ?`;
    if (scopedTenantId === undefined) {
      return queryOne<MarketplacePublicationRecord>(this.db.connection, `${sql} LIMIT 1`, publicationId) ?? null;
    }
    return queryOne<MarketplacePublicationRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ? LIMIT 1`,
      publicationId,
      scopedTenantId,
    ) ?? null;
  }

  public getActiveMarketplacePublicationForPackage(
    packageId: string,
    tenantId?: string | null,
  ): MarketplacePublicationRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         publication_id AS publicationId,
         tenant_id AS tenantId,
         package_id AS packageId,
         review_id AS reviewId,
         channel,
         status,
         compatibility_matrix_json AS compatibilityMatrixJson,
         revocation_reason_code AS revocationReasonCode,
         published_at AS publishedAt,
         updated_at AS updatedAt
       FROM marketplace_publications
       WHERE package_id = ? AND status = 'published'`;
    if (scopedTenantId === undefined) {
      return queryOne<MarketplacePublicationRecord>(
        this.db.connection,
        `${sql} ORDER BY updated_at DESC, publication_id DESC LIMIT 1`,
        packageId,
      ) ?? null;
    }
    return queryOne<MarketplacePublicationRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ? ORDER BY updated_at DESC, publication_id DESC LIMIT 1`,
      packageId,
      scopedTenantId,
    ) ?? null;
  }

  public listMarketplacePublications(limit = 100, tenantId?: string | null): MarketplacePublicationRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         publication_id AS publicationId,
         tenant_id AS tenantId,
         package_id AS packageId,
         review_id AS reviewId,
         channel,
         status,
         compatibility_matrix_json AS compatibilityMatrixJson,
         revocation_reason_code AS revocationReasonCode,
         published_at AS publishedAt,
         updated_at AS updatedAt
       FROM marketplace_publications`;
    if (scopedTenantId === undefined) {
      return queryAll<MarketplacePublicationRecord>(
        this.db.connection,
        `${sql} ORDER BY updated_at DESC, publication_id DESC LIMIT ?`,
        safeLimit,
      );
    }
    return queryAll<MarketplacePublicationRecord>(
      this.db.connection,
      `${sql} WHERE tenant_id IS ? ORDER BY updated_at DESC, publication_id DESC LIMIT ?`,
      scopedTenantId,
      safeLimit,
    );
  }

  public listMarketplaceGovernanceReports(limit = 20, tenantId?: string | null): MarketplaceGovernanceReportRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         report_id AS reportId,
         tenant_id AS tenantId,
         summary_json AS summaryJson,
         report_json AS reportJson,
         generated_at AS generatedAt
       FROM marketplace_governance_reports`;
    if (scopedTenantId === undefined) {
      return queryAll<MarketplaceGovernanceReportRecord>(
        this.db.connection,
        `${sql} ORDER BY generated_at DESC LIMIT ?`,
        safeLimit,
      );
    }
    return queryAll<MarketplaceGovernanceReportRecord>(
      this.db.connection,
      `${sql} WHERE tenant_id IS ? ORDER BY generated_at DESC LIMIT ?`,
      scopedTenantId,
      safeLimit,
    );
  }
}
