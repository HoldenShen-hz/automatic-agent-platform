import assert from "node:assert/strict";
import test from "node:test";
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

function createSummary(overrides: Partial<MarketplaceCatalogSummary> = {}): MarketplaceCatalogSummary {
  return {
    packagesReady: 5,
    reviewPending: 1,
    blocked: 0,
    revoked: 0,
    total: 6,
    overallVerdict: "ready",
    ...overrides,
  };
}

function createReport(overrides: Partial<MarketplaceCatalogReport> = {}): MarketplaceCatalogReport {
  return {
    reportId: "rpt-123",
    generatedAt: "2024-01-15T10:00:00Z",
    tenantId: null,
    summary: createSummary(),
    entries: [],
    ...overrides,
  };
}

test("RegisterExtensionPackageInput accepts valid input [marketplace-governance-types]", () => {
  const input: RegisterExtensionPackageInput = {
    extensionId: "ext-123",
    packageType: "plugin",
    displayName: "Test Plugin",
    version: "1.0.0",
    owner: "test-owner",
    trustLevel: "verified",
    sourceUri: "https://example.com/plugin.tar.gz",
    capabilities: ["knowledge.retrieve"],
    permissions: ["read"],
    compatibility: {
      apiContract: "v1",
      permissionSurface: "v1",
      runtimeCapability: "v1",
    },
    signatureVerified: true,
    manifestChecksum: "abc123def456",
    lifecycleState: "discovered",
  };

  assert.equal(input.extensionId, "ext-123");
  assert.equal(input.packageType, "plugin");
  assert.equal(input.signatureVerified, true);
  assert.ok(!input.sbomVerified);
});

test("SubmitMarketplaceReviewInput accepts valid input [marketplace-governance-types]", () => {
  const input: SubmitMarketplaceReviewInput = {
    packageId: "pkg-123",
    submitter: "test-user",
    findings: ["Minor security concern"],
  };

  assert.equal(input.packageId, "pkg-123");
  assert.equal(input.submitter, "test-user");
  assert.equal(input.findings?.length, 1);
});

test("DecideMarketplaceReviewInput accepts approved status [marketplace-governance-types]", () => {
  const input: DecideMarketplaceReviewInput = {
    reviewId: "review-123",
    status: "approved",
    reviewer: "admin-user",
    decisionReasonCode: "marketplace.approved",
  };

  assert.equal(input.status, "approved");
  assert.equal(input.decisionReasonCode, "marketplace.approved");
});

