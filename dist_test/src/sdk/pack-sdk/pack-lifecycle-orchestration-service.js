import { ValidationError } from "../../platform/contracts/errors.js";
import { PackPluginCompatibilityService, } from "./pack-plugin-compatibility-service.js";
import { validateBusinessPackManifest, } from "./pack-manifest.js";
export class PackLifecycleOrchestrationService {
    compatibility;
    records = new Map();
    constructor(compatibility = new PackPluginCompatibilityService()) {
        this.compatibility = compatibility;
    }
    registerPack(input) {
        const manifest = validateBusinessPackManifest(input.manifest);
        const key = recordKey(manifest.packId, manifest.version);
        if (this.records.has(key)) {
            throw new ValidationError(`pack_lifecycle.already_registered:${manifest.packId}@${manifest.version}`, `Business pack ${manifest.packId}@${manifest.version} is already registered.`);
        }
        const createdAt = normalizeTimestamp(input.createdAt);
        const apiChange = buildApiChangeSummary(input.previousManifest == null ? null : validateBusinessPackManifest(input.previousManifest), manifest, input.declaredDeprecationWarnings ?? 0);
        const findings = [
            ...(input.evalDatasetIds == null || input.evalDatasetIds.length === 0 ? ["pack_lifecycle.eval_dataset_missing"] : []),
            ...(!apiChange.deprecationWarningsSatisfied ? ["pack_lifecycle.deprecation_warning_missing"] : []),
        ];
        const record = {
            packId: manifest.packId,
            version: manifest.version,
            owner: input.owner.trim(),
            manifest,
            lifecycleStage: "development",
            createdAt,
            updatedAt: createdAt,
            evalDatasetIds: [...new Set((input.evalDatasetIds ?? []).map((item) => item.trim()).filter((item) => item.length > 0))],
            apiChange,
            testing: null,
            certification: null,
            rollout: null,
            deprecation: null,
            findings,
        };
        this.records.set(key, record);
        return cloneRecord(record);
    }
    recordTesting(input) {
        const record = this.getMutableRecord(input.packId, input.version);
        assertLifecycleStage(record, ["development", "testing"]);
        const findings = [
            ...(input.coveragePercent >= 80 ? [] : ["pack_lifecycle.coverage_below_threshold"]),
            ...(input.mockTestsPassed ? [] : ["pack_lifecycle.mock_tests_failed"]),
            ...(input.stagingIntegrationPassed ? [] : ["pack_lifecycle.staging_integration_failed"]),
            ...(input.evalPassed ? [] : ["pack_lifecycle.eval_gate_failed"]),
        ];
        record.testing = {
            coveragePercent: roundPercent(input.coveragePercent),
            mockTestsPassed: input.mockTestsPassed,
            stagingIntegrationPassed: input.stagingIntegrationPassed,
            evalPassed: input.evalPassed,
            reportRef: input.reportRef.trim(),
            recordedAt: normalizeTimestamp(input.recordedAt),
            verdict: findings.length === 0 ? "passed" : "failed",
            findings,
        };
        record.lifecycleStage = "testing";
        record.updatedAt = record.testing.recordedAt;
        record.findings = mergeFindings(record, findings);
        return cloneRecord(record);
    }
    certifyPack(input) {
        const record = this.getMutableRecord(input.packId, input.version);
        assertLifecycleStage(record, ["testing", "certified"]);
        if (record.testing?.verdict !== "passed") {
            throw new ValidationError(`pack_lifecycle.testing_not_passed:${record.packId}@${record.version}`, `Business pack ${record.packId}@${record.version} requires a passing test report before certification.`);
        }
        const compatibility = this.compatibility.evaluateManifest({
            manifest: record.manifest,
            selectedLicenseTier: input.selectedLicenseTier,
            pluginIds: input.pluginIds,
        });
        const findings = [
            ...(input.securityReviewPassed ? [] : ["pack_lifecycle.security_review_failed"]),
            ...(input.riskReviewPassed ? [] : ["pack_lifecycle.risk_review_failed"]),
            ...(compatibility.verdict === "compatible" ? [] : compatibility.verdict === "license_blocked"
                ? ["pack_lifecycle.license_blocked"]
                : ["pack_lifecycle.compatibility_blocked"]),
            ...compatibility.missingPluginCapabilities.map((capabilityKey) => `pack_lifecycle.missing_plugin:${capabilityKey}`),
            ...compatibility.blockedByLicense.map((capabilityKey) => `pack_lifecycle.license_capability:${capabilityKey}`),
        ];
        const certifiedAt = normalizeTimestamp(input.certifiedAt);
        record.certification = {
            reviewer: input.reviewer.trim(),
            certificationReportRef: input.certificationReportRef.trim(),
            selectedLicenseTier: input.selectedLicenseTier,
            pluginIds: compatibility.selectedPlugins.map((plugin) => plugin.pluginId),
            securityReviewPassed: input.securityReviewPassed,
            riskReviewPassed: input.riskReviewPassed,
            certifiedAt,
            compatibility,
            verdict: findings.length === 0 ? "certified" : "blocked",
            findings,
        };
        record.lifecycleStage = findings.length === 0 ? "certified" : "testing";
        record.updatedAt = certifiedAt;
        record.findings = mergeFindings(record, findings);
        return cloneRecord(record);
    }
    publishPack(input) {
        const record = this.getMutableRecord(input.packId, input.version);
        assertLifecycleStage(record, ["certified", "published", "running"]);
        if (record.certification?.verdict !== "certified") {
            throw new ValidationError(`pack_lifecycle.not_certified:${record.packId}@${record.version}`, `Business pack ${record.packId}@${record.version} must be certified before publication.`);
        }
        const findings = [
            ...(input.strategy === "ga" && record.apiChange.changeType === "breaking" && record.deprecation == null
                ? ["pack_lifecycle.ga_requires_deprecation_notice"]
                : []),
        ];
        const publishedAt = normalizeTimestamp(input.publishedAt);
        record.rollout = {
            rolloutId: buildRolloutId(record.packId, record.version),
            strategy: input.strategy,
            owner: input.owner.trim(),
            rolloutScope: [...new Set((input.rolloutScope ?? ["marketplace_public"]).map((item) => item.trim()).filter((item) => item.length > 0))],
            createdAt: publishedAt,
            activatedAt: findings.length === 0 && input.autoActivate === true ? publishedAt : null,
            status: findings.length > 0 ? "blocked" : input.autoActivate === true ? "active" : "ready",
            findings,
        };
        record.lifecycleStage = record.rollout.status === "active" ? "running" : findings.length > 0 ? "certified" : "published";
        record.updatedAt = publishedAt;
        record.findings = mergeFindings(record, findings);
        return cloneRecord(record);
    }
    deprecatePack(input) {
        const record = this.getMutableRecord(input.packId, input.version);
        assertLifecycleStage(record, ["certified", "published", "running", "deprecated"]);
        if (input.supportWindowDays < 180) {
            throw new ValidationError(`pack_lifecycle.support_window_too_short:${record.packId}@${record.version}`, `Business pack ${record.packId}@${record.version} must provide at least 180 days of support during deprecation.`);
        }
        const deprecatedAt = normalizeTimestamp(input.deprecatedAt);
        const effectiveAt = normalizeTimestamp(input.effectiveAt);
        record.deprecation = {
            owner: input.owner.trim(),
            migrationGuideRef: input.migrationGuideRef.trim(),
            effectiveAt,
            supportWindowDays: input.supportWindowDays,
            createdAt: deprecatedAt,
            status: new Date(effectiveAt).getTime() <= new Date(deprecatedAt).getTime() ? "active" : "scheduled",
        };
        record.lifecycleStage = "deprecated";
        record.updatedAt = deprecatedAt;
        record.findings = mergeFindings(record, []);
        return cloneRecord(record);
    }
    archivePack(packId, version) {
        const record = this.getMutableRecord(packId, version);
        if (record.lifecycleStage !== "deprecated") {
            throw new ValidationError(`pack_lifecycle.archive_requires_deprecated:${record.packId}@${record.version}`, `Business pack ${record.packId}@${record.version} can only be archived from deprecated state.`);
        }
        record.lifecycleStage = "archived";
        record.updatedAt = normalizeTimestamp();
        return cloneRecord(record);
    }
    getPack(packId, version) {
        const record = this.records.get(recordKey(packId, version));
        return record == null ? null : cloneRecord(record);
    }
    listPacks() {
        return [...this.records.values()]
            .map((record) => cloneRecord(record))
            .sort((left, right) => left.packId.localeCompare(right.packId) || left.version.localeCompare(right.version));
    }
    getMutableRecord(packId, version) {
        const record = this.records.get(recordKey(packId, version));
        if (record == null) {
            throw new ValidationError(`pack_lifecycle.not_found:${packId}@${version}`, `Business pack ${packId}@${version} was not found.`);
        }
        return record;
    }
}
function buildApiChangeSummary(previousManifest, candidateManifest, declaredDeprecationWarnings) {
    if (previousManifest == null) {
        return {
            changeType: "initial",
            previousVersion: null,
            addedCapabilities: candidateManifest.capabilities.map((capability) => capability.capabilityKey).sort(),
            removedCapabilities: [],
            addedContracts: uniqueContracts(candidateManifest.capabilities),
            removedContracts: [],
            requiresDeprecationWarnings: false,
            deprecationWarningsSatisfied: true,
        };
    }
    const previousCapabilities = new Map(previousManifest.capabilities.map((capability) => [capability.capabilityKey, capability]));
    const candidateCapabilities = new Map(candidateManifest.capabilities.map((capability) => [capability.capabilityKey, capability]));
    const addedCapabilities = [...candidateCapabilities.keys()].filter((capability) => !previousCapabilities.has(capability)).sort();
    const removedCapabilities = [...previousCapabilities.keys()].filter((capability) => !candidateCapabilities.has(capability)).sort();
    const addedContracts = uniqueContracts(candidateManifest.capabilities).filter((contract) => !uniqueContracts(previousManifest.capabilities).includes(contract));
    const removedContracts = uniqueContracts(previousManifest.capabilities).filter((contract) => !uniqueContracts(candidateManifest.capabilities).includes(contract));
    let changeType = "compatible";
    if (previousManifest.domain !== candidateManifest.domain
        || previousManifest.owner !== candidateManifest.owner
        || removedCapabilities.length > 0
        || removedContracts.length > 0
        || hasContractTightening(previousManifest.capabilities, candidateManifest.capabilities)) {
        changeType = "breaking";
    }
    else if (addedCapabilities.length > 0 || addedContracts.length > 0) {
        changeType = "additive";
    }
    const previousVersion = parseSemver(previousManifest.version);
    const candidateVersion = parseSemver(candidateManifest.version);
    const requiresDeprecationWarnings = changeType === "breaking";
    const deprecationWarningsSatisfied = !requiresDeprecationWarnings
        || (candidateVersion.major > previousVersion.major && declaredDeprecationWarnings >= 2);
    return {
        changeType,
        previousVersion: previousManifest.version,
        addedCapabilities,
        removedCapabilities,
        addedContracts: addedContracts.sort(),
        removedContracts: removedContracts.sort(),
        requiresDeprecationWarnings,
        deprecationWarningsSatisfied,
    };
}
function hasContractTightening(previousCapabilities, candidateCapabilities) {
    const previous = new Map(previousCapabilities.map((capability) => [capability.capabilityKey, capability.requiredContracts.slice().sort().join("|")]));
    for (const candidate of candidateCapabilities) {
        const previousContracts = previous.get(candidate.capabilityKey);
        if (previousContracts == null) {
            continue;
        }
        if (previousContracts !== candidate.requiredContracts.slice().sort().join("|")) {
            return true;
        }
    }
    return false;
}
function uniqueContracts(capabilities) {
    return [...new Set(capabilities.flatMap((capability) => capability.requiredContracts))].sort();
}
function parseSemver(version) {
    const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
    if (!match) {
        throw new ValidationError(`pack_lifecycle.invalid_version:${version}`, `Business pack version ${version} must use semver.`);
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}
function assertLifecycleStage(record, expected) {
    if (!expected.includes(record.lifecycleStage)) {
        throw new ValidationError(`pack_lifecycle.invalid_transition:${record.packId}@${record.version}`, `Business pack ${record.packId}@${record.version} in stage ${record.lifecycleStage} cannot perform this transition.`);
    }
}
function normalizeTimestamp(value) {
    return new Date(value ?? Date.now()).toISOString();
}
function roundPercent(value) {
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}
function buildRolloutId(packId, version) {
    return `pack_rollout:${packId}:${version}`;
}
function mergeFindings(record, findings) {
    return [...new Set([
            ...record.findings.filter((finding) => !finding.startsWith("pack_lifecycle.coverage_")
                && !finding.startsWith("pack_lifecycle.mock_tests_")
                && !finding.startsWith("pack_lifecycle.staging_integration_")
                && !finding.startsWith("pack_lifecycle.eval_gate_")
                && !finding.startsWith("pack_lifecycle.security_review_")
                && !finding.startsWith("pack_lifecycle.risk_review_")
                && !finding.startsWith("pack_lifecycle.compatibility_")
                && !finding.startsWith("pack_lifecycle.missing_plugin:")
                && !finding.startsWith("pack_lifecycle.license_")
                && !finding.startsWith("pack_lifecycle.ga_requires_")),
            ...findings,
        ])].sort();
}
function recordKey(packId, version) {
    return `${packId}@${version}`;
}
function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
}
//# sourceMappingURL=pack-lifecycle-orchestration-service.js.map