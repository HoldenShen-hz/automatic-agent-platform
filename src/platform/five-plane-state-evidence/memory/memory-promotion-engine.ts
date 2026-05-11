import type { MemoryRecord } from "../../contracts/types/domain.js";
import {
  cloneMemoryWithLayer,
  DEFAULT_MEMORY_PROMOTION_RULES,
  getLayerTtlConfig,
  isMemoryStale,
  mapMemoryScopeToLayer,
  shouldEvict,
  type HierarchicalMemoryLayer,
  type LayerPromotionRule,
  type MemoryPromotionCandidate,
} from "./memory-layer-model.js";
import { ProjectMemoryStore, type ProjectMemoryEntry } from "./project-memory-store.js";
import { UserMemoryStore, type UserMemoryEntry } from "./user-memory-store.js";

export interface PromotionContext {
  projectId?: string | null;
  userId?: string | null;
  candidateCountsByScope?: Partial<Record<HierarchicalMemoryLayer, number>>;
  maxLayerSizeByScope?: Partial<Record<HierarchicalMemoryLayer, number>>;
}

export interface PromotionResult {
  promoted: MemoryPromotionCandidate[];
  rejected: MemoryPromotionCandidate[];
  demoted: MemoryPromotionCandidate[];
  retained: MemoryPromotionCandidate[];
  projectEntries: ProjectMemoryEntry[];
  userEntries: UserMemoryEntry[];
}

export type MemoryPromotionResult = PromotionResult;

export class MemoryPromotionEngine {
  public constructor(
    private readonly projectStore: ProjectMemoryStore = new ProjectMemoryStore(),
    private readonly userStore: UserMemoryStore = new UserMemoryStore(),
    private readonly rules: readonly LayerPromotionRule[] = DEFAULT_MEMORY_PROMOTION_RULES,
  ) {}

  public evaluatePromotion(memory: MemoryRecord): MemoryPromotionCandidate {
    const legacyLayer = mapMemoryScopeToLayer(memory.scope);
    const currentLayer = legacyLayer as HierarchicalMemoryLayer;
    const matchedRule = this.rules.find((rule) =>
      rule.from === currentLayer
      && (memory.hitCount >= rule.minHitCount)
      && ((memory.qualityScore ?? 0) >= rule.minQualityScore)
      && ((memory.importanceScore ?? 0) >= rule.minImportanceScore),
    ) ?? null;
    return {
      memory,
      currentLayer,
      targetLayer: matchedRule?.to ?? null,
      satisfiedRule: matchedRule,
    };
  }

  public evaluateDemotion(
    memory: MemoryRecord,
    context: { candidateCount?: number; maxLayerSize?: number } = {},
  ): MemoryPromotionCandidate {
    const currentLayer = mapMemoryScopeToLayer(memory.scope) as HierarchicalMemoryLayer;
    const config = getLayerTtlConfig(currentLayer);
    const targetLayer = previousLayerOf(currentLayer);
    const shouldDemote =
      targetLayer != null
      && config?.supportsDemotion === true
      && (
        isMemoryStale(memory)
        || shouldEvict(memory, context.candidateCount ?? 1, context.maxLayerSize)
      );
    return {
      memory,
      currentLayer,
      targetLayer: shouldDemote ? targetLayer : null,
      satisfiedRule: null,
    };
  }

  public runPromotionCycle(
    memories: readonly MemoryRecord[],
    context: PromotionContext = {},
  ): PromotionResult {
    const promoted: MemoryPromotionCandidate[] = [];
    const rejected: MemoryPromotionCandidate[] = [];
    const demoted: MemoryPromotionCandidate[] = [];
    const retained: MemoryPromotionCandidate[] = [];
    const projectEntries: ProjectMemoryEntry[] = [];
    const userEntries: UserMemoryEntry[] = [];
    const countsByScope = new Map<HierarchicalMemoryLayer, number>();

    for (const memory of memories) {
      const scope = mapMemoryScopeToLayer(memory.scope) as HierarchicalMemoryLayer;
      countsByScope.set(scope, (countsByScope.get(scope) ?? 0) + 1);
    }

    for (const memory of memories) {
      const currentLayer = mapMemoryScopeToLayer(memory.scope) as HierarchicalMemoryLayer;
      const demotionCandidate = this.evaluateDemotion(memory, {
        candidateCount: context.candidateCountsByScope?.[currentLayer] ?? countsByScope.get(currentLayer) ?? 1,
        maxLayerSize: context.maxLayerSizeByScope?.[currentLayer],
      });
      if (demotionCandidate.targetLayer != null) {
        demoted.push(demotionCandidate);
        continue;
      }

      const promotionCandidate = this.evaluatePromotion(memory);
      if (promotionCandidate.targetLayer == null) {
        rejected.push(promotionCandidate);
        retained.push(promotionCandidate);
        continue;
      }

      promoted.push(promotionCandidate);
      if (promotionCandidate.targetLayer === "project" && context.projectId) {
        projectEntries.push(this.projectStore.upsert(context.projectId, cloneMemoryWithLayer(memory, "project")));
      }
      if (promotionCandidate.targetLayer === "user" && context.userId) {
        userEntries.push(this.userStore.upsert(context.userId, cloneMemoryWithLayer(memory, "user")));
      }
    }

    return {
      promoted,
      rejected,
      demoted,
      retained,
      projectEntries,
      userEntries,
    };
  }

  public promote(
    memories: readonly MemoryRecord[],
    context: PromotionContext = {},
  ): MemoryPromotionResult {
    return this.runPromotionCycle(memories, context);
  }

  public listProjectMemory(projectId: string): ProjectMemoryEntry[] {
    return this.projectStore.list(projectId);
  }

  public listUserMemory(userId: string): UserMemoryEntry[] {
    return this.userStore.list(userId);
  }

  public getRules(): readonly LayerPromotionRule[] {
    return this.rules;
  }
}

function previousLayerOf(layer: HierarchicalMemoryLayer): HierarchicalMemoryLayer | null {
  switch (layer) {
    case "runtime":
      return null;
    case "session":
      return "runtime";
    case "agent":
      return "session";
    case "project":
      return "agent";
    case "user":
      return "project";
    case "evolution":
      return "user";
  }
}
