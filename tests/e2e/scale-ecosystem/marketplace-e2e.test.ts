import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { MarketplaceGovernanceService } from "../../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";

function sha256Like(seed: string): string {
  return seed.repeat(Math.ceil(64 / seed.length)).slice(0, 64);
}

test("E2E Marketplace: package moves through review and publication", () => {
  const harness = createE2EHarness("aa-e2e-marketplace-governance-");
  try {
    const service = new MarketplaceGovernanceService(harness.db, harness.store);
    const pkg = service.registerExtensionPackage({
      packageId: "pkg-marketplace-001",
      extensionId: "ext-marketplace",
      packageType: "plugin",
      displayName: "Marketplace E2E Plugin",
      version: "1.0.0",
      owner: "platform_owner",
      trustLevel: "verified",
      sourceUri: "pkg://marketplace/e2e",
      capabilities: ["publish", "sync"],
      permissions: ["read_config"],
      compatibility: {
        apiContract: "v1",
        permissionSurface: "standard",
        runtimeCapability: "general",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: sha256Like("ab"),
    });
    const review = service.submitReview({
      packageId: pkg.packageId,
      submitter: "review_submitter",
    });
    service.decideReview({
      reviewId: review.reviewId,
      status: "approved",
      reviewer: "reviewer_1",
      decisionReasonCode: "security_review_passed",
    });
    const publication = service.publishPackage({
      packageId: pkg.packageId,
      channel: "stable",
    });

    assert.equal(publication.status, "published");
    assert.equal(service.listPublications().length, 1);
  } finally {
    harness.cleanup();
  }
});

test("E2E Marketplace: deprecated and sunset packages are reflected in the catalog", () => {
  const harness = createE2EHarness("aa-e2e-marketplace-catalog-");
  try {
    const service = new MarketplaceGovernanceService(harness.db, harness.store);
    const pkg = service.registerExtensionPackage({
      packageId: "pkg-marketplace-002",
      extensionId: "ext-marketplace-catalog",
      packageType: "plugin",
      displayName: "Catalog E2E Plugin",
      version: "1.1.0",
      owner: "platform_owner",
      trustLevel: "internal",
      sourceUri: "pkg://marketplace/catalog",
      capabilities: ["catalog"],
      permissions: ["read_config"],
      compatibility: {
        apiContract: "v1",
        permissionSurface: "standard",
        runtimeCapability: "general",
      },
      signatureVerified: true,
      sbomVerified: true,
      sandboxCertVerified: true,
      egressPolicyCompliant: true,
      manifestChecksum: sha256Like("cd"),
      reviewRequired: false,
    });
    service.publishPackage({ packageId: pkg.packageId, channel: "stable" });
    service.deprecatePackage({
      packageId: pkg.packageId,
      reasonCode: "superseded",
      migrationTarget: "ext-marketplace-catalog-v2",
    });
    service.sunsetPackage({
      packageId: pkg.packageId,
      reasonCode: "sunset_started",
      sunsetAt: "2026-01-01T00:00:00.000Z",
      endOfLifeAt: "2026-08-01T00:00:00.000Z",
    });

    const { report } = service.buildCatalog();
    const entry = report.entries.find((item) => item.packageId === pkg.packageId);
    assert.ok(entry);
    assert.equal(entry!.lifecycleState, "sunset");
    assert.equal(entry!.publicationStatus, "sunset");
  } finally {
    harness.cleanup();
  }
});
