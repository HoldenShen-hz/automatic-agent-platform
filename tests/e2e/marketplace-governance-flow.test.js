import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join } from "node:path";
import test from "node:test";
import { PolicyDeniedError } from "../../src/platform/contracts/errors.js";
import { MarketplaceGovernanceService } from "../../src/scale-ecosystem/marketplace/marketplace-governance-service.js";
import { PackSecurityService } from "../../src/scale-ecosystem/marketplace/pack-security-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
test("E2E: marketplace governance turns security-reviewed packages into publications and reports blocked ones", async () => {
    const harness = createE2EHarness("aa-e2e-marketplace-");
    const artifactRoot = join(harness.workspace, "artifacts");
    try {
        const governance = new MarketplaceGovernanceService(harness.db, harness.store, {
            artifactStoreOptions: {
                rootDir: artifactRoot,
            },
        });
        const security = new PackSecurityService();
        const safeInlineSource = "export function activate(){ return 'ok'; }";
        const safeChecksum = createHash("sha256").update(safeInlineSource, "utf8").digest("hex");
        const safeScan = await security.runSecurityScan({
            packId: "pkg-marketplace-safe",
            version: "1.0.0",
            sourceUri: "registry://plugins/marketplace-safe",
            manifestChecksum: safeChecksum,
            capabilities: ["audit_export", "incident_console"],
            permissions: ["read.audit"],
        });
        assert.equal(safeScan.status, "passed");
        const safePackage = governance.registerExtensionPackage({
            packageId: "pkg-marketplace-safe",
            tenantId: "tenant-marketplace",
            extensionId: "plugin.marketplace.safe",
            packageType: "plugin",
            displayName: "Marketplace Safe Plugin",
            version: "1.0.0",
            owner: "ecosystem.team",
            trustLevel: "verified",
            sourceUri: "registry://plugins/marketplace-safe",
            capabilities: ["audit_export", "incident_console"],
            permissions: ["read.audit"],
            compatibility: {
                apiContract: "^1.0.0",
                permissionSurface: "^1.0.0",
                runtimeCapability: "^1.0.0",
            },
            signatureVerified: true,
            manifestChecksum: safeChecksum,
        });
        const review = governance.submitReview({
            reviewId: "review-marketplace-safe",
            tenantId: "tenant-marketplace",
            packageId: safePackage.packageId,
            submitter: "submitter.marketplace",
            findings: safeScan.issues.map((issue) => issue.code),
        });
        const approved = governance.decideReview({
            reviewId: review.reviewId,
            tenantId: "tenant-marketplace",
            status: "approved",
            reviewer: "review.board",
            decisionReasonCode: "approved_for_publish",
            findings: ["security_scan_passed"],
        });
        const publication = governance.publishPackage({
            publicationId: "pub-marketplace-safe",
            tenantId: "tenant-marketplace",
            packageId: safePackage.packageId,
            reviewId: review.reviewId,
            channel: "marketplace_public",
        });
        const riskyInlineSource = "eval(userInput);";
        const riskyChecksum = createHash("sha256").update(riskyInlineSource, "utf8").digest("hex");
        const riskyScan = await security.runSecurityScan({
            packId: "pkg-marketplace-risky",
            version: "2.0.0",
            sourceUri: "registry://plugins/marketplace-risky",
            manifestChecksum: riskyChecksum,
            capabilities: ["exec"],
            permissions: ["exec:bash", "network:egress:all"],
        });
        assert.equal(riskyScan.status, "failed");
        const riskyPackage = governance.registerExtensionPackage({
            packageId: "pkg-marketplace-risky",
            tenantId: "tenant-marketplace",
            extensionId: "plugin.marketplace.risky",
            packageType: "plugin",
            displayName: "Marketplace Risky Plugin",
            version: "2.0.0",
            owner: "ecosystem.team",
            trustLevel: "verified",
            sourceUri: "registry://plugins/marketplace-risky",
            capabilities: ["exec"],
            permissions: ["exec:bash", "network:egress:all"],
            compatibility: {
                apiContract: "^1.0.0",
                permissionSurface: "^1.0.0",
                runtimeCapability: "^1.0.0",
            },
            signatureVerified: false,
            manifestChecksum: riskyChecksum,
        });
        let blockedPublicationError = null;
        try {
            governance.publishPackage({
                tenantId: "tenant-marketplace",
                packageId: riskyPackage.packageId,
                channel: "marketplace_public",
            });
        }
        catch (error) {
            blockedPublicationError = error;
        }
        assert.ok(blockedPublicationError instanceof PolicyDeniedError);
        assert.equal(blockedPublicationError.code, "marketplace.review_required");
        const catalog = governance.buildCatalog("2026-04-24T12:30:00.000Z", "tenant-marketplace");
        assert.equal(catalog.report.summary.total, 2);
        assert.equal(catalog.report.summary.packagesReady, 1);
        assert.equal(catalog.report.summary.blocked, 1);
        assert.equal(catalog.report.summary.overallVerdict, "blocked");
        const safeEntry = catalog.report.entries.find((entry) => entry.packageId === safePackage.packageId);
        const riskyEntry = catalog.report.entries.find((entry) => entry.packageId === riskyPackage.packageId);
        assert.deepEqual(safeEntry?.reasonCodes, []);
        assert.ok(riskyEntry?.reasonCodes.includes("review_missing"));
        assert.ok(riskyEntry?.reasonCodes.includes("signature_missing"));
        const exported = governance.exportCatalog("2026-04-24T12:31:00.000Z", "tenant-marketplace");
        assert.ok(exported.jsonArtifact.uri.startsWith(artifactRoot));
        assert.ok(exported.markdownArtifact.uri.startsWith(artifactRoot));
        const revoked = governance.revokePublication({
            publicationId: publication.publicationId,
            tenantId: "tenant-marketplace",
            reasonCode: "security_recall",
        });
        assert.equal(approved.status, "approved");
        assert.equal(revoked.status, "revoked");
        assert.equal(governance.listPackages(10, "tenant-marketplace").length, 2);
        assert.equal(governance.listReviews(10, "tenant-marketplace").length, 1);
        assert.equal(governance.listPublications(10, "tenant-marketplace").length, 1);
        assert.ok(governance.listReports(10, "tenant-marketplace").length >= 2);
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=marketplace-governance-flow.test.js.map