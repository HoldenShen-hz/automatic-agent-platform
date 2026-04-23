export interface PackCatalogEntry {
    readonly packId: string;
    readonly name: string;
    readonly version: string;
    readonly domainId: string;
    readonly description: string;
    readonly lifecycleStage: "draft" | "review" | "approved" | "published" | "deprecated" | "archived";
    readonly sandboxTier: "none" | "process" | "container" | "scoped_external_access";
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly createdBy: string;
    readonly riskCount: number;
    readonly dependencyCount: number;
    readonly pluginCount: number;
    readonly toolBundleCount: number;
}
export interface CreatePackCatalogInput {
    readonly packId: string;
    readonly name: string;
    readonly version: string;
    readonly domainId: string;
    readonly description?: string;
    readonly createdBy: string;
    readonly sandboxTier?: PackCatalogEntry["sandboxTier"];
    readonly riskCount?: number;
    readonly dependencyCount?: number;
    readonly pluginCount?: number;
    readonly toolBundleCount?: number;
}
export declare class PackCatalogService {
    private readonly packs;
    createPack(input: CreatePackCatalogInput): PackCatalogEntry;
    getPack(packId: string): PackCatalogEntry | null;
    listPacks(limit?: number): PackCatalogEntry[];
}
