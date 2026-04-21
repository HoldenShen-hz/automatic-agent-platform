import type { RegisteredPlugin } from "../../domains/registry/plugin-spi.js";
import { type BusinessPackCapability, type BusinessPackManifest } from "./pack-manifest.js";
export type LicenseTier = "community" | "professional" | "enterprise";
export interface BuiltinPluginInventoryEntry {
    pluginId: string;
    spiType: RegisteredPlugin["spiType"];
    domainId: string | null;
    capabilityIds: string[];
    lifecycleHooks: Array<"initialize" | "healthCheck" | "shutdown">;
    minimumLicenseTier: LicenseTier;
    boundaryClass: "core" | "shared" | "domain";
}
export interface PackCapabilityCompatibility {
    capabilityKey: string;
    maturity: BusinessPackCapability["maturity"];
    requiredContracts: string[];
    matchedPluginIds: string[];
    candidatePluginIds: string[];
    requiredLicenseTier: LicenseTier;
    compatible: boolean;
    reasons: string[];
}
export interface PackCompatibilityReport {
    manifest: BusinessPackManifest;
    selectedLicenseTier: LicenseTier;
    requiredLicenseTier: LicenseTier;
    capabilityMatrix: Record<BusinessPackCapability["maturity"], number>;
    selectedPlugins: BuiltinPluginInventoryEntry[];
    availablePlugins: BuiltinPluginInventoryEntry[];
    capabilityCoverage: PackCapabilityCompatibility[];
    missingPluginCapabilities: string[];
    blockedByLicense: string[];
    requiredContracts: string[];
    verdict: "compatible" | "missing_plugins" | "license_blocked";
}
export declare class PackPluginCompatibilityService {
    listAvailablePlugins(): BuiltinPluginInventoryEntry[];
    inspectBuiltinPlugin(pluginId: string): BuiltinPluginInventoryEntry | null;
    evaluateManifest(input: {
        manifest: BusinessPackManifest;
        selectedLicenseTier: LicenseTier;
        pluginIds?: readonly string[] | undefined;
    }): PackCompatibilityReport;
    private evaluateCapability;
}
