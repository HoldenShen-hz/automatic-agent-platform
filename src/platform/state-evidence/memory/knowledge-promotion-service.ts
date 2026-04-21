/**
 * Knowledge Promotion Service
 *
 * Manages knowledge promotion across organizational boundaries:
 * personal → team → company
 *
 * ## Promotion Tiers
 *
 * - personal: Individual knowledge, private to the user
 * - team: Shared knowledge within a team
 * - company: Organizational knowledge available company-wide
 *
 * ## Lineage Tracking
 *
 * Each promotion creates a lineage record that tracks:
 * - Origin memory
 * - Promotion chain (personal → team → company)
 * - Verification status at each level
 * - Quality metrics
 */

import type { MemoryRecord } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Knowledge promotion tier
 */
export type KnowledgePromotionTier = "personal" | "team" | "company";

/**
 * Promotion status for a knowledge entry
 */
export type PromotionStatus = "pending" | "approved" | "rejected" | "superseded";

/**
 * A knowledge lineage entry tracking promotion history
 */
export interface KnowledgeLineage {
  id: string;
  originalMemoryId: string;
  rootMemoryId: string;
  promotionTier: KnowledgePromotionTier;
  promotedAt: string;
  promotedBy: string;
  sourceMemoryId: string;
  verificationStatus: VerificationStatus;
  qualityScore: number | null;
  importanceScore: number | null;
  contentHash: string;
  metadata: KnowledgeLineageMetadata;
}

/**
 * Metadata attached to a lineage entry
 */
export interface KnowledgeLineageMetadata {
  teamId?: string;
  projectId?: string;
  tags?: string[];
  categories?: string[];
  usageCount?: number;
  lastUsedAt?: string | null;
  verificationNotes?: string;
  approvalNotes?: string;
}

/**
 * Verification status for promoted knowledge
 */
export type VerificationStatus =
  | "unverified"
  | "pending_review"
  | "verified"
  | "rejected"
  | "deprecated";

/**
 * Promotion candidate for evaluation
 */
export interface PromotionCandidate {
  memory: MemoryRecord;
  targetTier: KnowledgePromotionTier;
  promotedBy: string;
  qualityScore: number | null;
  importanceScore: number | null;
  verificationNotes?: string;
}

/**
 * Promotion request
 */
export interface PromotionRequest {
  memoryId: string;
  targetTier: KnowledgePromotionTier;
  promotedBy: string;
  teamId?: string;
  projectId?: string;
  tags?: string[];
  categories?: string[];
  verificationNotes?: string;
}

/**
 * Promotion result
 */
export interface PromotionResult {
  success: boolean;
  lineage: KnowledgeLineage | null;
  rejected: boolean;
  rejectionReason: string | null;
}

/**
 * Promotion rules per tier
 */
export interface PromotionRule {
  fromTier: KnowledgePromotionTier;
  toTier: KnowledgePromotionTier;
  minQualityScore: number;
  minImportanceScore: number;
  minHitCount: number;
  requiresVerification: boolean;
}

/**
 * Default promotion rules
 */
export const DEFAULT_PROMOTION_RULES: readonly PromotionRule[] = [
  {
    fromTier: "personal",
    toTier: "team",
    minQualityScore: 0.65,
    minImportanceScore: 0.55,
    minHitCount: 5,
    requiresVerification: false,
  },
  {
    fromTier: "team",
    toTier: "company",
    minQualityScore: 0.8,
    minImportanceScore: 0.75,
    minHitCount: 15,
    requiresVerification: true,
  },
];

/**
 * Lineage entry for in-memory store
 */
interface LineageEntry {
  lineage: KnowledgeLineage;
  memories: Map<string, MemoryRecord>;
}

/**
 * Knowledge Promotion Service
 *
 * Manages knowledge promotion with full lineage tracking.
 */
export class KnowledgePromotionService {
  private readonly lineageStore: Map<string, LineageEntry> = new Map();

  public constructor(private readonly rules: readonly PromotionRule[] = DEFAULT_PROMOTION_RULES) {}

  /**
   * Evaluates whether a memory can be promoted to the target tier
   */
  public evaluatePromotion(memory: MemoryRecord, targetTier: KnowledgePromotionTier): {
    canPromote: boolean;
    reason: string;
    blockers: string[];
  } {
    const currentTier = this.tierFromScope(memory.scope);
    const blockers: string[] = [];

    // Find applicable rule
    const rule = this.rules.find(
      (r) => r.fromTier === currentTier && r.toTier === targetTier,
    );

    if (!rule) {
      return {
        canPromote: false,
        reason: `No promotion rule from ${currentTier} to ${targetTier}`,
        blockers: [`no_rule_from_${currentTier}_to_${targetTier}`],
      };
    }

    // Check thresholds
    const qualityScore = memory.qualityScore ?? 0;
    if (qualityScore < rule.minQualityScore) {
      blockers.push(`qualityScore ${qualityScore} < ${rule.minQualityScore}`);
    }

    const importanceScore = memory.importanceScore ?? 0;
    if (importanceScore < rule.minImportanceScore) {
      blockers.push(`importanceScore ${importanceScore} < ${rule.minImportanceScore}`);
    }

    if ((memory.hitCount ?? 0) < rule.minHitCount) {
      blockers.push(`hitCount ${memory.hitCount} < ${rule.minHitCount}`);
    }

    if (blockers.length > 0) {
      return {
        canPromote: false,
        reason: `Blocked by: ${blockers.join(", ")}`,
        blockers,
      };
    }

    return {
      canPromote: true,
      reason: "All thresholds met for promotion",
      blockers: [],
    };
  }

