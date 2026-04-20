/**
 * Marketplace Governance CLI
 *
 * This module provides a command-line interface for managing extension packages
 * in the marketplace. It supports package registration, review workflows,
 * publication management, and catalog browsing for marketplace operators.
 *
 * Environment Variables (via loadMarketplaceCliEnv):
 *   - AA_DB_PATH: Path to the SQLite database
 *   - AA_MARKETPLACE_ACTION: Action to perform
 *   - AA_MARKETPLACE_ARTIFACT_ROOT: Optional artifact root directory
 *   - AA_MARKETPLACE_TENANT_ID: Tenant identifier
 *
 * Actions:
 *   - register_package: Register a new extension package in the marketplace
 *   - submit_review: Submit a package for review
 *   - decide_review: Approve or reject a package review
 *   - publish: Publish an approved package
 *   - revoke: Revoke a published package
 *   - summary: Build marketplace catalog summary
 *   - export: Export marketplace catalog with evidence
 *   - list_packages: List registered packages
 *   - list_reviews: List package reviews
 *   - list_publications: List package publications
 *   - list_reports: List generated reports
 *
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for marketplace architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for marketplace terminology
 */

import { dirname } from "node:path";

import { withCliStorage } from "./authoritative-storage.js";
import { loadMarketplaceCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { MarketplaceGovernanceService } from "../../scale-ecosystem/marketplace/marketplace-governance-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

const envConfig = loadMarketplaceCliEnv();
const result = withCliStorage((storage) => {
  const service = envConfig.artifactRoot == null || envConfig.artifactRoot.length === 0
    ? new MarketplaceGovernanceService(storage.sql, storage.store)
    : new MarketplaceGovernanceService(storage.sql, storage.store, {
      artifactStoreOptions: {
        rootDir: envConfig.artifactRoot,
        sandboxPolicy: createWorkspaceWritePolicy(dirname(envConfig.artifactRoot)),
      },
    });

  switch (envConfig.action) {
    case "register_package":
      return service.registerExtensionPackage({
        ...(envConfig.packageId ? { packageId: envConfig.packageId } : {}),
        tenantId: envConfig.tenantId,
        extensionId: envConfig.extensionId ?? "",
        packageType: envConfig.packageType ?? "tool",
        displayName: envConfig.displayName ?? "",
        version: envConfig.version ?? "",
        owner: envConfig.owner ?? "",
        trustLevel: envConfig.trustLevel ?? "unknown",
        sourceUri: envConfig.sourceUri ?? "",
        capabilities: envConfig.capabilities ?? [],
        permissions: envConfig.permissions ?? [],
        compatibility: envConfig.compatibility ?? {
          apiContract: "",
          permissionSurface: "",
          runtimeCapability: "",
        },
        signatureVerified: envConfig.signatureVerified,
        manifestChecksum: envConfig.manifestChecksum ?? "",
        lifecycleState: envConfig.lifecycleState,
        reviewRequired: envConfig.reviewRequired,
        ...(envConfig.createdAt ? { createdAt: envConfig.createdAt } : {}),
        ...(envConfig.updatedAt ? { updatedAt: envConfig.updatedAt } : {}),
      });
    case "submit_review":
      return service.submitReview({
        ...(envConfig.reviewId ? { reviewId: envConfig.reviewId } : {}),
        tenantId: envConfig.tenantId,
        packageId: envConfig.packageId ?? "",
        submitter: envConfig.submitter ?? "",
        ...(envConfig.findings ? { findings: envConfig.findings } : {}),
        ...(envConfig.submittedAt ? { submittedAt: envConfig.submittedAt } : {}),
      });
    case "decide_review":
      return service.decideReview({
        reviewId: envConfig.reviewId ?? "",
        tenantId: envConfig.tenantId,
        status: envConfig.reviewStatus ?? "approved",
        reviewer: envConfig.reviewer ?? "",
        decisionReasonCode: envConfig.reasonCode ?? "",
        ...(envConfig.findings ? { findings: envConfig.findings } : {}),
        ...(envConfig.decidedAt ? { decidedAt: envConfig.decidedAt } : {}),
      });
    case "publish":
      return service.publishPackage({
        ...(envConfig.publicationId ? { publicationId: envConfig.publicationId } : {}),
        tenantId: envConfig.tenantId,
        packageId: envConfig.packageId ?? "",
        ...(envConfig.reviewId ? { reviewId: envConfig.reviewId } : {}),
        ...(envConfig.channel ? { channel: envConfig.channel } : {}),
        ...(envConfig.publishedAt ? { publishedAt: envConfig.publishedAt } : {}),
      });
    case "revoke":
      return service.revokePublication({
        publicationId: envConfig.publicationId ?? "",
        tenantId: envConfig.tenantId,
        reasonCode: envConfig.reasonCode ?? "",
        ...(envConfig.revokedAt ? { revokedAt: envConfig.revokedAt } : {}),
      });
    case "summary":
      return service.buildCatalog(envConfig.generatedAt ?? undefined, envConfig.tenantId);
    case "export":
      return service.exportCatalog(envConfig.generatedAt ?? undefined, envConfig.tenantId);
    case "list_packages":
      return service.listPackages(envConfig.limit ?? 100, envConfig.tenantId);
    case "list_reviews":
      return service.listReviews(envConfig.limit ?? 100, envConfig.tenantId);
    case "list_publications":
      return service.listPublications(envConfig.limit ?? 100, envConfig.tenantId);
    case "list_reports":
      return service.listReports(envConfig.limit ?? 20, envConfig.tenantId);
    default:
      throw new ValidationError(`unknown_marketplace_action:${envConfig.action}`, `unknown_marketplace_action:${envConfig.action}`);
  }
}, { dbPath: envConfig.dbPath });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
