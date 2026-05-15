import assert from "node:assert/strict";
import test from "node:test";

import { AsyncMarketplaceRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/marketplace-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { MarketplaceReviewRecord, MarketplacePublicationRecord, ExtensionPackageRecord } from "../../../../../../src/platform/contracts/types/domain.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-23T10:00:00.000Z";

function marketplaceReviewRecord(overrides: Partial<MarketplaceReviewRecord> = {}): MarketplaceReviewRecord {
  return {
    reviewId: "review-1",
    tenantId: "tenant-1",
    packageId: "pkg-1",
    status: "pending",
    submitter: "user-1",
    reviewer: "admin-1",
    decisionReasonCode: null,
    findingsJson: "{}",
    permissionSurfaceHash: "abc123",
    submittedAt: now,
    decidedAt: null,
    ...overrides,
  };
}

function marketplacePublicationRecord(overrides: Partial<MarketplacePublicationRecord> = {}): MarketplacePublicationRecord {
  return {
    publicationId: "pub-1",
    tenantId: "tenant-1",
    packageId: "pkg-1",
    reviewId: "review-1",
    channel: "stable",
    status: "published",
    compatibilityMatrixJson: "{}",
    revocationReasonCode: null,
    publishedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function extensionPackageRecord(overrides: Partial<ExtensionPackageRecord> = {}): ExtensionPackageRecord {
  return {
    packageId: "pkg-1",
    tenantId: "tenant-1",
    extensionId: "ext-1",
    packageType: "extension",
    displayName: "Test Package",
    version: "1.0.0",
    owner: "user-1",
    trustLevel: "trusted",
    sourceUri: "file:///test",
    capabilitiesJson: "[]",
    permissionsJson: "[]",
    compatibilityJson: "{}",
    signatureVerified: true,
    manifestChecksum: "checksum123",
    lifecycleState: "active",
    reviewRequired: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// === UpsertMarketplaceReview Tests ===

test("AsyncMarketplaceRepository upsertMarketplaceReview inserts review", async () => {
  const review = marketplaceReviewRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.upsertMarketplaceReview(review);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO marketplace_reviews/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(review_id\) DO UPDATE SET/);
});

test("AsyncMarketplaceRepository upsertMarketplaceReview uses correct parameter order", async () => {
  const review = marketplaceReviewRecord({ reviewId: "my-review" });
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.upsertMarketplaceReview(review);

  assert.deepEqual(calls[0]!.params[0], "my-review");
});

// === GetMarketplaceReview Tests ===

test("AsyncMarketplaceRepository getMarketplaceReview returns review when found", async () => {
  const review = marketplaceReviewRecord();
  const { connection, calls } = createConnection({ queryOneRows: [review] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getMarketplaceReview("review-1");

  assert.deepEqual(result, review);
  assert.match(calls[0]?.sql ?? "", /FROM marketplace_reviews/);
});

test("AsyncMarketplaceRepository getMarketplaceReview returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getMarketplaceReview("nonexistent");

  assert.equal(result, null);
});

// === ListMarketplaceReviews Tests ===

test("AsyncMarketplaceRepository listMarketplaceReviews returns reviews", async () => {
  const review = marketplaceReviewRecord();
  const { connection } = createConnection({ queryRows: [[review]] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.listMarketplaceReviews(10);

  assert.deepEqual(result, [review]);
});

test("AsyncMarketplaceRepository listMarketplaceReviews respects limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.listMarketplaceReviews(5);

  assert.match(calls[0]!.sql, /LIMIT \$1/);
  assert.deepEqual(calls[0]!.params, [5]);
});

// === GetLatestMarketplaceReviewForPackage Tests ===

test("AsyncMarketplaceRepository getLatestMarketplaceReviewForPackage returns review", async () => {
  const review = marketplaceReviewRecord();
  const { connection, calls } = createConnection({ queryOneRows: [review] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getLatestMarketplaceReviewForPackage("pkg-1");

  assert.deepEqual(result, review);
  assert.match(calls[0]?.sql ?? "", /ORDER BY submitted_at DESC/);
});

// === UpsertMarketplacePublication Tests ===

test("AsyncMarketplaceRepository upsertMarketplacePublication inserts publication", async () => {
  const pub = marketplacePublicationRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.upsertMarketplacePublication(pub);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO marketplace_publications/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(publication_id\) DO UPDATE SET/);
});

// === GetMarketplacePublication Tests ===

test("AsyncMarketplaceRepository getMarketplacePublication returns publication when found", async () => {
  const pub = marketplacePublicationRecord();
  const { connection } = createConnection({ queryOneRows: [pub] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getMarketplacePublication("pub-1");

  assert.deepEqual(result, pub);
});

// === GetActiveMarketplacePublicationForPackage Tests ===

test("AsyncMarketplaceRepository getActiveMarketplacePublicationForPackage returns published", async () => {
  const pub = marketplacePublicationRecord({ status: "published" });
  const { connection, calls } = createConnection({ queryOneRows: [pub] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getActiveMarketplacePublicationForPackage("pkg-1");

  assert.deepEqual(result, pub);
  assert.match(calls[0]?.sql ?? "", /status = 'published'/);
});

// === ListMarketplacePublications Tests ===

test("AsyncMarketplaceRepository listMarketplacePublications returns publications", async () => {
  const pub = marketplacePublicationRecord();
  const { connection } = createConnection({ queryRows: [[pub]] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.listMarketplacePublications(10);

  assert.deepEqual(result, [pub]);
});

// === UpsertExtensionPackage Tests ===

test("AsyncMarketplaceRepository upsertExtensionPackage inserts package", async () => {
  const pkg = extensionPackageRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.upsertExtensionPackage(pkg);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO extension_packages/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(package_id\) DO UPDATE SET/);
});

// === GetExtensionPackage Tests ===

test("AsyncMarketplaceRepository getExtensionPackage returns package when found", async () => {
  const pkg = extensionPackageRecord();
  const { connection } = createConnection({ queryOneRows: [pkg] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getExtensionPackage("pkg-1");

  assert.deepEqual(result, pkg);
});

test("AsyncMarketplaceRepository getExtensionPackage returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.getExtensionPackage("nonexistent");

  assert.equal(result, null);
});

// === ListExtensionPackages Tests ===

test("AsyncMarketplaceRepository listExtensionPackages returns packages", async () => {
  const pkg = extensionPackageRecord();
  const { connection } = createConnection({ queryRows: [[pkg]] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.listExtensionPackages(10);

  assert.deepEqual(result, [pkg]);
});

test("AsyncMarketplaceRepository listExtensionPackages defaults limit to 100", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.listExtensionPackages();

  assert.match(calls[0]!.sql, /LIMIT \$1/);
});

// === InsertMarketplaceGovernanceReport Tests ===

test("AsyncMarketplaceRepository insertMarketplaceGovernanceReport inserts report", async () => {
  const report = {
    reportId: "rpt-1",
    tenantId: "tenant-1",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: now,
  };
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.insertMarketplaceGovernanceReport(report);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO marketplace_governance_reports/);
});

// === ListMarketplaceGovernanceReports Tests ===

test("AsyncMarketplaceRepository listMarketplaceGovernanceReports returns reports", async () => {
  const report = {
    reportId: "rpt-1",
    tenantId: "tenant-1",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: now,
  };
  const { connection } = createConnection({ queryRows: [[report]] });
  const repo = new AsyncMarketplaceRepository(connection);

  const result = await repo.listMarketplaceGovernanceReports(20);

  assert.deepEqual(result, [report]);
});

test("AsyncMarketplaceRepository listMarketplaceGovernanceReports defaults limit to 20", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncMarketplaceRepository(connection);

  await repo.listMarketplaceGovernanceReports();

  assert.match(calls[0]!.sql, /LIMIT \$1/);
});