  /**
   * Promotes knowledge to target tier with lineage tracking
   */
  public promote(request: PromotionRequest, memory: MemoryRecord): PromotionResult {
    const evaluation = this.evaluatePromotion(memory, request.targetTier);

    if (!evaluation.canPromote) {
      return {
        success: false,
        lineage: null,
        rejected: true,
        rejectionReason: evaluation.reason,
      };
    }

    const currentTier = this.tierFromScope(memory.scope);

    // Determine root memory ID (follow lineage chain)
    let rootMemoryId = memory.id;
    for (const entry of Array.from(this.lineageStore.values())) {
      if (entry.lineage.sourceMemoryId === memory.id) {
        rootMemoryId = entry.lineage.rootMemoryId;
        break;
      }
    }

    // Create lineage entry
    const lineage: KnowledgeLineage = {
      id: newId("klineage"),
      originalMemoryId: memory.id,
      rootMemoryId,
      promotionTier: request.targetTier,
      promotedAt: nowIso(),
      promotedBy: request.promotedBy,
      sourceMemoryId: memory.id,
      verificationStatus: "unverified",
      qualityScore: memory.qualityScore,
      importanceScore: memory.importanceScore,
      contentHash: memory.contentHash ?? "",
      metadata: {
        teamId: request.teamId,
        projectId: request.projectId,
        tags: request.tags,
        categories: request.categories,
        verificationNotes: request.verificationNotes,
      },
    };

    // Store lineage
    const entry: LineageEntry = {
      lineage,
      memories: new Map([[memory.id, memory]]),
    };
    this.lineageStore.set(lineage.id, entry);

    return {
      success: true,
      lineage,
      rejected: false,
      rejectionReason: null,
    };
  }

  /**
   * Gets lineage for a memory
   */
  public getLineage(memoryId: string): KnowledgeLineage[] {
    const results: KnowledgeLineage[] = [];
    for (const entry of Array.from(this.lineageStore.values())) {
      if (
        entry.lineage.originalMemoryId === memoryId ||
        entry.lineage.sourceMemoryId === memoryId ||
        entry.lineage.rootMemoryId === memoryId
      ) {
        results.push(entry.lineage);
      }
    }
    return results;
  }

  /**
   * Gets the full promotion chain for a memory
   */
  public getPromotionChain(memoryId: string): KnowledgeLineage[] {
    const chain: KnowledgeLineage[] = [];
    const visited = new Set<string>();

    // Find the root
    let currentMemoryId = memoryId;
    let rootFound = false;
    for (const entry of Array.from(this.lineageStore.values())) {
      if (entry.lineage.originalMemoryId === memoryId) {
        currentMemoryId = entry.lineage.rootMemoryId;
        rootFound = true;
        break;
      }
    }

    if (!rootFound) {
      // No lineage yet, return empty
      return chain;
    }

    // Follow the chain
    let current = currentMemoryId;
    while (current != null && !visited.has(current)) {
      visited.add(current);
      let found = false;
      for (const entry of Array.from(this.lineageStore.values())) {
        if (entry.lineage.originalMemoryId === current) {
          chain.push(entry.lineage);
          current = entry.lineage.sourceMemoryId;
          found = true;
          break;
        }
      }
      if (!found) {
        break;
      }
    }

    return chain;
  }

  /**
   * Updates verification status for a lineage entry
   */
  public updateVerificationStatus(
    lineageId: string,
    status: VerificationStatus,
    notes?: string,
  ): boolean {
    const entry = this.lineageStore.get(lineageId);
    if (!entry) {
      return false;
    }

    entry.lineage.verificationStatus = status;
    if (notes) {
      entry.lineage.metadata.verificationNotes = notes;
    }

    return true;
  }

  /**
   * Gets all lineages for a specific tier
   */
  public getLineagesByTier(tier: KnowledgePromotionTier): KnowledgeLineage[] {
    const results: KnowledgeLineage[] = [];
    for (const entry of Array.from(this.lineageStore.values())) {
      if (entry.lineage.promotionTier === tier) {
        results.push(entry.lineage);
      }
    }
    return results;
  }

  /**
   * Gets all lineages for a specific team
   */
  public getLineagesByTeam(teamId: string): KnowledgeLineage[] {
    const results: KnowledgeLineage[] = [];
    for (const entry of Array.from(this.lineageStore.values())) {
      if (entry.lineage.metadata.teamId === teamId) {
        results.push(entry.lineage);
      }
    }
    return results;
  }

  /**
   * Gets all lineages for a specific project
   */
  public getLineagesByProject(projectId: string): KnowledgeLineage[] {
    const results: KnowledgeLineage[] = [];
    for (const entry of Array.from(this.lineageStore.values())) {
      if (entry.lineage.metadata.projectId === projectId) {
        results.push(entry.lineage);
      }
    }
    return results;
  }

  /**
   * Gets the promotion rules
   */
  public getRules(): readonly PromotionRule[] {
    return this.rules;
  }

  /**
   * Determines tier from memory scope
   */
  private tierFromScope(scope: string): KnowledgePromotionTier {
    switch (scope) {
      case "user":
      case "personal":
        return "personal";
      case "project":
      case "workspace":
      case "team":
        return "team";
      case "company":
      case "organization":
      case "global":
        return "company";
      default:
        return "personal";
    }
  }
}
