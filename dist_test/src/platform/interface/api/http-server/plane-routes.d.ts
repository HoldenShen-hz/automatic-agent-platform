import type { ArtifactPlaneService } from "../../../state-evidence/artifacts/artifact-plane-service.js";
import type { DomainRegistryService } from "../../../../domains/registry/domain-registry-service.js";
import type { PluginSpiRegistry } from "../../../../domains/registry/plugin-spi-registry.js";
import type { KnowledgePlaneService } from "../../../state-evidence/knowledge/knowledge-plane-service.js";
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
export interface PlaneRouteDeps {
    authService: ApiAuthService | null;
    knowledgePlaneService?: KnowledgePlaneService | null;
    domainRegistryService?: DomainRegistryService | null;
    pluginRegistry?: PluginSpiRegistry | null;
    artifactPlaneService?: ArtifactPlaneService | null;
}
export declare function createPlaneRoutes(deps: PlaneRouteDeps): RouteDefinition[];
