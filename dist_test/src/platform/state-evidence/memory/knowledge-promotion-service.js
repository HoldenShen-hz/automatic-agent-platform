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
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * Default promotion rules
 */
export const DEFAULT_PROMOTION_RULES = [
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
 * Knowledge Promotion Service
 *
 * Manages knowledge promotion with full lineage tracking.
 */
export class KnowledgePromotionService {
    rules;
    lineageStore = new Map();
    constructor(rules = DEFAULT_PROMOTION_RULES) {
        this.rules = rules;
    }
    /**
     * Evaluates whether a memory can be promoted to the target tier
     */
    evaluatePromotion(memory, targetTier) {
        const currentTier = this.tierFromScope(memory.scope);
        const blockers = [];
        // Find applicable rule
        const rule = this.rules.find((r) => r.fromTier === currentTier && r.toTier === targetTier);
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
    promote(request, memory) {
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
        const lineage = {
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
                ...(request.teamId != null ? { teamId: request.teamId } : {}),
                ...(request.projectId != null ? { projectId: request.projectId } : {}),
                ...(request.tags != null ? { tags: request.tags } : {}),
                ...(request.categories != null ? { categories: request.categories } : {}),
                ...(request.verificationNotes != null ? { verificationNotes: request.verificationNotes } : {}),
            },
        };
        // Store lineage
        const entry = {
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
    getLineage(memoryId) {
        const results = [];
        for (const entry of Array.from(this.lineageStore.values())) {
            if (entry.lineage.originalMemoryId === memoryId ||
                entry.lineage.sourceMemoryId === memoryId ||
                entry.lineage.rootMemoryId === memoryId) {
                results.push(entry.lineage);
            }
        }
        return results;
    }
    /**
     * Gets the full promotion chain for a memory
     */
    getPromotionChain(memoryId) {
        const chain = [];
        const visited = new Set();
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
    updateVerificationStatus(lineageId, status, notes) {
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
    getLineagesByTier(tier) {
        const results = [];
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
    getLineagesByTeam(teamId) {
        const results = [];
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
    getLineagesByProject(projectId) {
        const results = [];
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
    getRules() {
        return this.rules;
    }
    /**
     * Determines tier from memory scope
     */
    tierFromScope(scope) {
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
//# sourceMappingURL=knowledge-promotion-service.js.map