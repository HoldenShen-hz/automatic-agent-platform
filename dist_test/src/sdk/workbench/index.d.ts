import type { ApiClientConfig } from "../client-sdk/index.js";
import type { BusinessPackManifest } from "../pack-sdk/index.js";
import type { PluginManifest } from "../../domains/registry/plugin-spi.js";
export interface WorkbenchInstallPlan {
    packId: string;
    pluginAssignments: Array<{
        capabilityKey: string;
        pluginId: string;
        pluginCapability: string;
    }>;
    unresolvedCapabilities: string[];
    ready: boolean;
}
export interface SdkWorkbenchSnapshot {
    apiBaseUrl: string;
    apiVersion: string;
    tenantId: string | null;
    pluginIds: string[];
    packIds: string[];
    capabilityCatalog: string[];
    requiredContracts: string[];
    missingContracts: string[];
    installPlans: WorkbenchInstallPlan[];
}
export interface PublishReadinessReport {
    ready: boolean;
    findings: string[];
    previewUrls: string[];
    coveredContracts: string[];
    missingContracts: string[];
}
export declare class SdkWorkbenchService {
    buildSnapshot(input: {
        client: ApiClientConfig;
        plugins: PluginManifest[];
        packs: BusinessPackManifest[];
        availableContracts: string[];
    }): SdkWorkbenchSnapshot;
    createInstallPlan(input: {
        pack: BusinessPackManifest;
        plugins: PluginManifest[];
    }): WorkbenchInstallPlan;
    buildPublishReadiness(input: {
        client: ApiClientConfig;
        plugins: PluginManifest[];
        packs: BusinessPackManifest[];
        availableContracts: string[];
    }): PublishReadinessReport;
}
