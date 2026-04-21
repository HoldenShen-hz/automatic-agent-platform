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
export type VerificationStatus = "unverified" | "pending_review" | "verified" | "rejected" | "deprecated";
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
export declare const DEFAULT_PROMOTION_RULES: readonly PromotionRule[];
/**
 * Knowledge Promotion Service
 *
 * Manages knowledge promotion with full lineage tracking.
 */
export declare class KnowledgePromotionService {
    private readonly rules;
    private readonly lineageStore;
    constructor(rules?: readonly PromotionRule[]);
    /**
     * Evaluates whether a memory can be promoted to the target tier
     */
    evaluatePromotion(memory: MemoryRecord, targetTier: KnowledgePromotionTier): {
        canPromote: boolean;
        reason: string;
        blockers: string[];
    };
    /**
     * Promotes knowledge to target tier with lineage tracking
     */
    promote(request: PromotionRequest, memory: MemoryRecord): PromotionResult;
    /**
     * Gets lineage for a memory
     */
    getLineage(memoryId: string): KnowledgeLineage[];
    /**
     * Gets the full promotion chain for a memory
     */
    getPromotionChain(memoryId: string): KnowledgeLineage[];
    /**
     * Updates verification status for a lineage entry
     */
    updateVerificationStatus(lineageId: string, status: VerificationStatus, notes?: string): boolean;
    /**
     * Gets all lineages for a specific tier
     */
    getLineagesByTier(tier: KnowledgePromotionTier): KnowledgeLineage[];
    /**
     * Gets all lineages for a specific team
     */
    getLineagesByTeam(teamId: string): KnowledgeLineage[];
    /**
     * Gets all lineages for a specific project
     */
    getLineagesByProject(projectId: string): KnowledgeLineage[];
    /**
     * Gets the promotion rules
     */
    getRules(): readonly PromotionRule[];
    /**
     * Determines tier from memory scope
     */
    private tierFromScope;
}
