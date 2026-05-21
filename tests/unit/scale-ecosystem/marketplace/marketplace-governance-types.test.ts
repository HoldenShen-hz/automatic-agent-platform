/**
 * Unit tests for Marketplace Governance Types
 *
 * Tests type definitions and interfaces for marketplace governance.
 *
 * @see src/scale-ecosystem/marketplace/marketplace-governance-types.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type {
  RegisterExtensionPackageInput,
  SubmitMarketplaceReviewInput,
  DecideMarketplaceReviewInput,
  PublishExtensionInput,
  RevokeExtensionInput,
  DeprecateExtensionInput,
  SunsetExtensionInput,
  RetireExtensionInput,
  MarketplaceCatalogEntry,
  MarketplaceCatalogSummary,
  MarketplaceCatalogReport,
  MarketplaceGovernanceRunResult,
  MarketplaceGovernanceExportResult,
  MarketplaceGovernanceServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/marketplace-governance-types.js";

test("RegisterExtensionPackageInput accepts valid input", () => {
  const input: RegisterExtensionPackageInput = {
    extensionId: "ext-123",
    packageType: "agent",
    displayName: "Test Agent",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "verified",
    sourceUri: "https://example.com/agent.tar.gz",
    capabilities: ["task-execution"],
    permissions: ["read", "write"],
    signatureVerified: true,
    manifestChecksum: "abc123def456",
    lifecycleState: "draft",
  };

  assert.equal(input.extensionId, "ext-123");
  assert.equal(input.packageType, "agent");
  assert.equal(input.signatureVerified, true);
  assert.ok(!input.sbomVerified);
});

test("SubmitMarketplaceReviewInput accepts valid input", () => {
  const input: SubmitMarketplaceReviewInput = {
    packageId: "pkg-123",
    submitter: "test-user",
    findings: ["Minor security concern"],
  };

  assert.equal(input.packageId, "pkg-123");
  assert.equal(input.submitter, "test-user");
  assert.equal(input.findings?.length, 1);
});

test("DecideMarketplaceReviewInput accepts approved status", () => {
  const input: DecideMarketplaceReviewInput = {
    reviewId: "review-123",
    status: "approved",
    reviewer: "admin-user",
    decisionReasonCode: "marketplace.approved",
  };

  assert.equal(input.status, "approved");
  assert.equal(input.decisionReasonCode, "marketplace.approved");
});

test("DecideMarketplaceReviewInput accepts rejected status", () => {
  const input: DecideMarketplaceReviewInput = {
    reviewId: "review-123",
    status: "rejected",
    reviewer: "admin-user",
    decisionReasonCode: "marketplace.failed_security",
    findings: ["Critical security issue found"],
  };

  assert.equal(input.status, "rejected");
  assert.equal(input.findings?.length, 1);
});

test("PublishExtensionInput accepts valid input", () => {
  const input: PublishExtensionInput = {
    packageId: "pkg-123",
    reviewId: "review-123",
    channel: "stable",
    publishedAt: "2024-01-15T10:00:00Z",
  };

  assert.equal(input.packageId, "pkg-123");
  assert.equal(input.channel, "stable");
});

test("RevokeExtensionInput accepts valid input", () => {
  const input: RevokeExtensionInput = {
    publicationId: "pub-123",
    reasonCode: "marketplace.critical_security",
    revokedAt: "2024-01-15T10:00:00Z",
  };

  assert.equal(input.reasonCode, "marketplace.critical_security");
});

test("DeprecateExtensionInput accepts valid input with migration target", () => {
  const input: DeprecateExtensionInput = {
    packageId: "pkg-123",
    reasonCode: "marketplace.superseded",
    migrationTarget: "pkg-456",
    replacementSuggestions: ["pkg-456", "pkg-789"],
  };

  assert.equal(input.migrationTarget, "pkg-456");
  assert.equal(input.replacementSuggestions?.length, 2);
});

test("SunsetExtensionInput accepts threshold conditions", () => {
  const input: SunsetExtensionInput = {
    packageId: "pkg-123",
    reasonCode: "marketplace.end_of_life",
    sunsetAt: "2024-06-01T00:00:00Z",
    endOfLifeAt: "2024-12-01T00:00:00Z",
    thresholdConditions: [
      {
        conditionId: "security_score",
        description: "Security score drops below 0.5",
        severityThreshold: "critical",
        actionOnTrigger: "immediate_eol",
      },
    ],
  };

  assert.equal(input.thresholdConditions?.length, 1);
  assert.equal(input.thresholdConditions![0].severityThreshold, "critical");
});

test("RetireExtensionInput accepts migration completion ratio", () => {
  const input: RetireExtensionInput = {
    packageId: "pkg-123",
    reasonCode: "marketplace.retired",
    migrationCompletionRatio: 0.95,
  };

  assert.equal(input.migrationCompletionRatio, 0.95);
});

test("MarketplaceCatalogEntry captures full marketplace state", () => {
  const entry: MarketplaceCatalogEntry = {
    packageId: "pkg-123",
    tenantId: "tenant-456",
    extensionId: "ext-789",
    packageType: "agent",
    displayName: "My Agent",
    version: "1.0.0",
    owner: "owner-abc",
    trustLevel: "enterprise",
    signatureVerified: true,
    lifecycleState: "published",
    reviewStatus: "approved",
    publicationStatus: "published",
    channel: "stable",
    reasonCodes: [],
    compatibility: {
      apiContract: "v1",
      permissionSurface: "v1",
      runtimeCapability: "v1",
    },
    capabilities: ["task-execution"],
    permissions: ["read"],
  };

  assert.equal(entry.packageType, "agent");
  assert.equal(entry.reviewStatus, "approved");
  assert.equal(entry.publicationStatus, "published");
});

test("MarketplaceCatalogSummary calculates correct totals", () => {
  const summary: MarketplaceCatalogSummary = {
    packagesReady: 10,
    reviewPending: 3,
    blocked: 2,
    revoked: 1,
    total: 16,
    overallVerdict: "partial",
  };

  assert.equal(summary.packagesReady, 10);
  assert.equal(summary.total, 16);
  assert.equal(summary.overallVerdict, "partial");
});

test("MarketplaceCatalogSummary overallVerdict can be ready", () => {
  const summary: MarketplaceCatalogSummary = {
    packagesReady: 20,
    reviewPending: 0,
    blocked: 0,
    revoked: 0,
    total: 20,
    overallVerdict: "ready",
  };

  assert.equal(summary.overallVerdict, "ready");
});

test("MarketplaceCatalogReport contains summary and entries", () => {
  const report: MarketplaceCatalogReport = {
    reportId: "rpt-123",
    generatedAt: "2024-01-15T10:00:00Z",
    tenantId: null,
    summary: {
      packagesReady: 5,
      reviewPending: 1,
      blocked: 0,
      revoked: 0,
      total: 6,
      overallVerdict: "ready",
    },
    entries: [],
  };

  assert.equal(report.reportId, "rpt-123");
  assert.equal(report.entries.length, 0);
});

test("MarketplaceGovernanceRunResult contains report and record", () => {
  const result: MarketplaceGovernanceRunResult = {
    report: {
      reportId: "rpt-123",
      generatedAt: "2024-01-15T10:00:00Z",
      tenantId: null,
      summary: {
        packagesReady: 5,
        reviewPending: 1,
        blocked: 0,
        revoked: 0,
        total: 6,
        overallVerdict: "ready",
      },
      entries: [],
    },
    record: {
      reportId: "rpt-123",
      generatedAt: "2024-01-15T10:00:00Z",
      tenantId: null,
      packagesReady: 5,
      reviewPending: 1,
      blocked: 0,
      revoked: 0,
      total: 6,
      overallVerdict: "ready",
    },
  };

  assert.ok(result.report);
  assert.ok(result.record);
});

test("MarketplaceGovernanceExportResult adds artifact references", () => {
  const result: MarketplaceGovernanceExportResult = {
    report: {
      reportId: "rpt-123",
      generatedAt: "2024-01-15T10:00:00Z",
      tenantId: null,
      summary: {
        packagesReady: 5,
        reviewPending: 1,
        blocked: 0,
        revoked: 0,
        total: 6,
        overallVerdict: "ready",
      },
      entries: [],
    },
    record: {
      reportId: "rpt-123",
      generatedAt: "2024-01-15T10:00:00Z",
      tenantId: null,
      packagesReady: 5,
      reviewPending: 1,
      blocked: 0,
      revoked: 0,
      total: 6,
      overallVerdict: "ready",
    },
    jsonArtifact: {
      artifactId: "art-001",
      artifactType: "application/json",
      uri: "s3://bucket/json-artifact.json",
      createdAt: "2024-01-15T10:00:00Z",
    },
    markdownArtifact: {
      artifactId: "art-002",
      artifactType: "text/markdown",
      uri: "s3://bucket/markdown-artifact.md",
      createdAt: "2024-01-15T10:00:00Z",
    },
  };

  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.equal(result.jsonArtifact.artifactType, "application/json");
});

test("MarketplaceGovernanceServiceOptions accepts optional artifact store options", () => {
  const options: MarketplaceGovernanceServiceOptions = {
    artifactStoreOptions: {
      basePath: "/tmp/artifacts",
      maxSizeBytes: 1024 * 1024 * 1024,
    },
  };

  assert.ok(options.artifactStoreOptions);
  assert.equal(options.artifactStoreOptions.basePath, "/tmp/artifacts");
});