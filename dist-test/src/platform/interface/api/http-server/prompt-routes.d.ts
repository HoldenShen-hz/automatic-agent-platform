import type { HierarchicalPromptRegistryService } from "../../../prompt-engine/registry/hierarchical-registry-service.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { RouteDefinition } from "./types.js";
export interface PromptRouteDeps {
    authService: ApiAuthService | null;
    promptRegistryService: HierarchicalPromptRegistryService;
}
export declare function createPromptRoutes(deps: PromptRouteDeps): RouteDefinition[];
