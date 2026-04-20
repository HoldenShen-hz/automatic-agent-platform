import type { CacheFacade } from "./cache-facade.js";
import { CacheNormalizer } from "./cache-normalizer.js";
import {
  getCacheFacade,
  initializeCache,
  isCacheInitialized,
} from "./cache-bootstrap.js";
import {
  partitionPromptForCache,
  type PromptPartitionInput,
  type PromptPartitionResult,
} from "../../execution/execution-engine/prompt-partition-cache.js";

export interface CacheOrchestrationServiceOptions {
  cache?: CacheFacade;
  workspaceRoot?: string;
}

export interface PromptCacheLookup {
  partition: PromptPartitionResult;
  staticPrefixFromCache: boolean;
  dynamicPromptFromCache: boolean;
}

export interface CacheOrchestrationSummary {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  evictions: number;
}

export class CacheOrchestrationService {
  private readonly cache: CacheFacade;
  private readonly normalizer: CacheNormalizer;

  public constructor(options: CacheOrchestrationServiceOptions = {}) {
    const cache = options.cache
      ?? (isCacheInitialized() ? getCacheFacade() : initializeCache());
    this.cache = cache;
    this.normalizer = new CacheNormalizer(options.workspaceRoot);
  }

  public async recordPromptPartition(input: PromptPartitionInput): Promise<PromptCacheLookup> {
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

    const staticPrefix = await this.cache.getOrCompute(
      "prompt.prefix",
      this.normalizer.normalizeCacheInput(staticInput),
      async () => ({
        staticCacheKey: partition.staticCacheKey,
        staticDigest: partition.staticDigest,
        stablePrefixBytes: partition.stablePrefixBytes,
      }),
      { tags: [`prompt:static:${partition.staticDigest}`] },
    );
    const dynamicPrompt = await this.cache.getOrCompute(
      "prompt.full",
      this.normalizer.normalizeCacheInput(dynamicInput),
      async () => ({
        dynamicCacheKey: partition.dynamicCacheKey,
        dynamicDigest: partition.dynamicDigest,
        staticDigest: partition.staticDigest,
      }),
      {
        tags: [
          `prompt:dynamic:${partition.dynamicDigest}`,
          `prompt:static:${partition.staticDigest}`,
        ],
      },
    );

    return {
      partition,
      staticPrefixFromCache: staticPrefix.fromCache,
      dynamicPromptFromCache: dynamicPrompt.fromCache,
    };
  }

  public async getOrComputeToolResult<T>(
    toolName: string,
    args: Record<string, unknown>,
    compute: () => Promise<T>,
    tags: readonly string[] = [],
  ): Promise<{ value: T; fromCache: boolean }> {
    const namespace = `tool.${toolName}`;
    const normalized = this.normalizer.normalizeToolArgs(args);
    return this.cache.getOrCompute(namespace, normalized, compute, {
      tags: [...tags],
    });
  }

  public async getOrComputeMemoryRetrieval<T>(
    query: unknown,
    compute: () => Promise<T>,
    tags: readonly string[] = [],
  ): Promise<{ value: T; fromCache: boolean }> {
    return this.cache.getOrCompute(
      "memory.retrieval",
      this.normalizer.normalizeCacheInput(query),
      compute,
      { tags: [...tags] },
    );
  }

  public async getOrComputePlannerPlan<T>(
    input: unknown,
    compute: () => Promise<T>,
    tags: readonly string[] = [],
  ): Promise<{ value: T; fromCache: boolean }> {
    return this.cache.getOrCompute(
      "planner.plan",
      this.normalizer.normalizeCacheInput(input),
      compute,
      { tags: [...tags] },
    );
  }

  public getMetricsSummary(): CacheOrchestrationSummary {
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
