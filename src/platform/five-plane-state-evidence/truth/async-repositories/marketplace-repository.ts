/**
 * AsyncMarketplaceRepository - Async data access for marketplace reviews, publications, and extension packages.
 */

import type {
  ExtensionPackageRecord,
  MarketplaceGovernanceReportRecord,
  MarketplacePublicationRecord,
  MarketplaceReviewRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
import { buildTenantClause } from "../async-query-helper.js";

export class AsyncMarketplaceRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async upsertMarketplaceReview(record: MarketplaceReviewRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO marketplace_reviews (
        review_id, tenant_id, package_id, status, submitter, reviewer, decision_reason_code,
        findings_json, permission_surface_hash, submitted_at, decided_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

  public async upsertMarketplacePublication(record: MarketplacePublicationRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO marketplace_publications (
        publication_id, tenant_id, package_id, review_id, channel, status, compatibility_matrix_json,
        revocation_reason_code, published_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

  public async insertMarketplaceGovernanceReport(record: MarketplaceGovernanceReportRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO marketplace_governance_reports (
        report_id, tenant_id, summary_json, report_json, generated_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      record.reportId,
      record.tenantId,
      record.summaryJson,
      record.reportJson,
      record.generatedAt,
    );
  }

  public async upsertExtensionPackage(record: ExtensionPackageRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO extension_packages (
        package_id, tenant_id, extension_id, package_type, display_name, version, owner, trust_level,
        source_uri, capabilities_json, permissions_json, compatibility_json, signature_verified,
        manifest_checksum, lifecycle_state, review_required, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      record.createdAt,
      record.updatedAt,
    );
  }

  public async getExtensionPackage(packageId: string, tenantId?: string | null): Promise<ExtensionPackageRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         package_id AS "packageId",
         tenant_id AS "tenantId",
         extension_id AS "extensionId",
         package_type AS "packageType",
         display_name AS "displayName",
         version,
         owner,
         trust_level AS "trustLevel",
         source_uri AS "sourceUri",
         capabilities_json AS "capabilitiesJson",
         permissions_json AS "permissionsJson",
         compatibility_json AS "compatibilityJson",
         signature_verified AS "signatureVerified",
         manifest_checksum AS "manifestChecksum",
         lifecycle_state AS "lifecycleState",
         review_required AS "reviewRequired",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM extension_packages
       WHERE package_id = $1${tenantClause ? ` AND ${tenantClause}` : ""}
       LIMIT 1`;
    const result = await asyncQueryOne<ExtensionPackageRecord>(
      this.conn,
      sql,
      packageId,
      ...tenantArgs,
    );
    return result ?? null;
  }

  public async listExtensionPackages(limit = 100, tenantId?: string | null): Promise<ExtensionPackageRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         package_id AS "packageId",
         tenant_id AS "tenantId",
         extension_id AS "extensionId",
         package_type AS "packageType",
         display_name AS "displayName",
         version,
         owner,
         trust_level AS "trustLevel",
         source_uri AS "sourceUri",
         capabilities_json AS "capabilitiesJson",
         permissions_json AS "permissionsJson",
         compatibility_json AS "compatibilityJson",
         signature_verified AS "signatureVerified",
         manifest_checksum AS "manifestChecksum",
         lifecycle_state AS "lifecycleState",
         review_required AS "reviewRequired",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM extension_packages${tenantClause ? ` WHERE ${tenantClause}` : ""}
       ORDER BY updated_at DESC, package_id DESC LIMIT $${tenantArgs.length + 1}`;
    return asyncQueryAll<ExtensionPackageRecord>(
      this.conn,
      sql,
      ...tenantArgs,
      safeLimit,
    );
  }

  public async getMarketplaceReview(reviewId: string, tenantId?: string | null): Promise<MarketplaceReviewRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         review_id AS "reviewId",
         tenant_id AS "tenantId",
         package_id AS "packageId",
         status,
         submitter,
         reviewer,
         decision_reason_code AS "decisionReasonCode",
         findings_json AS "findingsJson",
         permission_surface_hash AS "permissionSurfaceHash",
         submitted_at AS "submittedAt",
         decided_at AS "decidedAt"
       FROM marketplace_reviews
       WHERE review_id = $1${tenantClause ? ` AND ${tenantClause}` : ""}
       LIMIT 1`;
    const result = await asyncQueryOne<MarketplaceReviewRecord>(
      this.conn,
      sql,
      reviewId,
      ...tenantArgs,
    );
    return result ?? null;
  }

  public async listMarketplaceReviews(limit = 100, tenantId?: string | null): Promise<MarketplaceReviewRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         review_id AS "reviewId",
         tenant_id AS "tenantId",
         package_id AS "packageId",
         status,
         submitter,
         reviewer,
         decision_reason_code AS "decisionReasonCode",
         findings_json AS "findingsJson",
         permission_surface_hash AS "permissionSurfaceHash",
         submitted_at AS "submittedAt",
         decided_at AS "decidedAt"
       FROM marketplace_reviews${tenantClause ? ` WHERE ${tenantClause}` : ""}
       ORDER BY submitted_at DESC, review_id DESC LIMIT $${tenantArgs.length + 1}`;
    return asyncQueryAll<MarketplaceReviewRecord>(
      this.conn,
      sql,
      ...tenantArgs,
      safeLimit,
    );
  }

  public async getLatestMarketplaceReviewForPackage(
    packageId: string,
    tenantId?: string | null,
  ): Promise<MarketplaceReviewRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         review_id AS "reviewId",
         tenant_id AS "tenantId",
         package_id AS "packageId",
         status,
         submitter,
         reviewer,
         decision_reason_code AS "decisionReasonCode",
         findings_json AS "findingsJson",
         permission_surface_hash AS "permissionSurfaceHash",
         submitted_at AS "submittedAt",
         decided_at AS "decidedAt"
       FROM marketplace_reviews
       WHERE package_id = $1${tenantClause ? ` AND ${tenantClause}` : ""}
       ORDER BY submitted_at DESC, review_id DESC LIMIT 1`;
    const result = await asyncQueryOne<MarketplaceReviewRecord>(
      this.conn,
      sql,
      packageId,
      ...tenantArgs,
    );
    return result ?? null;
  }

  public async getMarketplacePublication(
    publicationId: string,
    tenantId?: string | null,
  ): Promise<MarketplacePublicationRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         publication_id AS "publicationId",
         tenant_id AS "tenantId",
         package_id AS "packageId",
         review_id AS "reviewId",
         channel,
         status,
         compatibility_matrix_json AS "compatibilityMatrixJson",
         revocation_reason_code AS "revocationReasonCode",
         published_at AS "publishedAt",
         updated_at AS "updatedAt"
       FROM marketplace_publications
       WHERE publication_id = $1${tenantClause ? ` AND ${tenantClause}` : ""}
       LIMIT 1`;
    const result = await asyncQueryOne<MarketplacePublicationRecord>(
      this.conn,
      sql,
      publicationId,
      ...tenantArgs,
    );
    return result ?? null;
  }

  public async getActiveMarketplacePublicationForPackage(
    packageId: string,
    tenantId?: string | null,
  ): Promise<MarketplacePublicationRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         publication_id AS "publicationId",
         tenant_id AS "tenantId",
         package_id AS "packageId",
         review_id AS "reviewId",
         channel,
         status,
         compatibility_matrix_json AS "compatibilityMatrixJson",
         revocation_reason_code AS "revocationReasonCode",
         published_at AS "publishedAt",
         updated_at AS "updatedAt"
       FROM marketplace_publications
       WHERE package_id = $1 AND status = 'published'${tenantClause ? ` AND ${tenantClause}` : ""}
       ORDER BY updated_at DESC, publication_id DESC LIMIT 1`;
    const result = await asyncQueryOne<MarketplacePublicationRecord>(
      this.conn,
      sql,
      packageId,
      ...tenantArgs,
    );
    return result ?? null;
  }

  public async listMarketplacePublications(
    limit = 100,
    tenantId?: string | null,
  ): Promise<MarketplacePublicationRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         publication_id AS "publicationId",
         tenant_id AS "tenantId",
         package_id AS "packageId",
         review_id AS "reviewId",
         channel,
         status,
         compatibility_matrix_json AS "compatibilityMatrixJson",
         revocation_reason_code AS "revocationReasonCode",
         published_at AS "publishedAt",
         updated_at AS "updatedAt"
       FROM marketplace_publications${tenantClause ? ` WHERE ${tenantClause}` : ""}
       ORDER BY updated_at DESC, publication_id DESC LIMIT $${tenantArgs.length + 1}`;
    return asyncQueryAll<MarketplacePublicationRecord>(
      this.conn,
      sql,
      ...tenantArgs,
      safeLimit,
    );
  }

  public async listMarketplaceGovernanceReports(
    limit = 20,
    tenantId?: string | null,
  ): Promise<MarketplaceGovernanceReportRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    const scopedTenantId = resolveTenantScope(tenantId);
    const { clause: tenantClause, args: tenantArgs } = buildTenantClause(scopedTenantId);
    const sql = `SELECT
         report_id AS "reportId",
         tenant_id AS "tenantId",
         summary_json AS "summaryJson",
         report_json AS "reportJson",
         generated_at AS "generatedAt"
       FROM marketplace_governance_reports${tenantClause ? ` WHERE ${tenantClause}` : ""}
       ORDER BY generated_at DESC LIMIT $${tenantArgs.length + 1}`;
    return asyncQueryAll<MarketplaceGovernanceReportRecord>(
      this.conn,
      sql,
      ...tenantArgs,
      safeLimit,
    );
  }
}
