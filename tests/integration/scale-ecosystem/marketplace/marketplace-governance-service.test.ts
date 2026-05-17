/**
 * Integration tests for MarketplaceGovernanceService
 *
 * Tests the marketplace listing and governance catalog functionality including:
 * - Package registration and lifecycle management
 * - Review submission and decision workflows
 * - Publication and revocation handling
 * - Catalog building and artifact export
 *
 * @see src/scale-ecosystem/marketplace/marketplace-governance-service.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { MarketplaceGovernanceService } from "../../../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("marketplace governance buildCatalog returns correct summary statistics", () => {
  const workspace = createTempWorkspace("aa-marketplace-catalog-");
  const dbPath = join(workspace, "marketplace-catalog.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store, {
      artifactStoreOptions: { rootDir: artifactRoot },
    });

    // Register and publish a ready package
    const pkg1 = service.registerExtensionPackage({
      extensionId: "plugin.ready-plugin",
      packageType: "plugin",
      displayName: "Ready Plugin",
      version: "1.0.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/ready-plugin",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "a".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    const review1 = service.submitReview({
      packageId: pkg1.packageId,
      submitter: "ecosystem.submitter",
    });
    service.decideReview({
      reviewId: review1.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved_for_publish",
    });
    service.publishPackage({
      packageId: pkg1.packageId,
      reviewId: review1.reviewId,
    });

    // Register a package pending review
    const pkg2 = service.registerExtensionPackage({
      extensionId: "plugin.pending-plugin",
      packageType: "plugin",
      displayName: "Pending Plugin",
      version: "1.0.0",
      owner: "community.owner",
      trustLevel: "community",
      sourceUri: "registry://plugins/pending-plugin",
      capabilities: ["custom_tool"],
      permissions: ["read.workspace"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "b".repeat(64),
    });
    service.submitReview({
      packageId: pkg2.packageId,
      submitter: "community.owner",
    });

    // Build catalog and verify summary
    const result = service.buildCatalog();
    assert.equal(result.report.summary.total, 2);
    assert.equal(result.report.summary.packagesReady, 1);
    assert.equal(result.report.summary.reviewPending, 1);
    assert.equal(result.report.summary.overallVerdict, "partial");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance exportCatalog persists JSON and Markdown artifacts", () => {
  const workspace = createTempWorkspace("aa-marketplace-export-");
  const dbPath = join(workspace, "marketplace-export.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store, {
      artifactStoreOptions: { rootDir: artifactRoot },
    });

    // Register a published package
    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.export-test",
      packageType: "plugin",
      displayName: "Export Test Plugin",
      version: "2.0.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/export-test",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "c".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "ecosystem.submitter",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved",
    });
    service.publishPackage({
      packageId: pkg.packageId,
      reviewId: review.reviewId,
    });

    // Export catalog
    const exported = service.exportCatalog();

    // Verify artifacts exist
    assert.ok(existsSync(exported.jsonArtifact.uri));
    assert.ok(existsSync(exported.markdownArtifact.uri));

    // Verify JSON content
    const jsonContent = readFileSync(exported.jsonArtifact.uri, "utf8");
    assert.match(jsonContent, /"extensionId": "plugin.export-test"/);
    assert.match(jsonContent, /"overallVerdict": "ready"/);

    // Verify Markdown content
    const mdContent = readFileSync(exported.markdownArtifact.uri, "utf8");
    assert.match(mdContent, /# Marketplace Governance Report/);
    assert.match(mdContent, /plugin.export-test/);

    // Verify governance report record was persisted
    const reports = service.listReports();
    assert.equal(reports.length, 1);
    assert.equal(reports[0]!.tenantId, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance revokePublication updates catalog status", () => {
  const workspace = createTempWorkspace("aa-marketplace-revoke-");
  const dbPath = join(workspace, "marketplace-revoke.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Register and publish a package
    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.revokable",
      packageType: "plugin",
      displayName: "Revokable Plugin",
      version: "1.0.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/revokable",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "d".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "ecosystem.submitter",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved",
    });
    const publication = service.publishPackage({
      packageId: pkg.packageId,
      reviewId: review.reviewId,
    });

    // Verify it's published
    let catalog = service.buildCatalog();
    assert.equal(catalog.report.summary.packagesReady, 1);

    // Revoke the publication
    const revoked = service.revokePublication({
      publicationId: publication.publicationId,
      reasonCode: "security_concern",
    });
    assert.equal(revoked.status, "revoked");

    // Verify catalog updated
    catalog = service.buildCatalog();
    assert.equal(catalog.report.summary.packagesReady, 0);
    assert.equal(catalog.report.summary.revoked, 1);
    assert.equal(catalog.report.entries[0]!.publicationStatus, "revoked");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance deprecatePackage marks publication as deprecated", () => {
  const workspace = createTempWorkspace("aa-marketplace-deprecate-");
  const dbPath = join(workspace, "marketplace-deprecate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Register and publish a package
    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.deprecated",
      packageType: "plugin",
      displayName: "Deprecated Plugin",
      version: "1.0.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/deprecated",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "e".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "ecosystem.submitter",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved",
    });
    service.publishPackage({
      packageId: pkg.packageId,
      reviewId: review.reviewId,
    });

    // Deprecate the package
    const deprecated = service.deprecatePackage({
      packageId: pkg.packageId,
      reasonCode: "superseded_by_v2",
    });
    assert.equal(deprecated.lifecycleState, "deprecated");

    // Verify catalog shows deprecated status
    const catalog = service.buildCatalog();
    assert.equal(catalog.report.entries[0]!.lifecycleState, "deprecated");
    assert.equal(catalog.report.entries[0]!.publicationStatus, "deprecated");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance retirePackage marks package as retired", () => {
  const workspace = createTempWorkspace("aa-marketplace-retire-");
  const dbPath = join(workspace, "marketplace-retire.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Register and publish a package
    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.retired",
      packageType: "plugin",
      displayName: "Retired Plugin",
      version: "1.0.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/retired",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "f".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "ecosystem.submitter",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved",
    });
    service.publishPackage({
      packageId: pkg.packageId,
      reviewId: review.reviewId,
    });

    service.deprecatePackage({
      packageId: pkg.packageId,
      reasonCode: "superseded_by_v2",
    });
    service.sunsetPackage({
      packageId: pkg.packageId,
      reasonCode: "end_of_life",
      sunsetAt: "2025-01-01T00:00:00.000Z",
      endOfLifeAt: "2025-07-01T00:00:00.000Z",
      migrationTarget: "plugin.retired.v2",
      replacementSuggestions: ["plugin.retired.v2"],
    });

    // Retire the package after the required sunset window and migration threshold
    const retired = service.retirePackage({
      packageId: pkg.packageId,
      reasonCode: "end_of_life",
      retiredAt: "2025-07-02T00:00:00.000Z",
      migrationCompletionRatio: 0.97,
    });
    assert.equal(retired.lifecycleState, "retired");

    // Verify catalog shows retired status
    const catalog = service.buildCatalog();
    assert.equal(catalog.report.entries[0]!.lifecycleState, "retired");
    assert.equal(catalog.report.entries[0]!.publicationStatus, "retired");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance catalog filters by tenant correctly", () => {
  const workspace = createTempWorkspace("aa-marketplace-tenant-filter-");
  const dbPath = join(workspace, "marketplace-tenant-filter.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Register packages for two tenants
    const pkgA = service.registerExtensionPackage({
      tenantId: "tenant-a",
      extensionId: "plugin.tenant-a-plugin",
      packageType: "plugin",
      displayName: "Tenant A Plugin",
      version: "1.0.0",
      owner: "tenant.a.owner",
      trustLevel: "verified",
      sourceUri: "registry://plugins/tenant-a-plugin",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "a".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    const pkgB = service.registerExtensionPackage({
      tenantId: "tenant-b",
      extensionId: "plugin.tenant-b-plugin",
      packageType: "plugin",
      displayName: "Tenant B Plugin",
      version: "1.0.0",
      owner: "tenant.b.owner",
      trustLevel: "verified",
      sourceUri: "registry://plugins/tenant-b-plugin",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "b".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
    });

    // Publish both
    const reviewA = service.submitReview({
      tenantId: "tenant-a",
      packageId: pkgA.packageId,
      submitter: "tenant.a.submitter",
    });
    service.decideReview({
      tenantId: "tenant-a",
      reviewId: reviewA.reviewId,
      status: "approved",
      reviewer: "tenant.a.reviewer",
      decisionReasonCode: "approved",
    });
    service.publishPackage({
      tenantId: "tenant-a",
      packageId: pkgA.packageId,
      reviewId: reviewA.reviewId,
    });

    const reviewB = service.submitReview({
      tenantId: "tenant-b",
      packageId: pkgB.packageId,
      submitter: "tenant.b.submitter",
    });
    service.decideReview({
      tenantId: "tenant-b",
      reviewId: reviewB.reviewId,
      status: "approved",
      reviewer: "tenant.b.reviewer",
      decisionReasonCode: "approved",
    });
    service.publishPackage({
      tenantId: "tenant-b",
      packageId: pkgB.packageId,
      reviewId: reviewB.reviewId,
    });

    // Build catalog for each tenant
    const catalogA = service.buildCatalog("2026-04-15T00:00:00.000Z", "tenant-a");
    const catalogB = service.buildCatalog("2026-04-15T00:00:00.000Z", "tenant-b");

    // Verify each catalog only contains its tenant's packages
    assert.equal(catalogA.report.entries.length, 1);
    assert.equal(catalogA.report.entries[0]!.tenantId, "tenant-a");
    assert.equal(catalogA.report.entries[0]!.extensionId, "plugin.tenant-a-plugin");

    assert.equal(catalogB.report.entries.length, 1);
    assert.equal(catalogB.report.entries[0]!.tenantId, "tenant-b");
    assert.equal(catalogB.report.entries[0]!.extensionId, "plugin.tenant-b-plugin");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
