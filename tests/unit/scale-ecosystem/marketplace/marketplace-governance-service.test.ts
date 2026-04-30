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
      manifestChecksum: "i".repeat(64),
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
      manifestChecksum: "j".repeat(64),
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
      manifestChecksum: "k".repeat(64),
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
      manifestChecksum: "l".repeat(64),
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
      manifestChecksum: "m".repeat(64),
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
      manifestChecksum: "n".repeat(64),
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
      manifestChecksum: "o".repeat(64),
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
      manifestChecksum: "p".repeat(64),
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
      manifestChecksum: "q".repeat(64),
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
      manifestChecksum: "r".repeat(64),
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
      manifestChecksum: "s".repeat(64),
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