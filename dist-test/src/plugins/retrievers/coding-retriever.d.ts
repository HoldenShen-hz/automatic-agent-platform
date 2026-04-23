import type { DomainRetrieverPlugin } from "../../domains/registry/plugin-spi.js";
import { SemanticRepoMapService } from "../../platform/execution/tool-executor/semantic-repo-map-service.js";
export interface CodingRetrieverPluginOptions {
    rootPath?: string;
    repoMapService?: SemanticRepoMapService;
}
export declare function createCodingRetrieverPlugin(options?: CodingRetrieverPluginOptions): DomainRetrieverPlugin;
