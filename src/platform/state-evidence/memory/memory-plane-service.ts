import type { MemoryRecord } from "../../contracts/types/domain.js";
import type {
  MemoryProvider,
  MemoryProviderPrefetchResult,
  MemoryProviderQuery,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
} from "./memory-provider.js";
import type { CacheOrchestrationService } from "../../shared/cache/cache-orchestration-service.js";
import { MemoryPromotionEngine, type MemoryPromotionResult } from "./memory-promotion-engine.js";

export type MemoryPlaneLayer =
  | "runtime"
  | "session"
  | "agent"
  | "project"
  | "user"
  | "evolution";

export interface MemoryPlaneView {
  layers: Record<MemoryPlaneLayer, MemoryRecord[]>;
  promptBlock: string;
  fewShotExampleCount: number;
  memoryIds: string[];
  experienceIds: string[];
  fromCache: boolean;
}

function toLayer(scope: string): MemoryPlaneLayer {
  switch (scope) {
    case "task_runtime":
      return "runtime";
    case "session":
      return "session";
    case "agent":
      return "agent";
    case "workspace":
    case "project":
      return "project";
    case "user":
      return "user";
    case "experience":
    case "evolution":
      return "evolution";
    default:
      return "project";
  }
}

function emptyLayers(): Record<MemoryPlaneLayer, MemoryRecord[]> {
  return {
    runtime: [],
    session: [],
    agent: [],
    project: [],
    user: [],
    evolution: [],
  };
}

export class MemoryPlaneService {
  public constructor(
    private readonly provider: MemoryProvider,
    private readonly cache?: CacheOrchestrationService,
    private readonly promotionEngine: MemoryPromotionEngine = new MemoryPromotionEngine(),
  ) {}

  public async buildView(query: MemoryProviderQuery): Promise<MemoryPlaneView> {
    const tags = [
      ...(query.sessionId != null ? [`session:${query.sessionId}`] : []),
      ...(query.agentId != null ? [`agent:${query.agentId}`] : []),
      ...(query.queryText != null ? [`memory-query:${query.queryText}`] : []),
    ];
    const loader = async (): Promise<MemoryProviderPrefetchResult> =>
      this.provider.prefetch(query);
    const wrapped = this.cache == null
      ? { value: await loader(), fromCache: false }
      : await this.cache.getOrComputeMemoryRetrieval(query, loader, tags);

    const layers = emptyLayers();
    for (const memory of wrapped.value.memories) {
      layers[toLayer(memory.scope)].push(memory);
    }

    return {
      layers,
      promptBlock: wrapped.value.promptBlock,
      fewShotExampleCount: wrapped.value.fewShotExamples.length,
      memoryIds: wrapped.value.memories.map((memory) => memory.id),
      experienceIds: wrapped.value.experienceIds,
      fromCache: wrapped.fromCache,
    };
  }

  public async syncTurn(input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult> {
    const result = await this.provider.syncTurn(input);
    const rememberedMemories = result.rememberedMemories ?? [];
    if (rememberedMemories.length === 0) {
      return result;
    }

    this.promotionEngine.promote(rememberedMemories, input.promotionContext ?? {});
    return result;
  }

  public evaluatePromotion(
    memories: readonly MemoryRecord[],
    context: { projectId?: string | null; userId?: string | null } = {},
  ): MemoryPromotionResult {
    return this.promotionEngine.promote(memories, context);
  }
}
