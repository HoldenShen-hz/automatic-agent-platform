import type { MemoryRecord } from "../../contracts/types/domain.js";
import {
  cloneMemoryWithLayer,
  DEFAULT_MEMORY_PROMOTION_RULES,
  mapMemoryScopeToLayer,
  type HierarchicalMemoryLayer,
  type LayerPromotionRule,
  type MemoryPromotionCandidate,
} from "./memory-layer-model.js";
import { ProjectMemoryStore, type ProjectMemoryEntry } from "./project-memory-store.js";
import { UserMemoryStore, type UserMemoryEntry } from "./user-memory-store.js";

export interface MemoryPromotionResult {
  promoted: MemoryPromotionCandidate[];
  rejected: MemoryPromotionCandidate[];
  projectEntries: ProjectMemoryEntry[];
  userEntries: UserMemoryEntry[];
}

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
