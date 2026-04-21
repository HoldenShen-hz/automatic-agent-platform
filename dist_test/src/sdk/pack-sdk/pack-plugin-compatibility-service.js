import { ValidationError } from "../../platform/contracts/errors.js";
import { createBuiltinPlugin, listBuiltinPluginIds } from "../../plugins/builtin-plugin-registry.js";
import { summarizeCapabilityMatrix, validateBusinessPackManifest, } from "./pack-manifest.js";
const LICENSE_RANK = {
    community: 0,
    professional: 1,
    enterprise: 2,
};
const ENTERPRISE_KEYWORDS = [
    "tenant",
    "organization",
    "org",
    "sso",
    "scim",
    "audit",
    "compliance",
    "governance",
    "residency",
    "private",
    "dedicated",
    "enterprise",
];
const PROFESSIONAL_KEYWORDS = [
    "external",
    "github",
    "crm",
    "marketplace",
    "revenue",
    "quota",
    "concurrency",
    "adapter",
    "ops",
];
export class PackPluginCompatibilityService {
    listAvailablePlugins() {
        return listBuiltinPluginIds()
            .map((pluginId) => this.inspectBuiltinPlugin(pluginId))
            .filter((entry) => entry != null)
            .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
    }
    inspectBuiltinPlugin(pluginId) {
        const plugin = createBuiltinPlugin(pluginId);
        if (plugin == null) {
            return null;
        }
        return {
            pluginId: plugin.pluginId,
            spiType: plugin.spiType,
            domainId: "domainId" in plugin && typeof plugin.domainId === "string" ? plugin.domainId : null,
            capabilityIds: [...(plugin.capabilityIds ?? [])],
            lifecycleHooks: [
                ...(typeof plugin.initialize === "function" ? ["initialize"] : []),
                ...(typeof plugin.healthCheck === "function" ? ["healthCheck"] : []),
                ...(typeof plugin.shutdown === "function" ? ["shutdown"] : []),
            ],
            minimumLicenseTier: inferPluginLicenseTier(plugin),
            boundaryClass: inferBoundaryClass(plugin.pluginId),
        };
    }
    evaluateManifest(input) {
        const manifest = validateBusinessPackManifest(input.manifest);
        const availablePlugins = this.listAvailablePlugins();
        const selectedPlugins = (input.pluginIds == null ? availablePlugins : input.pluginIds
            .map((pluginId) => this.inspectBuiltinPlugin(pluginId))
            .filter((entry) => entry != null))
            .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
        if (selectedPlugins.length === 0) {
            throw new ValidationError("pack_plugin_compatibility.empty_plugin_set", "Pack compatibility evaluation requires at least one available plugin.");
        }
        const capabilityCoverage = manifest.capabilities.map((capability) => this.evaluateCapability(manifest, capability, selectedPlugins, availablePlugins));
        const requiredContracts = [...new Set(manifest.capabilities.flatMap((capability) => capability.requiredContracts))].sort();
        const requiredLicenseTier = capabilityCoverage.reduce((highest, capability) => maxTier(highest, capability.requiredLicenseTier), "community");
        const missingPluginCapabilities = capabilityCoverage
            .filter((capability) => capability.matchedPluginIds.length === 0)
            .map((capability) => capability.capabilityKey);
        const blockedByLicense = capabilityCoverage
            .filter((capability) => LICENSE_RANK[capability.requiredLicenseTier] > LICENSE_RANK[input.selectedLicenseTier])
            .map((capability) => capability.capabilityKey);
        const verdict = blockedByLicense.length > 0
            ? "license_blocked"
            : missingPluginCapabilities.length > 0
                ? "missing_plugins"
                : "compatible";
        return {
            manifest,
            selectedLicenseTier: input.selectedLicenseTier,
            requiredLicenseTier,
            capabilityMatrix: summarizeCapabilityMatrix(manifest),
            selectedPlugins,
            availablePlugins,
            capabilityCoverage,
            missingPluginCapabilities,
            blockedByLicense,
            requiredContracts,
            verdict,
        };
    }
    evaluateCapability(manifest, capability, selectedPlugins, availablePlugins) {
        const rankedSelected = selectedPlugins
            .map((plugin) => ({ plugin, score: scorePluginForCapability(plugin, manifest.domain, capability.capabilityKey) }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score || left.plugin.pluginId.localeCompare(right.plugin.pluginId));
        const rankedCandidates = availablePlugins
            .map((plugin) => ({ plugin, score: scorePluginForCapability(plugin, manifest.domain, capability.capabilityKey) }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score || left.plugin.pluginId.localeCompare(right.plugin.pluginId));
        const matchedPluginIds = rankedSelected.map((item) => item.plugin.pluginId);
        const candidatePluginIds = rankedCandidates.map((item) => item.plugin.pluginId).slice(0, 5);
        const requiredLicenseTier = [
            inferCapabilityLicenseTier(capability.capabilityKey),
            ...capability.requiredContracts.map((contract) => inferCapabilityLicenseTier(contract)),
            ...rankedSelected.map((item) => item.plugin.minimumLicenseTier),
        ].reduce((highest, tier) => maxTier(highest, tier), "community");
        const reasons = [];
        if (matchedPluginIds.length === 0) {
            reasons.push("no_selected_plugin_matches_capability");
        }
        if (candidatePluginIds.length > 0 && matchedPluginIds.length === 0) {
            reasons.push(`suggested_plugins:${candidatePluginIds.join(",")}`);
        }
        if (requiredLicenseTier !== "community") {
            reasons.push(`requires_license:${requiredLicenseTier}`);
        }
        return {
            capabilityKey: capability.capabilityKey,
            maturity: capability.maturity,
            requiredContracts: capability.requiredContracts,
            matchedPluginIds,
            candidatePluginIds,
            requiredLicenseTier,
            compatible: matchedPluginIds.length > 0,
            reasons,
        };
    }
}
function inferPluginLicenseTier(plugin) {
    const tokens = tokenize([
        plugin.pluginId,
        ...("domainId" in plugin && typeof plugin.domainId === "string" ? [plugin.domainId] : []),
        ...(plugin.capabilityIds ?? []),
        plugin.spiType,
    ]);
    if (plugin.spiType === "adapter" || tokens.some((token) => PROFESSIONAL_KEYWORDS.includes(token))) {
        return "professional";
    }
    if (tokens.some((token) => ENTERPRISE_KEYWORDS.includes(token))) {
        return "enterprise";
    }
    return "community";
}
function inferCapabilityLicenseTier(value) {
    const tokens = tokenize([value]);
    if (tokens.some((token) => ENTERPRISE_KEYWORDS.includes(token))) {
        return "enterprise";
    }
    if (tokens.some((token) => PROFESSIONAL_KEYWORDS.includes(token))) {
        return "professional";
    }
    return "community";
}
function inferBoundaryClass(pluginId) {
    if (pluginId.startsWith("plugin.core.")) {
        return "core";
    }
    if (pluginId.startsWith("plugin.shared.")) {
        return "shared";
    }
    return "domain";
}
function scorePluginForCapability(plugin, domain, capabilityKey) {
    const exactMatch = plugin.capabilityIds.includes(capabilityKey) ? 10 : 0;
    const capabilityTokens = new Set(tokenize([capabilityKey]));
    const pluginTokens = tokenize([plugin.pluginId, plugin.domainId ?? "", ...plugin.capabilityIds]);
    const overlap = pluginTokens.filter((token) => capabilityTokens.has(token)).length;
    if (exactMatch === 0 && overlap < 2) {
        return 0;
    }
    const baseScore = exactMatch + overlap * 2;
    if (baseScore === 0) {
        return 0;
    }
    const domainBonus = plugin.domainId === domain ? 3 : plugin.domainId == null ? 1 : 0;
    return baseScore + domainBonus;
}
function tokenize(values) {
    return [...new Set(values.flatMap((value) => value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 0)))];
}
function maxTier(left, right) {
    return LICENSE_RANK[left] >= LICENSE_RANK[right] ? left : right;
}
//# sourceMappingURL=pack-plugin-compatibility-service.js.map