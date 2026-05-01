/**
 * Unit tests for MarketplaceGovernanceService
 *
 * Tests extension package registration, review submission, review decisions,
 * publication lifecycle, and catalog building.
 *
 * @see src/scale-ecosystem/marketplace/marketplace-governance-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MarketplaceGovernanceService } from "../../../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("MarketplaceGovernanceService.registerExtensionPackage creates new package record", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const record = service.registerExtensionPackage({
      extensionId: "my-extension",
      packageType: "tool",
      displayName: "My Extension",
      version: "1.0.0",
      owner: "test-owner",
      trustLevel: "internal",
      sourceUri: "https://example.com/extension",
      capabilities: ["capability-1", "capability-2"],
      permissions: ["permission-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "a".repeat(64),
    });

    assert.ok(record.packageId.startsWith("pkg_"));
    assert.equal(record.extensionId, "my-extension");
    assert.equal(record.packageType, "tool");
    assert.equal(record.displayName, "My Extension");
    assert.equal(record.version, "1.0.0");
    assert.equal(record.lifecycleState, "installed");
    assert.equal(record.reviewRequired, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.registerExtensionPackage rejects invalid display name length", () => {
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
          extensionId: "my-extension",
          packageType: "tool",
          displayName: "A", // Too short (< 2 chars)
          version: "1.0.0",
          owner: "test-owner",
          trustLevel: "internal",
          sourceUri: "https://example.com/extension",
          capabilities: ["capability-1"],
          permissions: ["permission-1"],
          compatibility: {
            apiContract: "1.0.0",
            permissionSurface: "1.0.0",
            runtimeCapability: "1.0.0",
          },
          signatureVerified: false,
          manifestChecksum: "a".repeat(64),
        }),
      /marketplace\.invalid_display_name/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.registerExtensionPackage rejects invalid checksum", () => {
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
          extensionId: "my-extension",
          packageType: "tool",
          displayName: "Valid Name",
          version: "1.0.0",
          owner: "test-owner",
          trustLevel: "internal",
          sourceUri: "https://example.com/extension",
          capabilities: ["capability-1"],
          permissions: ["permission-1"],
          compatibility: {
            apiContract: "1.0.0",
            permissionSurface: "1.0.0",
            runtimeCapability: "1.0.0",
          },
          signatureVerified: false,
          manifestChecksum: "invalid-checksum",
        }),
      /marketplace\.invalid_manifest_checksum/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.submitReview creates review record", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Register first
    const pkg = service.registerExtensionPackage({
      extensionId: "review-test",
      packageType: "workflow",
      displayName: "Review Test Extension",
      version: "1.0.0",
      owner: "test-owner",
      trustLevel: "internal",
      sourceUri: "https://example.com/review-test",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "b".repeat(64),
    });

    // Submit for review
    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "reviewer-1",
      findings: ["Initial finding 1", "Initial finding 2"],
    });

    assert.ok(review.reviewId.startsWith("review_"));
    assert.equal(review.packageId, pkg.packageId);
    assert.equal(review.status, "submitted");
    assert.equal(review.submitter, "reviewer-1");
    assert.ok(review.submittedAt != null);
    assert.equal(review.decidedAt, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.submitReview throws for unknown package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.submitReview({
          packageId: "unknown-package",
          submitter: "reviewer-1",
        }),
      /marketplace\.package_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.decideReview updates review status to approved", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "decide-test",
      packageType: "tool",
      displayName: "Decide Test Extension",
      version: "1.0.0",
      owner: "test-owner",
      trustLevel: "internal",
      sourceUri: "https://example.com/decide",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "c".repeat(64),
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });

    const decided = service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "senior-reviewer",
      decisionReasonCode: "quality-gate-passed",
      findings: ["Looks good"],
    });

    assert.equal(decided.status, "approved");
    assert.equal(decided.reviewer, "senior-reviewer");
    assert.equal(decided.decisionReasonCode, "quality-gate-passed");
    assert.ok(decided.decidedAt != null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.decideReview updates review status to rejected", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "reject-test",
      packageType: "tool",
      displayName: "Reject Test Extension",
      version: "1.0.0",
      owner: "test-owner",
      trustLevel: "internal",
      sourceUri: "https://example.com/reject",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "d".repeat(64),
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });

    const decided = service.decideReview({
      reviewId: review.reviewId,
      status: "rejected",
      reviewer: "senior-reviewer",
      decisionReasonCode: "security-concerns",
      findings: ["Failed security scan"],
    });

    assert.equal(decided.status, "rejected");
    assert.equal(decided.decisionReasonCode, "security-concerns");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage publishes internal package without signature", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "publish-internal",
      packageType: "tool",
      displayName: "Publish Internal",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/internal",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "e".repeat(64),
      reviewRequired: false,
    });

    const publication = service.publishPackage({
      packageId: pkg.packageId,
      channel: "internal",
    });

    assert.ok(publication.publicationId.startsWith("pub_"));
    assert.equal(publication.packageId, pkg.packageId);
    assert.equal(publication.channel, "internal");
    assert.equal(publication.status, "published");
    assert.ok(publication.reviewId.startsWith("review_"));

    const reviews = service.listReviews();
    const exemptionReview = reviews.find((review) => review.reviewId === publication.reviewId);
    assert.ok(exemptionReview != null);
    assert.equal(exemptionReview?.status, "approved");
    assert.equal(exemptionReview?.decisionReasonCode, "review_exempt_internal_package");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage throws for already published package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "double-publish",
      packageType: "tool",
      displayName: "Double Publish",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/double",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "1".repeat(64),
      reviewRequired: false,
    });

    // First publication
    service.publishPackage({
      packageId: pkg.packageId,
    });

    // Second should fail
    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.package_already_published/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.revokePublication marks publication as revoked", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "revoke-test",
      packageType: "tool",
      displayName: "Revoke Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/revoke",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "2".repeat(64),
      reviewRequired: false,
    });

    const publication = service.publishPackage({
      packageId: pkg.packageId,
    });

    const revoked = service.revokePublication({
      publicationId: publication.publicationId,
      reasonCode: "security-incident",
    });

    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revocationReasonCode, "security-incident");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.revokePublication rejects already inactive publication", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "revoke-twice-test",
      packageType: "tool",
      displayName: "Revoke Twice Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/revoke-twice",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "3".repeat(64),
      reviewRequired: false,
    });

    const publication = service.publishPackage({
      packageId: pkg.packageId,
    });

    service.revokePublication({
      publicationId: publication.publicationId,
      reasonCode: "security-incident",
    });

    assert.throws(
      () =>
        service.revokePublication({
          publicationId: publication.publicationId,
          reasonCode: "security-incident",
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return "code" in error && error.code === "marketplace.publication_already_inactive";
      },
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.deprecatePackage updates lifecycle state", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "deprecate-test",
      packageType: "tool",
      displayName: "Deprecate Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/deprecate",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "4".repeat(64),
      reviewRequired: false,
    });

    const deprecated = service.deprecatePackage({
      packageId: pkg.packageId,
      reasonCode: "superseded",
      migrationTarget: "new-package",
    });

    assert.equal(deprecated.lifecycleState, "deprecated");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.retirePackage updates lifecycle state to retired", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "retire-test",
      packageType: "tool",
      displayName: "Retire Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/retire",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "5".repeat(64),
      reviewRequired: false,
    });

    const retired = service.retirePackage({
      packageId: pkg.packageId,
      reasonCode: "end-of-life",
    });

    assert.equal(retired.lifecycleState, "retired");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.sunsetPackage sets lifecycle to sunset", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "sunset-test",
      packageType: "tool",
      displayName: "Sunset Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/sunset",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "6".repeat(64),
      reviewRequired: false,
    });

    const sunset = service.sunsetPackage({
      packageId: pkg.packageId,
      reasonCode: "deprecated-api",
      migrationTarget: "new-api",
      migrationThreshold: 95,
    });

    assert.equal(sunset.lifecycleState, "sunset");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.sunsetPackage rejects migration threshold below 95", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "low-threshold-test",
      packageType: "tool",
      displayName: "Low Threshold Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/low",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "7".repeat(64),
      reviewRequired: false,
    });

    assert.throws(
      () =>
        service.sunsetPackage({
          packageId: pkg.packageId,
          reasonCode: "test",
          migrationThreshold: 80, // Below 95
        }),
      /marketplace\.migration_threshold_too_low/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.buildCatalog returns catalog with summary", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Register some packages
    service.registerExtensionPackage({
      extensionId: "catalog-pkg-1",
      packageType: "tool",
      displayName: "Catalog Package 1",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/cat1",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "8".repeat(64),
      reviewRequired: false,
    });

    service.registerExtensionPackage({
      extensionId: "catalog-pkg-2",
      packageType: "workflow",
      displayName: "Catalog Package 2",
      version: "1.0.0",
      owner: "owner-2",
      trustLevel: "internal",
      sourceUri: "https://example.com/cat2",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "9".repeat(64),
      reviewRequired: false,
      lifecycleState: "deprecated",
    });

    const result = service.buildCatalog();

    assert.ok(result.report.reportId.startsWith("marketplace-report_"));
    assert.equal(result.report.summary.total, 2);
    assert.ok(result.report.entries.length >= 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.listPackages returns all packages", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    service.registerExtensionPackage({
      extensionId: "list-pkg-1",
      packageType: "tool",
      displayName: "List Package 1",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/list1",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "a".repeat(64),
      reviewRequired: false,
    });

    const packages = service.listPackages();

    assert.ok(Array.isArray(packages));
    assert.ok(packages.length >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.listReviews returns all reviews", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "reviews-list-test",
      packageType: "tool",
      displayName: "Reviews List Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/reviews",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "b".repeat(64),
      reviewRequired: true,
    });

    service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });

    const reviews = service.listReviews();

    assert.ok(Array.isArray(reviews));
    assert.ok(reviews.length >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.listPublications returns all publications", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "pubs-list-test",
      packageType: "tool",
      displayName: "Publications List Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/pubs",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "c".repeat(64),
      reviewRequired: false,
    });

    service.publishPackage({ packageId: pkg.packageId });

    const publications = service.listPublications();

    assert.ok(Array.isArray(publications));
    assert.ok(publications.length >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Additional tests for uncovered methods and error cases
// =============================================================================

test("MarketplaceGovernanceService.publishPackage throws for external package without signature", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "external-no-sig",
      packageType: "tool",
      displayName: "External No Signature",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "external",
      sourceUri: "https://example.com/external",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false, // Not verified
      manifestChecksum: "d".repeat(64),
    });

    // Submit and approve review for external package
    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "senior-reviewer",
      decisionReasonCode: "passed-review",
    });

    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.signature_required/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage throws for external package without SBOM", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "external-no-sbom",
      packageType: "tool",
      displayName: "External No SBOM",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "external",
      sourceUri: "https://example.com/external",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "e".repeat(64),
      sbomVerified: false, // SBOM not verified
    });

    // Submit and approve review
    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "senior-reviewer",
      decisionReasonCode: "passed-review",
    });

    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.sbom_required/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage throws for external package without sandbox cert", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "external-no-sandbox",
      packageType: "tool",
      displayName: "External No Sandbox",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "external",
      sourceUri: "https://example.com/external",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "f".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: false, // Sandbox cert not verified
    });

    // Submit and approve review
    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "senior-reviewer",
      decisionReasonCode: "passed-review",
    });

    // SBOM check fails first (line 589) before reaching sandbox cert check
    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.sbom_required/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage throws for external package without egress policy", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "external-no-egress",
      packageType: "tool",
      displayName: "External No Egress",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "external",
      sourceUri: "https://example.com/external",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: true,
      manifestChecksum: "0".repeat(64),
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: false, // Egress policy not compliant
    });

    // Submit and approve review
    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "senior-reviewer",
      decisionReasonCode: "passed-review",
    });

    // SBOM check fails first before reaching egress policy check
    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.sbom_required/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage throws for package with rejected review", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "rejected-review-pkg",
      packageType: "tool",
      displayName: "Rejected Review Package",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/rejected",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "1".repeat(64),
      reviewRequired: true,
    });

    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });

    service.decideReview({
      reviewId: review.reviewId,
      status: "rejected",
      reviewer: "senior-reviewer",
      decisionReasonCode: "security-failures",
    });

    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.review_not_approved/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage throws for package with pending review", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "pending-review-pkg",
      packageType: "tool",
      displayName: "Pending Review Package",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/pending",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "2".repeat(64),
      reviewRequired: true,
    });

    service.submitReview({
      packageId: pkg.packageId,
      submitter: "submitter-1",
    });

    // Review is still "submitted" (not yet decided), so publishing should fail
    assert.throws(
      () =>
        service.publishPackage({
          packageId: pkg.packageId,
        }),
      /marketplace\.review_not_approved/, // Review is submitted, not approved
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.revokePublication throws for deprecated publication", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "deprecate-pub-test",
      packageType: "tool",
      displayName: "Deprecate Pub Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/deprecate-pub",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "3".repeat(64),
      reviewRequired: false,
    });

    const publication = service.publishPackage({ packageId: pkg.packageId });
    service.deprecatePackage({ packageId: pkg.packageId, reasonCode: "superseded" });

    // Use the publication ID captured from publishPackage
    assert.throws(
      () =>
        service.revokePublication({
          publicationId: publication.publicationId,
          reasonCode: "test",
        }),
      /deprecated|retired|revoked/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.revokePublication throws for retired publication", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "retire-pub-test",
      packageType: "tool",
      displayName: "Retire Pub Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/retire-pub",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "4".repeat(64),
      reviewRequired: false,
    });

    const publication = service.publishPackage({ packageId: pkg.packageId });
    service.retirePackage({ packageId: pkg.packageId, reasonCode: "eol" });

    // Use the publication ID captured from publishPackage
    assert.throws(
      () =>
        service.revokePublication({
          publicationId: publication.publicationId,
          reasonCode: "test",
        }),
      /deprecated|retired|revoked/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.deprecatePackage updates publication status to deprecated", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "deprecate-active-test",
      packageType: "tool",
      displayName: "Deprecate Active Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/deprecate-active",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "5".repeat(64),
      reviewRequired: false,
    });

    service.publishPackage({ packageId: pkg.packageId });

    service.deprecatePackage({
      packageId: pkg.packageId,
      reasonCode: "superseded",
      migrationTarget: "new-pkg",
    });

    const pubs = service.listPublications();
    const deprecatedPub = pubs.find((p) => p.packageId === pkg.packageId);

    assert.equal(deprecatedPub?.status, "deprecated");
    assert.ok(deprecatedPub?.revocationReasonCode?.includes("migration_target:new-pkg"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.sunsetPackage updates publication status to sunset", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    const pkg = service.registerExtensionPackage({
      extensionId: "sunset-pub-test",
      packageType: "tool",
      displayName: "Sunset Pub Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/sunset-pub",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "6".repeat(64),
      reviewRequired: false,
    });

    service.publishPackage({ packageId: pkg.packageId });

    const sunset = service.sunsetPackage({
      packageId: pkg.packageId,
      reasonCode: "deprecated-api",
      migrationTarget: "new-api",
      migrationThreshold: 95,
    });

    assert.equal(sunset.lifecycleState, "sunset");

    const pubs = service.listPublications();
    const sunsetPub = pubs.find((p) => p.packageId === pkg.packageId);

    assert.equal(sunsetPub?.status, "sunset");
    assert.ok(sunsetPub?.revocationReasonCode?.includes("sunset_starts:"));
    assert.ok(sunsetPub?.revocationReasonCode?.includes("sunset_ends:"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.decideReview throws for non-existent review", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.decideReview({
          reviewId: "nonexistent-review",
          status: "approved",
          reviewer: "reviewer-1",
          decisionReasonCode: "test",
        }),
      /marketplace\.review_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.buildCatalog with full integration", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    // Package 1: published with no issues
    const pkg1 = service.registerExtensionPackage({
      extensionId: "catalog-integrated-1",
      packageType: "tool",
      displayName: "Catalog Integrated 1",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/cat-int-1",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "7".repeat(64),
      reviewRequired: false,
    });

    service.publishPackage({ packageId: pkg1.packageId });

    // Package 2: submitted for review (pending)
    const pkg2 = service.registerExtensionPackage({
      extensionId: "catalog-integrated-2",
      packageType: "workflow",
      displayName: "Catalog Integrated 2",
      version: "1.0.0",
      owner: "owner-2",
      trustLevel: "internal",
      sourceUri: "https://example.com/cat-int-2",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "8".repeat(64),
      reviewRequired: true,
    });

    service.submitReview({
      packageId: pkg2.packageId,
      submitter: "submitter-1",
    });

    const result = service.buildCatalog();

    assert.ok(result.report.reportId.startsWith("marketplace-report_"));
    assert.equal(result.report.summary.total, 2);
    assert.ok(result.report.summary.packagesReady >= 1);
    assert.ok(result.report.summary.reviewPending >= 1);

    const entry1 = result.report.entries.find((e) => e.extensionId === "catalog-integrated-1");
    assert.ok(entry1 != null);
    assert.equal(entry1.publicationStatus, "published");
    // Internal package published with review exemption gets an approved exemption review
    assert.equal(entry1.reviewStatus, "approved");
    assert.ok(entry1.reasonCodes.length === 0);

    const entry2 = result.report.entries.find((e) => e.extensionId === "catalog-integrated-2");
    assert.ok(entry2 != null);
    assert.equal(entry2.publicationStatus, "unpublished");
    assert.equal(entry2.reviewStatus, "submitted");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.exportCatalog throws without artifact store", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    // No artifact store options provided
    const service = new MarketplaceGovernanceService(db, store);

    service.registerExtensionPackage({
      extensionId: "export-test",
      packageType: "tool",
      displayName: "Export Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/export",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "9".repeat(64),
      reviewRequired: false,
    });

    assert.throws(
      () => service.exportCatalog(),
      /marketplace\.artifact_store_required/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.listReports returns governance reports", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    service.registerExtensionPackage({
      extensionId: "reports-test",
      packageType: "tool",
      displayName: "Reports Test",
      version: "1.0.0",
      owner: "owner-1",
      trustLevel: "internal",
      sourceUri: "https://example.com/reports",
      capabilities: ["cap-1"],
      permissions: ["perm-1"],
      compatibility: {
        apiContract: "1.0.0",
        permissionSurface: "1.0.0",
        runtimeCapability: "1.0.0",
      },
      signatureVerified: false,
      manifestChecksum: "a".repeat(64),
      reviewRequired: false,
    });

    // Build catalog to generate a report
    service.buildCatalog();

    const reports = service.listReports();

    assert.ok(Array.isArray(reports));
    assert.ok(reports.length >= 1);
    assert.ok(reports[0]!.reportId.startsWith("marketplace-report_"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.submitReview rejects invalid package ID format", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.submitReview({
          packageId: "invalid package id!",
          submitter: "submitter-1",
        }),
      /marketplace\.invalid_package_id/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.publishPackage rejects non-existent package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.publishPackage({
          packageId: "nonexistent-pkg",
        }),
      /marketplace\.package_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.revokePublication rejects non-existent publication", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.revokePublication({
          publicationId: "nonexistent-pub",
          reasonCode: "test",
        }),
      /marketplace\.publication_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.deprecatePackage rejects non-existent package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.deprecatePackage({
          packageId: "nonexistent-pkg",
          reasonCode: "test",
        }),
      /marketplace\.package_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.retirePackage rejects non-existent package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.retirePackage({
          packageId: "nonexistent-pkg",
          reasonCode: "test",
        }),
      /marketplace\.package_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceGovernanceService.sunsetPackage rejects non-existent package", () => {
  const workspace = createTempWorkspace("aa-marketplace-unit-");
  const dbPath = `${workspace}/marketplace.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new MarketplaceGovernanceService(db, store);

    assert.throws(
      () =>
        service.sunsetPackage({
          packageId: "nonexistent-pkg",
          reasonCode: "test",
        }),
      /marketplace\.package_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
