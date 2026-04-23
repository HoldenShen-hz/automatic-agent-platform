import { type ModelMetadataRegistry } from "../../control-plane/config-center/model-metadata-registry.js";
import { type ResourceCeilingGuard } from "../../control-plane/config-center/resource-ceiling.js";
import { TypedEventBus } from "../../state-evidence/events/typed-event-bus.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type ToolExecutionMetadata } from "./tool-metadata.js";
import type { CachedSkillExecutionEntry, SkillExecutionServiceOptions, SkillToolRunner } from "./skill-execution-support.js";
import { skillExecutionCoreMethods } from "./skill-execution-core-methods.js";
import { skillExecutionCacheMethods } from "./skill-execution-cache-methods.js";
export type { SkillDefinition, SkillExecutionCacheMetadata, SkillExecutionCachePolicy, SkillExecutionRequest, SkillExecutionResult, SkillExecutionServiceOptions, SkillStepDefinition, SkillStepExecutionResult, SkillToolCallRequest, SkillToolCallResult, SkillToolRunner, } from "./skill-execution-support.js";
type SkillExecutionServiceMethodSet = typeof skillExecutionCoreMethods & typeof skillExecutionCacheMethods;
export interface SkillExecutionService extends SkillExecutionServiceMethodSet {
}
export declare class SkillExecutionService {
    readonly db: AuthoritativeSqlDatabase;
    readonly store: AuthoritativeTaskStore;
    readonly toolRunner: SkillToolRunner;
    readonly bus: TypedEventBus;
    readonly cache: Map<string, CachedSkillExecutionEntry>;
    readonly cacheMaxEntries: number;
    readonly gitHeadResolver: (workingDirectory: string) => Promise<string | null> | string | null;
    readonly modelMetadataRegistry: ModelMetadataRegistry;
    readonly toolMetadataResolver: (toolName: string) => ToolExecutionMetadata | null;
    readonly resourceCeilingGuard: ResourceCeilingGuard;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, toolRunner: SkillToolRunner, options?: SkillExecutionServiceOptions);
}
