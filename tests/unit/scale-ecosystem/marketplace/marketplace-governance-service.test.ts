import assert from "node:assert/strict";
import test from "node:test";

import { MarketplaceGovernanceService } from "../../../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("marketplace governance service can register, review, publish, and summarize a signed package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.release-audit",
      packageType: "plugin",
      displayName: "Release Audit Plugin",
      version: "1.2.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/release-audit",
      capabilities: ["audit_export", "incident_console"],
      permissions: ["read.audit", "write.report"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: "a".repeat(64),
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "ecosystem.submitter",
      findings: ["static_checks_passed"],
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved_for_publish",
      findings: ["permission_surface_ok", "signature_verified"],
    });
    const publication = service.publishPackage({
      packageId: pkg.packageId,
      reviewId: review.reviewId,
      channel: "marketplace_public",
    });

    assert.equal(publication.status, "published");

    const summary = service.buildCatalog();
    assert.equal(summary.report.summary.overallVerdict, "ready");
    assert.equal(summary.report.summary.packagesReady, 1);
    assert.equal(summary.report.entries[0]?.publicationStatus, "published");
    assert.deepEqual(service.listPackages(10).map((entry) => entry.packageId), [pkg.packageId]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance service blocks publishing packages with rejected or missing review state", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.untrusted-tool",
      packageType: "plugin",
      displayName: "Untrusted Plugin",
      version: "0.1.0",
      owner: "community.owner",
      trustLevel: "community",
      sourceUri: "registry://plugins/untrusted-tool",
      capabilities: ["custom_tool"],
      permissions: ["write.workspace"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: "b".repeat(64),
    });

    assert.throws(
      () => service.publishPackage({ packageId: pkg.packageId }),
      /marketplace\.review_required/,
    );

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "community.owner",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "rejected",
      reviewer: "review.board",
      decisionReasonCode: "permission_surface_too_broad",
    });

    assert.throws(
      () => service.publishPackage({ packageId: pkg.packageId, reviewId: review.reviewId }),
      /marketplace\.review_not_approved/,
    );

    const summary = service.buildCatalog();
    assert.equal(summary.report.summary.overallVerdict, "blocked");
    assert.equal(summary.report.summary.blocked, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance service fail-closes malformed identifiers and checksums", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.registerExtensionPackage({
          extensionId: "../plugin.escape",
          packageType: "plugin",
          displayName: "Bad Plugin",
          version: "1.0.0",
          owner: "owner",
          trustLevel: "internal",
          sourceUri: "registry://plugins/bad",
          capabilities: ["custom_tool"],
          permissions: ["read.audit"],
          compatibility: {
            apiContract: "^1.0.0",
            permissionSurface: "^1.0.0",
            runtimeCapability: "^1.0.0",
          },
          signatureVerified: true,
          sbomVerified: true,
          sandboxCertVerified: true,
          egressPolicyCompliant: true,
          manifestChecksum: "zz",
        }),
      /marketplace\.invalid_extension_id|marketplace\.invalid_manifest_checksum/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance service scopes duplicate extension versions across tenants", () => {
  const workspace = createTempWorkspace("aa-marketplace-tenant-");
  const dbPath = `${workspace}/marketplace-tenant.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const tenantAPackage = service.registerExtensionPackage({
      tenantId: "tenant-a",
      extensionId: "plugin.shared-catalog",
      packageType: "plugin",
      displayName: "Shared Catalog Plugin",
      version: "2.0.0",
      owner: "tenant.a.owner",
      trustLevel: "verified",
      sourceUri: "registry://plugins/shared-catalog",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: "c".repeat(64),
    });
    const tenantBPackage = service.registerExtensionPackage({
      tenantId: "tenant-b",
      extensionId: "plugin.shared-catalog",
      packageType: "plugin",
      displayName: "Shared Catalog Plugin",
      version: "2.0.0",
      owner: "tenant.b.owner",
      trustLevel: "verified",
      sourceUri: "registry://plugins/shared-catalog",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: "d".repeat(64),
    });

    const reviewA = service.submitReview({
      tenantId: "tenant-a",
      packageId: tenantAPackage.packageId,
      submitter: "tenant.a.submitter",
    });
    service.decideReview({
      tenantId: "tenant-a",
      reviewId: reviewA.reviewId,
      status: "approved",
      reviewer: "tenant.a.reviewer",
      decisionReasonCode: "approved",
    });
    const publicationA = service.publishPackage({
      tenantId: "tenant-a",
      packageId: tenantAPackage.packageId,
      reviewId: reviewA.reviewId,
    });

    const reviewB = service.submitReview({
      tenantId: "tenant-b",
      packageId: tenantBPackage.packageId,
      submitter: "tenant.b.submitter",
    });
    service.decideReview({
      tenantId: "tenant-b",
      reviewId: reviewB.reviewId,
      status: "approved",
      reviewer: "tenant.b.reviewer",
      decisionReasonCode: "approved",
    });
    const publicationB = service.publishPackage({
      tenantId: "tenant-b",
      packageId: tenantBPackage.packageId,
      reviewId: reviewB.reviewId,
    });

    assert.deepEqual(service.listPackages(10, "tenant-a").map((entry) => entry.packageId), [tenantAPackage.packageId]);
    assert.deepEqual(service.listPackages(10, "tenant-b").map((entry) => entry.packageId), [tenantBPackage.packageId]);
    assert.deepEqual(service.listReviews(10, "tenant-a").map((entry) => entry.reviewId), [reviewA.reviewId]);
    assert.deepEqual(service.listPublications(10, "tenant-b").map((entry) => entry.publicationId), [publicationB.publicationId]);

    const catalogA = service.buildCatalog("2026-04-08T12:00:00.000Z", "tenant-a");
    const catalogB = service.buildCatalog("2026-04-08T12:00:00.000Z", "tenant-b");
    assert.deepEqual(catalogA.report.entries.map((entry) => entry.packageId), [tenantAPackage.packageId]);
    assert.deepEqual(catalogB.report.entries.map((entry) => entry.packageId), [tenantBPackage.packageId]);
    assert.equal(service.listReports(10, "tenant-a")[0]?.tenantId, "tenant-a");
    assert.equal(service.listReports(10, "tenant-b")[0]?.tenantId, "tenant-b");

    assert.equal(publicationA.status, "published");
    assert.equal(publicationB.status, "published");
    assert.throws(
      () => service.publishPackage({ tenantId: "tenant-b", packageId: tenantAPackage.packageId, reviewId: reviewA.reviewId }),
      /marketplace\.package_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace governance service blocks publish when certification gates are incomplete", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "plugin.missing-gates",
      packageType: "plugin",
      displayName: "Missing Gates Plugin",
      version: "1.0.0",
      owner: "ecosystem.team",
      trustLevel: "verified",
      sourceUri: "registry://plugins/missing-gates",
      capabilities: ["catalog_export"],
      permissions: ["read.catalog"],
      compatibility: {
        apiContract: "^1.0.0",
        permissionSurface: "^1.0.0",
        runtimeCapability: "^1.0.0",
      },
      signatureVerified: true,
      sbomVerified: false,
      sandboxCertVerified: true,
      egressPolicyCompliant: false,
      manifestChecksum: "e".repeat(64),
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "ecosystem.submitter",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "review.board",
      decisionReasonCode: "approved_pending_gates",
    });

    assert.throws(
      () => service.publishPackage({ packageId: pkg.packageId, reviewId: review.reviewId }),
      /marketplace\.certification_gate_failed/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
