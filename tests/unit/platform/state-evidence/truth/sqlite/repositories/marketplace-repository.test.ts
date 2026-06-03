import assert from "node:assert/strict";
import test from "node:test";

import { MarketplaceRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/marketplace-repository.js";
import { createMockAuthoritativeSqlDatabase } from "./test-helpers.js";

test("MarketplaceRepository has all required methods", () => {
  const { db } = createMockAuthoritativeSqlDatabase();
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
  const { db, runCalls } = createMockAuthoritativeSqlDatabase();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const review: Parameters<MarketplaceRepository["upsertMarketplaceReview"]>[0] = {
    reviewId: "review_1",
    tenantId: "tenant_1",
    packageId: "pkg_1",
    status: "submitted",
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
  const { db, runCalls } = createMockAuthoritativeSqlDatabase();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const publication: Parameters<MarketplaceRepository["upsertMarketplacePublication"]>[0] = {
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
  const { db, runCalls } = createMockAuthoritativeSqlDatabase();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const report: Parameters<MarketplaceRepository["insertMarketplaceGovernanceReport"]>[0] = {
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
  const { db, runCalls } = createMockAuthoritativeSqlDatabase();
  const repo = new MarketplaceRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const pkg: Parameters<MarketplaceRepository["upsertExtensionPackage"]>[0] = {
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
    signatureVerified: 1,
    manifestChecksum: "checksum123",
    lifecycleState: "enabled",
    reviewRequired: 0,
    sbomVerified: 1,
    sandboxCertVerified: 1,
    egressPolicyCompliant: 1,
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(repo.upsertExtensionPackage(pkg), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(pkg.packageId));
  assert.ok(runCalls[0]?.includes(pkg.displayName));
});

test("MarketplaceRepository read methods tolerate empty results", () => {
  const { db } = createMockAuthoritativeSqlDatabase({ getResult: null });
  const repo = new MarketplaceRepository(db);

  assert.equal(repo.getExtensionPackage("nonexistent"), null);
  assert.equal(repo.getExtensionPackage("pkg_1", "tenant_1"), null);
  assert.equal(repo.getMarketplaceReview("nonexistent"), null);
  assert.equal(repo.getLatestMarketplaceReviewForPackage("pkg_1"), null);
  assert.equal(repo.getMarketplacePublication("nonexistent"), null);
  assert.equal(repo.getActiveMarketplacePublicationForPackage("pkg_1"), null);
});

test("MarketplaceRepository list methods tolerate empty results", () => {
  const { db } = createMockAuthoritativeSqlDatabase();
  const repo = new MarketplaceRepository(db);

  assert.ok(Array.isArray(repo.listExtensionPackages()));
  assert.ok(Array.isArray(repo.listExtensionPackages(50, "tenant_1")));
  assert.ok(Array.isArray(repo.listMarketplaceReviews()));
  assert.ok(Array.isArray(repo.listMarketplacePublications()));
  assert.ok(Array.isArray(repo.listMarketplaceGovernanceReports()));
});
