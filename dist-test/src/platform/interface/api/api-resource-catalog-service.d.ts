import { type PlatformAppManifest } from "../../../apps/index.js";
import { type ApiRouteSpec } from "./openapi-document.js";
export type ApiResourceVisibility = "public" | "authenticated" | "admin";
export interface ApiResourceDescriptor {
    resourceId: string;
    method: ApiRouteSpec["method"];
    path: string;
    summary: string;
    tags: string[];
    version: string | null;
    plane: string;
    visibility: ApiResourceVisibility;
    exposedByApps: PlatformAppManifest["kind"][];
}
export interface ApiCatalogSummary {
    totalResources: number;
    publicResources: number;
    authenticatedResources: number;
    adminResources: number;
    versionedResources: number;
    unversionedResources: number;
    byPlane: Record<string, number>;
}
export declare class ApiResourceCatalogService {
    listResources(filters?: {
        tag?: string;
        visibility?: ApiResourceVisibility;
        version?: string | null;
    }): ApiResourceDescriptor[];
    buildSummary(): ApiCatalogSummary;
    buildContractCoverage(): Array<{
        path: string;
        methods: string[];
        documented: boolean;
        tags: string[];
    }>;
    private toDescriptor;
}
