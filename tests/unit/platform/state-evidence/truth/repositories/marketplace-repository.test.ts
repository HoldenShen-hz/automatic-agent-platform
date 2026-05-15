import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { MarketplaceRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/marketplace-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

test("MarketplaceRepository upsertExtensionPackage and getExtensionPackage", () => {
  const workspace = createTempWorkspace("aa-marketplace-pkg-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = repo.getExtensionPackage("pkg-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.packageId, "pkg-1");
    assert.equal(result.displayName, "Skill One");
    assert.equal(result.version, "1.0.0");
    assert.equal(result.trustLevel, "verified");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository upsertExtensionPackage updates existing record", () => {
  const workspace = createTempWorkspace("aa-marketplace-pkg-upd-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Original Name",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Updated Name",
      version: "2.0.0",
      owner: "team-b",
      trustLevel: "community",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 0,
      manifestChecksum: "sha256:2",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: "2026-04-15T11:00:00.000Z",
    });

    const result = repo.getExtensionPackage("pkg-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.displayName, "Updated Name");
    assert.equal(result.version, "2.0.0");
    assert.equal(result.owner, "team-b");
    assert.equal(result.trustLevel, "community");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository getExtensionPackage returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-marketplace-pkg-null-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    const result = repo.getExtensionPackage("nonexistent", "tenant-alpha");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository listExtensionPackages returns all packages", () => {
  const workspace = createTempWorkspace("aa-marketplace-pkg-list-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertExtensionPackage({
      packageId: "pkg-2",
      tenantId: "tenant-alpha",
      extensionId: "ext-2",
      packageType: "tool",
      displayName: "Tool Two",
      version: "1.0.0",
      owner: "team-b",
      trustLevel: "community",
      sourceUri: "file:///pkg-2",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 0,
      manifestChecksum: "sha256:2",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listExtensionPackages(10, "tenant-alpha");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository listExtensionPackages respects limit", () => {
  const workspace = createTempWorkspace("aa-marketplace-pkg-limit-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    for (let i = 1; i <= 5; i++) {
      repo.upsertExtensionPackage({
        packageId: `pkg-${i}`,
        tenantId: "tenant-alpha",
        extensionId: `ext-${i}`,
        packageType: "skill",
        displayName: `Package ${i}`,
        version: "1.0.0",
        owner: "team-a",
        trustLevel: "verified",
        sourceUri: `file:///pkg-${i}`,
        capabilitiesJson: "[]",
        permissionsJson: "[]",
        compatibilityJson: "{}",
        signatureVerified: 1,
        manifestChecksum: `sha256:${i}`,
        lifecycleState: "enabled",
        reviewRequired: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    const limited = repo.listExtensionPackages(3, "tenant-alpha");
    assert.equal(limited.length, 3);

    const all = repo.listExtensionPackages(10, "tenant-alpha");
    assert.equal(all.length, 5);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository upsertMarketplaceReview and getMarketplaceReview", () => {
  const workspace = createTempWorkspace("aa-marketplace-review-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    // Insert parent extension package first
    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertMarketplaceReview({
      reviewId: "review-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "submitted",
      submitter: "user-1",
      reviewer: null,
      decisionReasonCode: null,
      findingsJson: "[]",
      permissionSurfaceHash: "hash-1",
      submittedAt: now,
      decidedAt: null,
    });

    const result = repo.getMarketplaceReview("review-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.reviewId, "review-1");
    assert.equal(result.status, "submitted");
    assert.equal(result.submitter, "user-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository getMarketplaceReview returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-marketplace-review-null-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    const result = repo.getMarketplaceReview("nonexistent", "tenant-alpha");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository listMarketplaceReviews returns all reviews", () => {
  const workspace = createTempWorkspace("aa-marketplace-review-list-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    // Insert parent extension packages first
    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertExtensionPackage({
      packageId: "pkg-2",
      tenantId: "tenant-alpha",
      extensionId: "ext-2",
      packageType: "tool",
      displayName: "Tool Two",
      version: "1.0.0",
      owner: "team-b",
      trustLevel: "community",
      sourceUri: "file:///pkg-2",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 0,
      manifestChecksum: "sha256:2",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertMarketplaceReview({
      reviewId: "review-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "approved",
      submitter: "user-1",
      reviewer: "reviewer-1",
      decisionReasonCode: "looks_good",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-1",
      submittedAt: now,
      decidedAt: now,
    });
    repo.upsertMarketplaceReview({
      reviewId: "review-2",
      tenantId: "tenant-alpha",
      packageId: "pkg-2",
      status: "rejected",
      submitter: "user-2",
      reviewer: "reviewer-1",
      decisionReasonCode: "security_concerns",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-2",
      submittedAt: now,
      decidedAt: now,
    });

    const results = repo.listMarketplaceReviews(10, "tenant-alpha");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository getLatestMarketplaceReviewForPackage returns most recent", () => {
  const workspace = createTempWorkspace("aa-marketplace-review-latest-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    // Insert parent extension package first
    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertMarketplaceReview({
      reviewId: "review-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "approved",
      submitter: "user-1",
      reviewer: "reviewer-1",
      decisionReasonCode: "looks_good",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-1",
      submittedAt: "2026-04-14T10:00:00.000Z",
      decidedAt: "2026-04-14T10:00:00.000Z",
    });
    repo.upsertMarketplaceReview({
      reviewId: "review-2",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "rejected",
      submitter: "user-1",
      reviewer: "reviewer-1",
      decisionReasonCode: "security_concerns",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-2",
      submittedAt: now,
      decidedAt: now,
    });

    const latest = repo.getLatestMarketplaceReviewForPackage("pkg-1", "tenant-alpha");
    assert.ok(latest);
    assert.equal(latest.reviewId, "review-2");
    assert.equal(latest.status, "rejected");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository upsertMarketplacePublication and getMarketplacePublication", () => {
  const workspace = createTempWorkspace("aa-marketplace-pub-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    // Insert parent extension package and review first
    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertMarketplaceReview({
      reviewId: "review-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "approved",
      submitter: "user-1",
      reviewer: "reviewer-1",
      decisionReasonCode: "looks_good",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-1",
      submittedAt: now,
      decidedAt: now,
    });

    repo.upsertMarketplacePublication({
      publicationId: "pub-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      reviewId: "review-1",
      channel: "stable",
      status: "published",
      compatibilityMatrixJson: "{}",
      revocationReasonCode: null,
      publishedAt: now,
      updatedAt: now,
    });

    const result = repo.getMarketplacePublication("pub-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.publicationId, "pub-1");
    assert.equal(result.channel, "stable");
    assert.equal(result.status, "published");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository getMarketplacePublication returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-marketplace-pub-null-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    const result = repo.getMarketplacePublication("nonexistent", "tenant-alpha");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository getActiveMarketplacePublicationForPackage returns active publication", () => {
  const workspace = createTempWorkspace("aa-marketplace-pub-active-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    // Insert parent extension package and review first
    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertMarketplaceReview({
      reviewId: "review-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "approved",
      submitter: "user-1",
      reviewer: "reviewer-1",
      decisionReasonCode: "looks_good",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-1",
      submittedAt: now,
      decidedAt: now,
    });

    repo.upsertMarketplacePublication({
      publicationId: "pub-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      reviewId: "review-1",
      channel: "stable",
      status: "published",
      compatibilityMatrixJson: "{}",
      revocationReasonCode: null,
      publishedAt: now,
      updatedAt: now,
    });

    const result = repo.getActiveMarketplacePublicationForPackage("pkg-1", "tenant-alpha");
    assert.ok(result);
    assert.equal(result.publicationId, "pub-1");
    assert.equal(result.status, "published");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository listMarketplacePublications returns all publications", () => {
  const workspace = createTempWorkspace("aa-marketplace-pub-list-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    // Insert parent extension packages and reviews first
    repo.upsertExtensionPackage({
      packageId: "pkg-1",
      tenantId: "tenant-alpha",
      extensionId: "ext-1",
      packageType: "skill",
      displayName: "Skill One",
      version: "1.0.0",
      owner: "team-a",
      trustLevel: "verified",
      sourceUri: "file:///pkg-1",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 1,
      manifestChecksum: "sha256:1",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertMarketplaceReview({
      reviewId: "review-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      status: "approved",
      submitter: "user-1",
      reviewer: "reviewer-1",
      decisionReasonCode: "looks_good",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-1",
      submittedAt: now,
      decidedAt: now,
    });
    repo.upsertExtensionPackage({
      packageId: "pkg-2",
      tenantId: "tenant-alpha",
      extensionId: "ext-2",
      packageType: "tool",
      displayName: "Tool Two",
      version: "1.0.0",
      owner: "team-b",
      trustLevel: "community",
      sourceUri: "file:///pkg-2",
      capabilitiesJson: "[]",
      permissionsJson: "[]",
      compatibilityJson: "{}",
      signatureVerified: 0,
      manifestChecksum: "sha256:2",
      lifecycleState: "enabled",
      reviewRequired: 1,
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertMarketplaceReview({
      reviewId: "review-2",
      tenantId: "tenant-alpha",
      packageId: "pkg-2",
      status: "approved",
      submitter: "user-2",
      reviewer: "reviewer-1",
      decisionReasonCode: "looks_good",
      findingsJson: "[]",
      permissionSurfaceHash: "hash-2",
      submittedAt: now,
      decidedAt: now,
    });

    repo.upsertMarketplacePublication({
      publicationId: "pub-1",
      tenantId: "tenant-alpha",
      packageId: "pkg-1",
      reviewId: "review-1",
      channel: "stable",
      status: "published",
      compatibilityMatrixJson: "{}",
      revocationReasonCode: null,
      publishedAt: now,
      updatedAt: now,
    });
    repo.upsertMarketplacePublication({
      publicationId: "pub-2",
      tenantId: "tenant-alpha",
      packageId: "pkg-2",
      reviewId: "review-2",
      channel: "beta",
      status: "published",
      compatibilityMatrixJson: "{}",
      revocationReasonCode: null,
      publishedAt: now,
      updatedAt: now,
    });

    const results = repo.listMarketplacePublications(10, "tenant-alpha");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository insertMarketplaceGovernanceReport and listMarketplaceGovernanceReports", () => {
  const workspace = createTempWorkspace("aa-marketplace-governance-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    repo.insertMarketplaceGovernanceReport({
      reportId: "report-1",
      tenantId: "tenant-alpha",
      summaryJson: '{"status":"ok"}',
      reportJson: '{"findings":[]}',
      generatedAt: now,
    });

    const results = repo.listMarketplaceGovernanceReports(10, "tenant-alpha");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.reportId, "report-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("MarketplaceRepository listMarketplaceGovernanceReports returns multiple reports", () => {
  const workspace = createTempWorkspace("aa-marketplace-governance-list-");
  const dbPath = join(workspace, "marketplace.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new MarketplaceRepository(db);

    repo.insertMarketplaceGovernanceReport({
      reportId: "report-1",
      tenantId: "tenant-alpha",
      summaryJson: '{"status":"ok"}',
      reportJson: '{"findings":[]}',
      generatedAt: "2026-04-14T10:00:00.000Z",
    });
    repo.insertMarketplaceGovernanceReport({
      reportId: "report-2",
      tenantId: "tenant-alpha",
      summaryJson: '{"status":"warnings"}',
      reportJson: '{"findings":["warning1"]}',
      generatedAt: now,
    });

    const results = repo.listMarketplaceGovernanceReports(10, "tenant-alpha");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});