test("DecideMarketplaceReviewInput accepts rejected status [marketplace-governance-types]", () => {
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

test("PublishExtensionInput accepts valid input [marketplace-governance-types]", () => {
  const input: PublishExtensionInput = {
    packageId: "pkg-123",
    reviewId: "review-123",
    channel: "stable",
    publishedAt: "2024-01-15T10:00:00Z",
  };

  assert.equal(input.packageId, "pkg-123");
  assert.equal(input.channel, "stable");
});

test("RevokeExtensionInput accepts valid input [marketplace-governance-types]", () => {
  const input: RevokeExtensionInput = {
    publicationId: "pub-123",
    reasonCode: "marketplace.critical_security",
    revokedAt: "2024-01-15T10:00:00Z",
  };

  assert.equal(input.reasonCode, "marketplace.critical_security");
});

test("DeprecateExtensionInput accepts valid input with migration target [marketplace-governance-types]", () => {
  const input: DeprecateExtensionInput = {
    packageId: "pkg-123",
    reasonCode: "marketplace.superseded",
    migrationTarget: "pkg-456",
    replacementSuggestions: ["pkg-456", "pkg-789"],
  };

  assert.equal(input.migrationTarget, "pkg-456");
  assert.equal(input.replacementSuggestions?.length, 2);
});

test("SunsetExtensionInput accepts threshold conditions [marketplace-governance-types]", () => {
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
  assert.equal(input.thresholdConditions?.[0]?.severityThreshold, "critical");
});

test("RetireExtensionInput accepts migration completion ratio [marketplace-governance-types]", () => {
  const input: RetireExtensionInput = {
    packageId: "pkg-123",
    reasonCode: "marketplace.retired",
    migrationCompletionRatio: 0.95,
  };

  assert.equal(input.migrationCompletionRatio, 0.95);
});

test("MarketplaceCatalogEntry captures full marketplace state [marketplace-governance-types]", () => {
  const entry: MarketplaceCatalogEntry = {
    packageId: "pkg-123",
    tenantId: "tenant-456",
    extensionId: "ext-789",
    packageType: "plugin",
    displayName: "My Plugin",
    version: "1.0.0",
    owner: "owner-abc",
    trustLevel: "verified",
    signatureVerified: true,
    lifecycleState: "enabled",
    reviewStatus: "approved",
    publicationStatus: "published",
    channel: "stable",
    reasonCodes: [],
    compatibility: {
      apiContract: "v1",
      permissionSurface: "v1",
      runtimeCapability: "v1",
    },
    capabilities: ["knowledge.retrieve"],
    permissions: ["read"],
  };

  assert.equal(entry.packageType, "plugin");
  assert.equal(entry.reviewStatus, "approved");
  assert.equal(entry.publicationStatus, "published");
});

test("MarketplaceCatalogSummary calculates correct totals [marketplace-governance-types]", () => {
  const summary = createSummary({
    packagesReady: 10,
    reviewPending: 3,
    blocked: 2,
    revoked: 1,
    total: 16,
    overallVerdict: "partial",
  });

  assert.equal(summary.packagesReady, 10);
  assert.equal(summary.total, 16);
  assert.equal(summary.overallVerdict, "partial");
});

test("MarketplaceCatalogSummary overallVerdict can be ready [marketplace-governance-types]", () => {
  const summary = createSummary({
    packagesReady: 20,
    reviewPending: 0,
    blocked: 0,
    revoked: 0,
    total: 20,
    overallVerdict: "ready",
  });

  assert.equal(summary.overallVerdict, "ready");
});

test("MarketplaceCatalogReport contains summary and entries [marketplace-governance-types]", () => {
  const report = createReport();

  assert.equal(report.reportId, "rpt-123");
  assert.equal(report.entries.length, 0);
});

test("MarketplaceGovernanceRunResult contains report and record [marketplace-governance-types]", () => {
  const report = createReport();
  const result: MarketplaceGovernanceRunResult = {
    report,
    record: {
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      tenantId: report.tenantId,
      summaryJson: JSON.stringify(report.summary),
      reportJson: JSON.stringify(report),
    },
  };

  assert.ok(result.report);
  assert.ok(result.record);
  assert.equal(result.record.reportId, "rpt-123");
});

test("MarketplaceGovernanceExportResult adds artifact references [marketplace-governance-types]", () => {
  const report = createReport();
  const result: MarketplaceGovernanceExportResult = {
    report,
    record: {
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      tenantId: report.tenantId,
      summaryJson: JSON.stringify(report.summary),
      reportJson: JSON.stringify(report),
    },
    jsonArtifact: {
      artifactId: "art-001",
      kind: "marketplace_governance_report",
      mimeType: "application/json",
      uri: "s3://bucket/json-artifact.json",
      createdAt: "2024-01-15T10:00:00Z",
    },
    markdownArtifact: {
      artifactId: "art-002",
      kind: "marketplace_governance_report",
      mimeType: "text/markdown",
      uri: "s3://bucket/markdown-artifact.md",
      createdAt: "2024-01-15T10:00:00Z",
    },
  };

  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.equal(result.jsonArtifact.mimeType, "application/json");
});

test("MarketplaceGovernanceServiceOptions accepts optional artifact store options [marketplace-governance-types]", () => {
  const options: MarketplaceGovernanceServiceOptions = {
    artifactStoreOptions: {
      rootDir: "/tmp/artifacts",
    },
  };

  assert.ok(options.artifactStoreOptions);
  assert.equal(options.artifactStoreOptions.rootDir, "/tmp/artifacts");
});
