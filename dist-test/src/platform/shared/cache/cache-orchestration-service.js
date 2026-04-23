import { CacheNormalizer } from "./cache-normalizer.js";
import { getCacheFacade, initializeCache, isCacheInitialized, } from "./cache-bootstrap.js";
import { partitionPromptForCache, } from "../../execution/execution-engine/prompt-partition-cache.js";
export class CacheOrchestrationService {
    cache;
    normalizer;
    constructor(options = {}) {
        const cache = options.cache
            ?? (isCacheInitialized() ? getCacheFacade() : initializeCache());
        this.cache = cache;
        this.normalizer = new CacheNormalizer(options.workspaceRoot);
    }
    async recordPromptPartition(input) {
        const partition = partitionPromptForCache(input);
        const staticInput = {
            model: partition.model,
            profileId: partition.profileId,
            staticDigest: partition.staticDigest,
            staticMessageCount: partition.staticMessageCount,
            stablePrefixBytes: partition.stablePrefixBytes,
        };
        const dynamicInput = {
            model: partition.model,
            profileId: partition.profileId,
            staticDigest: partition.staticDigest,
            dynamicDigest: partition.dynamicDigest,
            dynamicMessageCount: partition.dynamicMessageCount,
        };
        const staticPrefix = await this.cache.getOrCompute("prompt.prefix", this.normalizer.normalizeCacheInput(staticInput), async () => ({
            staticCacheKey: partition.staticCacheKey,
            staticDigest: partition.staticDigest,
            stablePrefixBytes: partition.stablePrefixBytes,
        }), { tags: [`prompt:static:${partition.staticDigest}`] });
        const dynamicPrompt = await this.cache.getOrCompute("prompt.full", this.normalizer.normalizeCacheInput(dynamicInput), async () => ({
            dynamicCacheKey: partition.dynamicCacheKey,
            dynamicDigest: partition.dynamicDigest,
            staticDigest: partition.staticDigest,
        }), {
            tags: [
                `prompt:dynamic:${partition.dynamicDigest}`,
                `prompt:static:${partition.staticDigest}`,
            ],
        });
        return {
            partition,
            staticPrefixFromCache: staticPrefix.fromCache,
            dynamicPromptFromCache: dynamicPrompt.fromCache,
        };
    }
    async getOrComputeToolResult(toolName, args, compute, tags = []) {
        const namespace = `tool.${toolName}`;
        const normalized = this.normalizer.normalizeToolArgs(args);
        return this.cache.getOrCompute(namespace, normalized, compute, {
            tags: [...tags],
        });
    }
    async getOrComputeMemoryRetrieval(query, compute, tags = []) {
        return this.cache.getOrCompute("memory.retrieval", this.normalizer.normalizeCacheInput(query), compute, { tags: [...tags] });
    }
    async getOrComputePlannerPlan(input, compute, tags = []) {
        return this.cache.getOrCompute("planner.plan", this.normalizer.normalizeCacheInput(input), compute, { tags: [...tags] });
    }
    getMetricsSummary() {
        const snapshot = this.cache.getMetricsSnapshot();
        return {
            hits: snapshot.totalHits,
            misses: snapshot.totalMisses,
            sets: 0,
            invalidations: 0,
            evictions: 0,
        };
    }
}
//# sourceMappingURL=cache-orchestration-service.js.map