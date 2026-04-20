import type { MemoryRecord } from "../../contracts/types/domain.js";

export type HierarchicalMemoryLayer =
  | "runtime"
  | "session"
  | "agent"
  | "project"
  | "user"
  | "evolution";

export interface LayerPromotionRule {
  from: HierarchicalMemoryLayer;
  to: HierarchicalMemoryLayer;
  minHitCount: number;
  minQualityScore: number;
  minImportanceScore: number;
}

export interface MemoryPromotionCandidate {
  memory: MemoryRecord;
  currentLayer: HierarchicalMemoryLayer;
  targetLayer: HierarchicalMemoryLayer | null;
  satisfiedRule: LayerPromotionRule | null;
}

export const DEFAULT_MEMORY_PROMOTION_RULES: readonly LayerPromotionRule[] = [
  { from: "session", to: "agent", minHitCount: 3, minQualityScore: 0.6, minImportanceScore: 0.5 },
  { from: "agent", to: "project", minHitCount: 8, minQualityScore: 0.75, minImportanceScore: 0.65 },
  { from: "project", to: "user", minHitCount: 12, minQualityScore: 0.8, minImportanceScore: 0.75 },
  { from: "user", to: "evolution", minHitCount: 20, minQualityScore: 0.9, minImportanceScore: 0.85 },
];

export function mapMemoryScopeToLayer(scope: string): HierarchicalMemoryLayer {
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

export function cloneMemoryWithLayer(memory: MemoryRecord, layer: HierarchicalMemoryLayer): MemoryRecord {
  return {
    ...memory,
    scope: layer === "project" ? "project" : layer,
  };
}
