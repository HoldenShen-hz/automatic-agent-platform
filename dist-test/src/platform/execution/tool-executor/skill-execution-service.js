import { DEFAULT_MODEL_METADATA_REGISTRY, } from "../../control-plane/config-center/model-metadata-registry.js";
import { createDefaultResourceCeilingGuard, } from "../../control-plane/config-center/resource-ceiling.js";
import { TypedEventBus } from "../../state-evidence/events/typed-event-bus.js";
import { resolveToolExecutionMetadata, } from "./tool-metadata.js";
import { defaultGitHeadResolver } from "./skill-execution-support.js";
import { skillExecutionCoreMethods } from "./skill-execution-core-methods.js";
import { skillExecutionCacheMethods } from "./skill-execution-cache-methods.js";
export class SkillExecutionService {
    db;
    store;
    toolRunner;
    bus;
    cache = new Map();
    cacheMaxEntries;
    gitHeadResolver;
    modelMetadataRegistry;
    toolMetadataResolver;
    resourceCeilingGuard;
    constructor(db, store, toolRunner, options = {}) {
        this.db = db;
        this.store = store;
        this.toolRunner = toolRunner;
        this.bus = new TypedEventBus(db, store);
        this.cacheMaxEntries = Math.max(1, Math.trunc(options.cacheMaxEntries ?? 128));
        this.gitHeadResolver = options.gitHeadResolver ?? defaultGitHeadResolver;
        this.modelMetadataRegistry = options.modelMetadataRegistry ?? DEFAULT_MODEL_METADATA_REGISTRY;
        this.toolMetadataResolver = options.toolMetadataResolver ?? resolveToolExecutionMetadata;
        this.resourceCeilingGuard = options.resourceCeilingGuard ?? createDefaultResourceCeilingGuard();
    }
}
Object.assign(SkillExecutionService.prototype, skillExecutionCoreMethods, skillExecutionCacheMethods);
//# sourceMappingURL=skill-execution-service.js.map