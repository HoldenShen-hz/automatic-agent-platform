export interface BusinessPackCapability {
    capabilityKey: string;
    maturity: "experimental" | "beta" | "ga";
    requiredContracts: string[];
}
export interface BusinessPackManifest {
    packId: string;
    version: string;
    domain: string;
    owner: string;
    capabilities: BusinessPackCapability[];
}
export declare function validateBusinessPackManifest(manifest: BusinessPackManifest): BusinessPackManifest;
export declare function summarizeCapabilityMatrix(manifest: BusinessPackManifest): Record<BusinessPackCapability["maturity"], number>;
