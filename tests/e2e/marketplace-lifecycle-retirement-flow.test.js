import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { MarketplaceGovernanceService } from "../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
test("E2E: marketplace lifecycle transitions from published to deprecated to retired and exports the retired catalog", () => {
    const harness = createE2EHarness("aa-e2e-marketplace-lifecycle-");
    const artifactRoot = join(harness.workspace, "artifacts");
    try {
        const governance = new MarketplaceGovernanceService(harness.db, harness.store, {
            artifactStoreOptions: {
                rootDir: artifactRoot,
            },
        });
        const source = "export function activate(){ return 'lifecycle'; }";
        const checksum = createHash("sha256").update(source, "utf8").digest("hex");
        const packageRecord = governance.registerExtensionPackage({
            packageId: "pkg-marketplace-lifecycle",
            tenantId: "tenant-marketplace-lifecycle",
            extensionId: "plugin.marketplace.lifecycle",
            packageType: "plugin",
            displayName: "Marketplace Lifecycle Plugin",
            version: "1.1.0",
            owner: "ecosystem.lifecycle.team",
            trustLevel: "verified",
            sourceUri: "registry://plugins/marketplace-lifecycle",
            capabilities: ["catalog_export", "retirement_audit"],
            permissions: ["read.catalog"],
            compatibility: {
                apiContract: "^1.0.0",
                permissionSurface: "^1.0.0",
                runtimeCapability: "^1.0.0",
            },
            signatureVerified: true,
            manifestChecksum: checksum,
        });
        const review = governance.submitReview({
            reviewId: "review-marketplace-lifecycle",
            tenantId: packageRecord.tenantId,
            packageId: packageRecord.packageId,
            submitter: "submitter.lifecycle",
            findings: [],
        });
        governance.decideReview({
            reviewId: review.reviewId,
            tenantId: packageRecord.tenantId,
            status: "approved",
            reviewer: "review.lifecycle.board",
            decisionReasonCode: "approved_for_publish",
            findings: ["ready_for_lifecycle_validation"],
        });
        const publication = governance.publishPackage({
            publicationId: "pub-marketplace-lifecycle",
            tenantId: packageRecord.tenantId,
            packageId: packageRecord.packageId,
            reviewId: review.reviewId,
            channel: "marketplace_public",
        });
        const deprecated = governance.deprecatePackage({
            tenantId: packageRecord.tenantId,
            packageId: packageRecord.packageId,
            reasonCode: "lifecycle_deprecated",
            deprecatedAt: "2026-04-24T13:00:00.000Z",
        });
        const retired = governance.retirePackage({
            tenantId: packageRecord.tenantId,
            packageId: packageRecord.packageId,
            reasonCode: "lifecycle_retired",
            retiredAt: "2026-04-24T13:10:00.000Z",
        });
        const exported = governance.exportCatalog("2026-04-24T13:15:00.000Z", packageRecord.tenantId);
        const publicationRecord = governance.listPublications(10, packageRecord.tenantId)[0];
        const jsonArtifact = JSON.parse(readFileSync(exported.jsonArtifact.uri, "utf8"));
        const markdownArtifact = readFileSync(exported.markdownArtifact.uri, "utf8");
        const lifecycleEntry = jsonArtifact.entries.find((entry) => entry.packageId === packageRecord.packageId);
        assert.equal(publication.status, "published");
        assert.equal(deprecated.lifecycleState, "deprecated");
        assert.equal(retired.lifecycleState, "retired");
        assert.equal(publicationRecord?.status, "retired");
        assert.equal(publicationRecord?.revocationReasonCode, "lifecycle_retired");
        assert.equal(jsonArtifact.summary.revoked, 1);
        assert.equal(jsonArtifact.summary.blocked, 1);
        assert.equal(jsonArtifact.summary.overallVerdict, "blocked");
        assert.equal(lifecycleEntry?.publicationStatus, "retired");
        assert.equal(lifecycleEntry?.lifecycleState, "retired");
        assert.ok(lifecycleEntry?.reasonCodes.includes("revoked:lifecycle_retired"));
        assert.ok(lifecycleEntry?.reasonCodes.includes("lifecycle_retired"));
        assert.ok(markdownArtifact.includes("plugin.marketplace.lifecycle@1.1.0"));
        assert.ok(markdownArtifact.includes("retired"));
        assert.ok(exported.jsonArtifact.uri.startsWith(artifactRoot));
        assert.ok(exported.markdownArtifact.uri.startsWith(artifactRoot));
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=marketplace-lifecycle-retirement-flow.test.js.map