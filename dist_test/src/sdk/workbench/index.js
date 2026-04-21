import { ValidationError } from "../../platform/contracts/errors.js";
import { buildApiUrl } from "../client-sdk/index.js";
import { validateBusinessPackManifest } from "../pack-sdk/index.js";
function validatePluginManifest(manifest) {
    return manifest;
}
export class SdkWorkbenchService {
    buildSnapshot(input) {
        const plugins = input.plugins.map((plugin) => validatePluginManifest(plugin));
        const packs = input.packs.map((pack) => validateBusinessPackManifest(pack));
        const installPlans = packs.map((pack) => this.createInstallPlan({ pack, plugins }));
        const requiredContracts = [...new Set(packs.flatMap((pack) => pack.capabilities.flatMap((capability) => capability.requiredContracts)))];
        const availableContracts = new Set(input.availableContracts.map((contract) => contract.trim()).filter((contract) => contract.length > 0));
        const missingContracts = requiredContracts.filter((contract) => !availableContracts.has(contract));
        return {
            apiBaseUrl: input.client.baseUrl,
            apiVersion: input.client.apiVersion,
            tenantId: input.client.tenantId ?? null,
            pluginIds: plugins.map((plugin) => plugin.pluginId),
            packIds: packs.map((pack) => pack.packId),
            capabilityCatalog: [...new Set(plugins.flatMap((plugin) => plugin.capabilityIds))].sort(),
            requiredContracts,
            missingContracts,
            installPlans,
        };
    }
    createInstallPlan(input) {
        const pack = validateBusinessPackManifest(input.pack);
        const plugins = input.plugins.map((plugin) => validatePluginManifest(plugin));
        const pluginAssignments = [];
        const unresolvedCapabilities = [];
        for (const capability of pack.capabilities) {
            const match = plugins.find((plugin) => plugin.capabilityIds.some((id) => id === capability.capabilityKey));
            if (match == null) {
                unresolvedCapabilities.push(capability.capabilityKey);
                continue;
            }
            const pluginCapability = match.capabilityIds.find((id) => id === capability.capabilityKey);
            pluginAssignments.push({
                capabilityKey: capability.capabilityKey,
                pluginId: match.pluginId,
                pluginCapability: pluginCapability,
            });
        }
        return {
            packId: pack.packId,
            pluginAssignments,
            unresolvedCapabilities,
            ready: unresolvedCapabilities.length === 0,
        };
    }
    buildPublishReadiness(input) {
        if (input.plugins.length === 0 && input.packs.length === 0) {
            throw new ValidationError("sdk_workbench.empty_workspace", "SDK workbench requires at least one plugin or pack.");
        }
        const snapshot = this.buildSnapshot(input);
        const findings = [];
        for (const plan of snapshot.installPlans) {
            if (!plan.ready) {
                findings.push(`unresolved capabilities for ${plan.packId}: ${plan.unresolvedCapabilities.join(", ")}`);
            }
        }
        if (snapshot.missingContracts.length > 0) {
            findings.push(`missing contracts: ${snapshot.missingContracts.join(", ")}`);
        }
        const previewUrls = [
            buildApiUrl(input.client, { path: "/tasks" }),
            buildApiUrl(input.client, { path: "/approvals", query: { limit: 10 } }),
            buildApiUrl(input.client, { path: "/skills/registry/summary" }),
        ];
        return {
            ready: findings.length === 0,
            findings,
            previewUrls,
            coveredContracts: snapshot.requiredContracts.filter((contract) => !snapshot.missingContracts.includes(contract)),
            missingContracts: snapshot.missingContracts,
        };
    }
}
//# sourceMappingURL=index.js.map