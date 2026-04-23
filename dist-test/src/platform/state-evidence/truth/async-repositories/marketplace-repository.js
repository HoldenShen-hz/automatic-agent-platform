/**
 * AsyncMarketplaceRepository - Async data access for marketplace reviews, publications, and extension packages.
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
export class AsyncMarketplaceRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async upsertMarketplaceReview(record) {
        await asyncExecute(this.conn, `INSERT INTO marketplace_reviews (
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
        decided_at = excluded.decided_at`, record.reviewId, record.tenantId, record.packageId, record.status, record.submitter, record.reviewer, record.decisionReasonCode, record.findingsJson, record.permissionSurfaceHash, record.submittedAt, record.decidedAt);
    }
    async upsertMarketplacePublication(record) {
        await asyncExecute(this.conn, `INSERT INTO marketplace_publications (
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
        updated_at = excluded.updated_at`, record.publicationId, record.tenantId, record.packageId, record.reviewId, record.channel, record.status, record.compatibilityMatrixJson, record.revocationReasonCode, record.publishedAt, record.updatedAt);
    }
    async insertMarketplaceGovernanceReport(record) {
        await asyncExecute(this.conn, `INSERT INTO marketplace_governance_reports (
        report_id, tenant_id, summary_json, report_json, generated_at
      ) VALUES ($1, $2, $3, $4, $5)`, record.reportId, record.tenantId, record.summaryJson, record.reportJson, record.generatedAt);
    }
    async upsertExtensionPackage(record) {
        await asyncExecute(this.conn, `INSERT INTO extension_packages (
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
        updated_at = excluded.updated_at`, record.packageId, record.tenantId, record.extensionId, record.packageType, record.displayName, record.version, record.owner, record.trustLevel, record.sourceUri, record.capabilitiesJson, record.permissionsJson, record.compatibilityJson, record.signatureVerified, record.manifestChecksum, record.lifecycleState, record.reviewRequired, record.createdAt, record.updatedAt);
    }
    async getExtensionPackage(packageId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
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
       WHERE package_id = $1`;
        if (scopedTenantId === undefined) {
            const result = await asyncQueryOne(this.conn, `${sql} LIMIT 1`, packageId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `${sql} AND tenant_id IS $2 LIMIT 1`, packageId, scopedTenantId);
        return result ?? null;
    }
    async listExtensionPackages(limit = 100, tenantId) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
        const scopedTenantId = resolveTenantScope(tenantId);
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
       FROM extension_packages`;
        if (scopedTenantId === undefined) {
            return asyncQueryAll(this.conn, `${sql} ORDER BY updated_at DESC, package_id DESC LIMIT $1`, safeLimit);
        }
        return asyncQueryAll(this.conn, `${sql} WHERE tenant_id IS $1 ORDER BY updated_at DESC, package_id DESC LIMIT $2`, scopedTenantId, safeLimit);
    }
    async getMarketplaceReview(reviewId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
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
       WHERE review_id = $1`;
        if (scopedTenantId === undefined) {
            const result = await asyncQueryOne(this.conn, `${sql} LIMIT 1`, reviewId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `${sql} AND tenant_id IS $2 LIMIT 1`, reviewId, scopedTenantId);
        return result ?? null;
    }
    async listMarketplaceReviews(limit = 100, tenantId) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
        const scopedTenantId = resolveTenantScope(tenantId);
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
       FROM marketplace_reviews`;
        if (scopedTenantId === undefined) {
            return asyncQueryAll(this.conn, `${sql} ORDER BY submitted_at DESC, review_id DESC LIMIT $1`, safeLimit);
        }
        return asyncQueryAll(this.conn, `${sql} WHERE tenant_id IS $1 ORDER BY submitted_at DESC, review_id DESC LIMIT $2`, scopedTenantId, safeLimit);
    }
    async getLatestMarketplaceReviewForPackage(packageId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
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
       WHERE package_id = $1`;
        if (scopedTenantId === undefined) {
            const result = await asyncQueryOne(this.conn, `${sql} ORDER BY submitted_at DESC, review_id DESC LIMIT 1`, packageId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `${sql} AND tenant_id IS $2 ORDER BY submitted_at DESC, review_id DESC LIMIT 1`, packageId, scopedTenantId);
        return result ?? null;
    }
    async getMarketplacePublication(publicationId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
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
       WHERE publication_id = $1`;
        if (scopedTenantId === undefined) {
            const result = await asyncQueryOne(this.conn, `${sql} LIMIT 1`, publicationId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `${sql} AND tenant_id IS $2 LIMIT 1`, publicationId, scopedTenantId);
        return result ?? null;
    }
    async getActiveMarketplacePublicationForPackage(packageId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
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
       WHERE package_id = $1 AND status = 'published'`;
        if (scopedTenantId === undefined) {
            const result = await asyncQueryOne(this.conn, `${sql} ORDER BY updated_at DESC, publication_id DESC LIMIT 1`, packageId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `${sql} AND tenant_id IS $2 ORDER BY updated_at DESC, publication_id DESC LIMIT 1`, packageId, scopedTenantId);
        return result ?? null;
    }
    async listMarketplacePublications(limit = 100, tenantId) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
        const scopedTenantId = resolveTenantScope(tenantId);
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
       FROM marketplace_publications`;
        if (scopedTenantId === undefined) {
            return asyncQueryAll(this.conn, `${sql} ORDER BY updated_at DESC, publication_id DESC LIMIT $1`, safeLimit);
        }
        return asyncQueryAll(this.conn, `${sql} WHERE tenant_id IS $1 ORDER BY updated_at DESC, publication_id DESC LIMIT $2`, scopedTenantId, safeLimit);
    }
    async listMarketplaceGovernanceReports(limit = 20, tenantId) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
        const scopedTenantId = resolveTenantScope(tenantId);
        const sql = `SELECT
         report_id AS "reportId",
         tenant_id AS "tenantId",
         summary_json AS "summaryJson",
         report_json AS "reportJson",
         generated_at AS "generatedAt"
       FROM marketplace_governance_reports`;
        if (scopedTenantId === undefined) {
            return asyncQueryAll(this.conn, `${sql} ORDER BY generated_at DESC LIMIT $1`, safeLimit);
        }
        return asyncQueryAll(this.conn, `${sql} WHERE tenant_id IS $1 ORDER BY generated_at DESC LIMIT $2`, scopedTenantId, safeLimit);
    }
}
//# sourceMappingURL=marketplace-repository.js.map