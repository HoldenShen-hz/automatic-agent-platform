import assert from "node:assert/strict";
import test from "node:test";
import { PackLifecycleOrchestrationService, validateBusinessPackManifest, } from "../../../src/sdk/index.js";
test("integration: pack lifecycle orchestration combines api diff, compatibility certification, rollout, and deprecation", () => {
    const service = new PackLifecycleOrchestrationService();
    const baseManifest = validateBusinessPackManifest({
        packId: "market-ops-pack",
        version: "1.2.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
            { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
            { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
        ],
    });
    const nextManifest = validateBusinessPackManifest({
        packId: "market-ops-pack",
        version: "2.0.0",
        domain: "operations",
        owner: "ops@example.com",
        capabilities: [
            { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
            { capabilityKey: "external.github.workflow", maturity: "ga", requiredContracts: ["tool_skill_plugin_contract"] },
            { capabilityKey: "domain.observe", maturity: "beta", requiredContracts: ["runtime_execution_contract"] },
        ],
    });
    service.registerPack({
        manifest: baseManifest,
        owner: "ops@example.com",
        evalDatasetIds: ["dataset_market_ops_v1_2"],
    });
    const candidate = service.registerPack({
        manifest: nextManifest,
        owner: "ops@example.com",
        evalDatasetIds: ["dataset_market_ops_v2"],
        previousManifest: baseManifest,
        declaredDeprecationWarnings: 2,
    });
    service.recordTesting({
        packId: "market-ops-pack",
        version: "2.0.0",
        coveragePercent: 96,
        mockTestsPassed: true,
        stagingIntegrationPassed: true,
        evalPassed: true,
        reportRef: "artifact://tests/market-ops-pack-v2",
    });
    const certified = service.certifyPack({
        packId: "market-ops-pack",
        version: "2.0.0",
        reviewer: "reviewer@example.com",
        certificationReportRef: "artifact://certs/market-ops-pack-v2",
        selectedLicenseTier: "professional",
        pluginIds: ["plugin.operations.retriever", "plugin.shared.github_adapter"],
        securityReviewPassed: true,
        riskReviewPassed: true,
    });
    const published = service.publishPack({
        packId: "market-ops-pack",
        version: "2.0.0",
        strategy: "ga",
        owner: "release@example.com",
        rolloutScope: ["marketplace_public", "tenant_canary"],
        autoActivate: true,
    });
    const deprecated = service.deprecatePack({
        packId: "market-ops-pack",
        version: "2.0.0",
        owner: "ops@example.com",
        migrationGuideRef: "docs://migration/market-ops-pack-v2",
        effectiveAt: "2026-04-20T00:00:00.000Z",
        supportWindowDays: 365,
    });
    assert.equal(candidate.apiChange.changeType, "additive");
    assert.equal(candidate.apiChange.deprecationWarningsSatisfied, true);
    assert.equal(certified.certification?.compatibility.verdict, "compatible");
    assert.equal(published.rollout?.status, "active");
    assert.deepEqual(published.rollout?.rolloutScope, ["marketplace_public", "tenant_canary"]);
    assert.equal(deprecated.deprecation?.status, "active");
    assert.equal(service.listPacks().length, 2);
});
//# sourceMappingURL=pack-lifecycle-orchestration-integration.test.js.map