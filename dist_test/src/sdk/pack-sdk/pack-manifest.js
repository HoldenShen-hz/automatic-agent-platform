import { ValidationError } from "../../platform/contracts/errors.js";
export function validateBusinessPackManifest(manifest) {
    if (manifest.packId.trim().length === 0) {
        throw new ValidationError("pack_sdk.invalid_pack_id", "Business pack manifest requires a non-empty packId.");
    }
    if (manifest.capabilities.length === 0) {
        throw new ValidationError("pack_sdk.empty_capabilities", "Business pack manifest must declare at least one capability.");
    }
    return {
        ...manifest,
        packId: manifest.packId.trim(),
        version: manifest.version.trim(),
        domain: manifest.domain.trim(),
        owner: manifest.owner.trim(),
        capabilities: manifest.capabilities.map((capability) => ({
            capabilityKey: capability.capabilityKey.trim(),
            maturity: capability.maturity,
            requiredContracts: [...new Set(capability.requiredContracts.map((contract) => contract.trim()).filter((contract) => contract.length > 0))],
        })),
    };
}
export function summarizeCapabilityMatrix(manifest) {
    const summary = {
        experimental: 0,
        beta: 0,
        ga: 0,
    };
    for (const capability of manifest.capabilities) {
        summary[capability.maturity] += 1;
    }
    return summary;
}
//# sourceMappingURL=pack-manifest.js.map