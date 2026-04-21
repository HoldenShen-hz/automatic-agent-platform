import assert from "node:assert/strict";
import test from "node:test";

import { MarketplaceGovernanceService } from "../../../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import type {
  ExtensionPackageRecord,
  MarketplacePublicationRecord,
} from "../../../../src/platform/contracts/types/domain.js";

function createHarness() {
  const packages = new Map<string, ExtensionPackageRecord>();
  const publications = new Map<string, MarketplacePublicationRecord>();

  const store = {
    marketplace: {
      getExtensionPackage(packageId: string) {
        return packages.get(packageId) ?? null;
      },
      upsertExtensionPackage(record: ExtensionPackageRecord) {
        packages.set(record.packageId, record);
      },
      getActiveMarketplacePublicationForPackage(packageId: string) {
        return [...publications.values()].find((item) => item.packageId === packageId && item.status === "published") ?? null;
      },
      upsertMarketplacePublication(record: MarketplacePublicationRecord) {
        publications.set(record.publicationId, record);
      },
      listMarketplacePublications() {
        return [...publications.values()];
      },
    },
  } as any;

  const service = new MarketplaceGovernanceService({} as any, store);
  const pkg: ExtensionPackageRecord = {
    packageId: "pkg_lifecycle",
    tenantId: null,
    extensionId: "plugin.lifecycle-aware",
    packageType: "plugin",
    displayName: "Lifecycle Aware Plugin",
    version: "1.0.0",
    owner: "ecosystem.team",
    trustLevel: "verified",
    sourceUri: "registry://plugins/lifecycle-aware",
    capabilitiesJson: JSON.stringify(["catalog_export"]),
    permissionsJson: JSON.stringify(["read.catalog"]),
    compatibilityJson: JSON.stringify({
      apiContract: "^1.0.0",
      permissionSurface: "^1.0.0",
      runtimeCapability: "^1.0.0",
    }),
    signatureVerified: 1,
    manifestChecksum: "e".repeat(64),
    lifecycleState: "enabled",
    reviewRequired: 1,
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
  const publication: MarketplacePublicationRecord = {
    publicationId: "pub_lifecycle",
    tenantId: null,
    packageId: pkg.packageId,
    reviewId: "review_1",
    channel: "marketplace_public",
    status: "published",
    compatibilityMatrixJson: pkg.compatibilityJson,
    revocationReasonCode: null,
    publishedAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  };
  packages.set(pkg.packageId, pkg);
  publications.set(publication.publicationId, publication);

  return { service, packages, publications };
}

test("MarketplaceGovernanceService deprecates and retires packages without database backing", () => {
  const { service, packages, publications } = createHarness();
  const deprecated = service.deprecatePackage({
    packageId: "pkg_lifecycle",
    reasonCode: "lifecycle.sunset",
  });
  assert.equal(deprecated.lifecycleState, "deprecated");
  assert.equal(packages.get("pkg_lifecycle")?.lifecycleState, "deprecated");
  assert.equal(publications.get("pub_lifecycle")?.status, "deprecated");

  const retired = service.retirePackage({
    packageId: "pkg_lifecycle",
    reasonCode: "lifecycle.retired",
  });
  assert.equal(retired.lifecycleState, "retired");
  assert.equal(packages.get("pkg_lifecycle")?.lifecycleState, "retired");
  assert.equal(publications.get("pub_lifecycle")?.status, "retired");
});
