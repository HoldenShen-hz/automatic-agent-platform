import type { MemoryRecord } from "../../contracts/types/domain.js";
import {
  cloneMemoryWithLayer,
  DEFAULT_LAYER_TTL_CONFIGS,
  DEFAULT_MEMORY_PROMOTION_RULES,
  mapMemoryScopeToLayer,
  type HierarchicalMemoryLayer,
  type LayerPromotionRule,
  type MemoryPromotionCandidate,
} from "./memory-layer-model.js";
import { ProjectMemoryStore, type ProjectMemoryEntry } from "./project-memory-store.js";
import { UserMemoryStore, type UserMemoryEntry } from "./user-memory-store.js";

export interface PromotionResult {
  promoted: MemoryPromotionCandidate[];
  demoted: MemoryPromotionCandidate[];
  rejected: MemoryPromotionCandidate[];
  projectEntries: ProjectMemoryEntry[];
  userEntries: UserMemoryEntry[];
  timestamp: string;
}

export interface MemoryPromotionResult {
  promoted: MemoryPromotionCandidate[];
  rejected: MemoryPromotionCandidate[];
  projectEntries: ProjectMemoryEntry[];
  userEntries: UserMemoryEntry[];
}

export interface DemotionCandidate {
  memory: MemoryRecord;
  currentLayer: HierarchicalMemoryLayer;
  targetLayer: HierarchicalMemoryLayer | null;
  reason: DemotionReason;
}

export type DemotionReason = "stale" | "quality_below_threshold" | "trust_below_threshold" | "manual";

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

  public evaluateDemotion(memory: MemoryRecord): DemotionCandidate {
    const currentLayer = mapMemoryScopeToLayer(memory.scope) as HierarchicalMemoryLayer;
    const config = this.rules.find((r) => r.from === currentLayer);

    // Check staleness
    if (config) {
      const createdAtMs = new Date(memory.createdAt).getTime();
      const ageMs = Date.now() - createdAtMs;
      const layerConfig = DEFAULT_LAYER_TTL_CONFIGS.find((c) => c.scope === currentLayer);

      if (layerConfig && ageMs > layerConfig.maxTtlMs) {
        return {
          memory,
          currentLayer,
          targetLayer: currentLayer === "session" ? "runtime" : currentLayer === "agent" ? "session" : currentLayer === "project" ? "agent" : currentLayer === "user" ? "project" : null,
          reason: "stale",
        };
      }
    }

    // Check quality threshold
    const qualityThreshold = 0.3;
    if ((memory.qualityScore ?? 0.5) < qualityThreshold && currentLayer !== "runtime") {
      const demotionMap: Record<string, HierarchicalMemoryLayer> = {
        session: "runtime",
        agent: "session",
        project: "agent",
        user: "project",
        evolution: "user",
      };
      return {
        memory,
        currentLayer,
        targetLayer: demotionMap[currentLayer] ?? null,
        reason: "quality_below_threshold",
      };
    }

    return {
      memory,
      currentLayer,
      targetLayer: null,
      reason: "manual",
    };
  }

  public runPromotionCycle(
    memories: readonly MemoryRecord[],
    context: { projectId?: string | null; userId?: string | null } = {},
  ): PromotionResult {
    const promoted: MemoryPromotionCandidate[] = [];
    const demoted: MemoryPromotionCandidate[] = [];
    const rejected: MemoryPromotionCandidate[] = [];
    const projectEntries: ProjectMemoryEntry[] = [];
    const userEntries: UserMemoryEntry[] = [];

    for (const memory of memories) {
      // First evaluate demotion
      const demotionCandidate = this.evaluateDemotion(memory);
      if (demotionCandidate.targetLayer) {
        demoted.push({
          memory: demotionCandidate.memory,
          currentLayer: demotionCandidate.currentLayer,
          targetLayer: demotionCandidate.targetLayer,
          satisfiedRule: null,
        });
        continue;
      }

      // Then evaluate promotion
      const candidate = this.evaluatePromotion(memory);
      if (!candidate.targetLayer) {
        rejected.push(candidate);
        continue;
      }
      promoted.push(candidate);
      if (candidate.targetLayer === "project" && context.projectId) {
        projectEntries.push(this.projectStore.upsert(context.projectId, cloneMemoryWithLayer(memory, "project")));
      }
      if (candidate.targetLayer === "user" && context.userId) {
        userEntries.push(this.userStore.upsert(context.userId, cloneMemoryWithLayer(memory, "user")));
      }
    }

    return {
      promoted,
      demoted,
      rejected,
      projectEntries,
      userEntries,
      timestamp: new Date().toISOString(),
    };
  }

  public promote(
    memories: readonly MemoryRecord[],
    context: { projectId?: string | null; userId?: string | null } = {},
  ): MemoryPromotionResult {
    const promoted: MemoryPromotionCandidate[] = [];
    const rejected: MemoryPromotionCandidate[] = [];
    const projectEntries: ProjectMemoryEntry[] = [];
    const userEntries: UserMemoryEntry[] = [];

    for (const memory of memories) {
      const candidate = this.evaluatePromotion(memory);
      if (!candidate.targetLayer) {
        rejected.push(candidate);
        continue;
      }
      promoted.push(candidate);
      if (candidate.targetLayer === "project" && context.projectId) {
        projectEntries.push(this.projectStore.upsert(context.projectId, cloneMemoryWithLayer(memory, "project")));
      }
      if (candidate.targetLayer === "user" && context.userId) {
        userEntries.push(this.userStore.upsert(context.userId, cloneMemoryWithLayer(memory, "user")));
      }
    }

    return {
      promoted,
      rejected,
      projectEntries,
      userEntries,
    };
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
