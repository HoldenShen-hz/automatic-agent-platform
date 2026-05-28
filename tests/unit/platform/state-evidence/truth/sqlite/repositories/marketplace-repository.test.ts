import assert from "node:assert/strict";
import test from "node:test";
import { MarketplaceRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/marketplace-repository.js";

function createMockDb() {
  const runCalls: unknown[][] = [];
  return {
    db: {
      connection: {
        prepare: () => ({
          run: (...args: unknown[]) => {
            runCalls.push(args);
            return { changes: 1 };
          },
          get: () => undefined,
          all: () => [],
        }),
      },
    },
    runCalls,
  };
}

test("MarketplaceRepository has all required methods", () => {
  const { db } = createMockDb();
  const repo = new MarketplaceRepository(db);

  assert.equal(typeof repo.upsertMarketplaceReview, "function");
  assert.equal(typeof repo.upsertMarketplacePublication, "function");
  assert.equal(typeof repo.insertMarketplaceGovernanceReport, "function");
  assert.equal(typeof repo.upsertExtensionPackage, "function");
  assert.equal(typeof repo.getExtensionPackage, "function");
  assert.equal(typeof repo.listExtensionPackages, "function");
  assert.equal(typeof repo.getMarketplaceReview, "function");
  assert.equal(typeof repo.listMarketplaceReviews, "function");
  assert.equal(typeof repo.getLatestMarketplaceReviewForPackage, "function");
  assert.equal(typeof repo.getMarketplacePublication, "function");
  assert.equal(typeof repo.getActiveMarketplacePublicationForPackage, "function");
  assert.equal(typeof repo.listMarketplacePublications, "function");
  assert.equal(typeof repo.listMarketplaceGovernanceReports, "function");
});

test("MarketplaceRepository upserts marketplace review", () => {
  const { db, runCalls } = createMockDb();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const review = {
    reviewId: "review_1",
    tenantId: "tenant_1",
    packageId: "pkg_1",
    status: "pending",
    submitter: "user_1",
    reviewer: "admin_1",
    decisionReasonCode: "auto_approved",
    findingsJson: "{}",
    permissionSurfaceHash: "hash123",
    submittedAt: now,
    decidedAt: null,
  };

  assert.equal(repo.upsertMarketplaceReview(review), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(review.reviewId));
  assert.ok(runCalls[0]?.includes(review.packageId));
});

test("MarketplaceRepository upserts marketplace publication", () => {
  const { db, runCalls } = createMockDb();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const publication = {
    publicationId: "pub_1",
    tenantId: "tenant_1",
    packageId: "pkg_1",
    reviewId: "review_1",
    channel: "stable",
    status: "published",
    compatibilityMatrixJson: "{}",
    revocationReasonCode: null,
    publishedAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertMarketplacePublication(publication), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(publication.publicationId));
  assert.ok(runCalls[0]?.includes(publication.packageId));
});

test("MarketplaceRepository inserts marketplace governance report", () => {
  const { db, runCalls } = createMockDb();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const report = {
    reportId: "gov_report_1",
    tenantId: "tenant_1",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: now,
  };

  assert.equal(repo.insertMarketplaceGovernanceReport(report), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(report.reportId));
  assert.ok(runCalls[0]?.includes(report.tenantId));
});

test("MarketplaceRepository upserts extension package", () => {
  const { db, runCalls } = createMockDb();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const pkg = {
    packageId: "pkg_1",
    tenantId: "tenant_1",
    extensionId: "ext_1",
    packageType: "plugin",
    displayName: "Test Plugin",
    version: "1.0.0",
    owner: "user_1",
    trustLevel: "verified",
    sourceUri: "https://example.com/pkg",
    capabilitiesJson: "[]",
    permissionsJson: "[]",
    compatibilityJson: "{}",
    signatureVerified: true,
    manifestChecksum: "checksum123",
    lifecycleState: "active",
    reviewRequired: false,
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertExtensionPackage(pkg), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(pkg.packageId));
  assert.ok(runCalls[0]?.includes(pkg.displayName));
});

test("MarketplaceRepository gets extension package", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.getExtensionPackage("nonexistent");
  assert.equal(result, null);
});

test("MarketplaceRepository gets extension package with tenant scope", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.getExtensionPackage("pkg_1", "tenant_1");
  assert.equal(result, null);
});

test("MarketplaceRepository lists extension packages", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.listExtensionPackages();
  assert.ok(Array.isArray(result));
});

test("MarketplaceRepository lists extension packages with tenant scope", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.listExtensionPackages(50, "tenant_1");
  assert.ok(Array.isArray(result));
});

test("MarketplaceRepository gets marketplace review", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.getMarketplaceReview("nonexistent");
  assert.equal(result, null);
});

test("MarketplaceRepository lists marketplace reviews", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.listMarketplaceReviews();
  assert.ok(Array.isArray(result));
});

test("MarketplaceRepository gets latest review for package", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.getLatestMarketplaceReviewForPackage("pkg_1");
  assert.equal(result, null);
});

test("MarketplaceRepository gets marketplace publication", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.getMarketplacePublication("nonexistent");
  assert.equal(result, null);
});

test("MarketplaceRepository gets active marketplace publication for package", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.getActiveMarketplacePublicationForPackage("pkg_1");
  assert.equal(result, null);
});

test("MarketplaceRepository lists marketplace publications", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.listMarketplacePublications();
  assert.ok(Array.isArray(result));
});

test("MarketplaceRepository lists marketplace governance reports", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new MarketplaceRepository(db);

  const result = repo.listMarketplaceGovernanceReports();
  assert.ok(Array.isArray(result));
});
