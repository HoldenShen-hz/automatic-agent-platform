/**
 * Pack Routes - REST API for pack management.
 *
 * Routes:
 * - GET /v1/packs - List packs
 * - GET /v1/packs/:id - Get pack
 * - POST /v1/packs - Create pack
 *
 * Part of §6 API Endpoints (REST Endpoints)
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { PackCatalogService } from "../pack-catalog-service.js";
export interface CreatePackPayload {
    packId: string;
    name: string;
    version: string;
    domainId: string;
    description?: string;
    riskMatrix?: Array<{
        riskId: string;
        level: "low" | "medium" | "high" | "critical";
        triggers?: string[];
        mitigation?: string;
        escalationPolicy?: string;
    }>;
    toolBundles?: string[];
    pluginIds?: string[];
    dependencies?: Array<{
        packId: string;
        versionRange?: string;
        optional?: boolean;
        reason?: string;
    }>;
    sandboxTier?: "none" | "process" | "container" | "scoped_external_access";
}
export interface PackRouteDeps {
    authService: ApiAuthService | null;
    packCatalogService: PackCatalogService;
}
export declare function createPackRoutes(deps: PackRouteDeps): RouteDefinition[];
