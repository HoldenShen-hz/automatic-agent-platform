/**
 * Trust Level Service
 *
 * Manages trust levels and the LearningObject validation → approval → rollout pipeline.
 *
 * ## Trust Levels
 *
 * - private_unverified: Newly created, unverified knowledge
 * - team_reviewed: Verified by team members
 * - official: Approved as official organizational knowledge
 * - authoritative: Highest trust, official source of truth
 *
 * ## LearningObject Pipeline
 *
 * 1. validation: Initial quality check
 * 2. approval: Review and acceptance by authorized personnel
 * 3. rollout: Publication and distribution to target audiences
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
export const TRUST_LEVEL_METADATA = [
    {
        level: "private_unverified",
        displayName: "Private/Unverified",
        description: "Newly created, unverified knowledge",
        priority: 1,
    },
    {
        level: "team_reviewed",
        displayName: "Team Reviewed",
        description: "Verified by team members",
        priority: 2,
    },
    {
        level: "official",
        displayName: "Official",
        description: "Approved as official organizational knowledge",
        priority: 3,
    },
    {
        level: "authoritative",
        displayName: "Authoritative",
        description: "Highest trust, official source of truth",
        priority: 4,
    },
];
/**
 * Default trust transition rules
 */
export const DEFAULT_TRUST_TRANSITION_RULES = [
    {
        fromLevel: "private_unverified",
        toLevel: "team_reviewed",
        minValidationScore: 0.5,
        requiresApproval: false,
        requiresReviewerRole: false,
    },
    {
        fromLevel: "team_reviewed",
        toLevel: "official",
        minValidationScore: 0.75,
        requiresApproval: true,
        requiresReviewerRole: true,
    },
    {
        fromLevel: "official",
        toLevel: "authoritative",
        minValidationScore: 0.9,
        requiresApproval: true,
        requiresReviewerRole: true,
    },
];
/**
 * Gets trust level metadata
 */
export function getTrustLevelMetadata(level) {
    return TRUST_LEVEL_METADATA.find((m) => m.level === level) ?? null;
}
/**
 * Gets the priority of a trust level (higher = more trusted)
 */
export function getTrustLevelPriority(level) {
    const meta = getTrustLevelMetadata(level);
    return meta?.priority ?? 0;
}
/**
 * Compares two trust levels
 * Returns negative if a < b, 0 if a == b, positive if a > b
 */
export function compareTrustLevels(a, b) {
    return getTrustLevelPriority(a) - getTrustLevelPriority(b);
}
/**
 * Determines if transition between trust levels is allowed
 */
export function canTransitionTrustLevel(from, to, rules) {
    if (from === to) {
        return true;
    }
    const rule = rules.find((r) => r.fromLevel === from && r.toLevel === to);
    return rule != null;
}
/**
 * Trust Level Service
 *
 * Manages trust levels and LearningObject pipeline.
 */
export class TrustLevelService {
    trustRules;
    learningObjects = new Map();
    // C-11: TTL-based eviction to prevent memory leaks
    MAX_LEARNING_OBJECTS = 500;
    OBJECT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    lastEvictionTime = 0;
    EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute
    constructor(trustRules = DEFAULT_TRUST_TRANSITION_RULES) {
        this.trustRules = trustRules;
    }
    /**
     * C-11: Evict expired learning objects to prevent memory leaks.
     */
    evictExpiredObjects() {
        const now = Date.now();
        if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastEvictionTime = now;
        const expiryThreshold = now - this.OBJECT_TTL_MS;
        const entriesToDelete = [];
        for (const [id, obj] of this.learningObjects) {
            const updatedAt = new Date(obj.updatedAt).getTime();
            if (updatedAt < expiryThreshold) {
                entriesToDelete.push(id);
            }
        }
        for (const id of entriesToDelete) {
            this.learningObjects.delete(id);
        }
        // If still over capacity, remove oldest objects
        if (this.learningObjects.size > this.MAX_LEARNING_OBJECTS) {
            const sortedEntries = [...this.learningObjects.entries()].sort((a, b) => {
                const aTime = new Date(a[1].updatedAt).getTime();
                const bTime = new Date(b[1].updatedAt).getTime();
                return aTime - bTime;
            });
            const toRemove = this.learningObjects.size - this.MAX_LEARNING_OBJECTS;
            for (let i = 0; i < toRemove; i++) {
                this.learningObjects.delete(sortedEntries[i][0]);
            }
        }
    }
    /**
     * Creates a new LearningObject from a memory record
     */
    createLearningObject(memory, authorId, title, content) {
        // C-11: Evict expired objects before creating new one
        this.evictExpiredObjects();
        const now = nowIso();
        const learningObject = {
            id: newId("lo"),
            memoryId: memory.id,
            title,
            content,
            classification: memory.classification,
            authorId,
            createdAt: now,
            updatedAt: now,
            status: "draft",
            currentTrustLevel: "private_unverified",
            targetTrustLevel: "team_reviewed",
            validationScore: null,
            validationErrors: [],
            approvalNotes: null,
            approvedBy: null,
            approvedAt: null,
            rolledOutAt: null,
            rolloutTargets: [],
            metadata: {
                tags: [],
                categories: [memory.classification],
            },
        };
        this.learningObjects.set(learningObject.id, learningObject);
        return learningObject;
    }
    /**
     * Validates a LearningObject
     */
    validate(learningObjectId) {
        const obj = this.learningObjects.get(learningObjectId);
        if (!obj) {
            return {
                valid: false,
                score: 0,
                errors: ["LearningObject not found"],
                warnings: [],
            };
        }
        const errors = [];
        const warnings = [];
        let score = 1.0;
        // Check content quality
        if (obj.content.length < 20) {
            errors.push("Content too short (minimum 20 characters)");
            score -= 0.3;
        }
        else if (obj.content.length < 50) {
            warnings.push("Content may be too brief");
            score -= 0.1;
        }
        // Check title
        if (obj.title.length < 5) {
            errors.push("Title too short (minimum 5 characters)");
            score -= 0.2;
        }
        // Check classification
        if (!obj.classification || obj.classification.length === 0) {
            errors.push("Classification is required");
            score -= 0.15;
        }
        // Check metadata
        if (!obj.metadata.categories || obj.metadata.categories.length === 0) {
            warnings.push("No categories specified");
            score -= 0.05;
        }
        // Calculate validation score based on content
        const qualityIndicators = [
            obj.content.includes("."),
            obj.content.includes(" "),
            !obj.content.includes("TODO"),
            !obj.content.includes("FIXME"),
        ];
        const qualityCount = qualityIndicators.filter(Boolean).length;
        const qualityScore = qualityCount / qualityIndicators.length;
        score = score * 0.7 + qualityScore * 0.3;
        const valid = errors.length === 0 && score >= 0.5;
        // Update the LearningObject
        obj.validationScore = Math.max(0, Math.min(1, score));
        obj.validationErrors = errors;
        if (valid) {
            obj.status = "validation_pending";
        }
        else {
            obj.status = "validation_failed";
        }
        obj.updatedAt = nowIso();
        return {
            valid,
            score: obj.validationScore,
            errors,
            warnings,
        };
    }
    /**
     * Submits a LearningObject for approval
     */
    submitForApproval(learningObjectId) {
        const obj = this.learningObjects.get(learningObjectId);
        if (!obj) {
            return false;
        }
        if (obj.status !== "validation_pending" && obj.status !== "draft") {
            return false;
        }
        if (obj.validationErrors.length > 0) {
            return false;
        }
        obj.status = "approval_pending";
        obj.updatedAt = nowIso();
        return true;
    }
    /**
     * Approves a LearningObject and optionally promotes trust level
     */
    approve(request) {
        const obj = this.learningObjects.get(request.learningObjectId);
        if (!obj) {
            return false;
        }
        if (obj.status !== "approval_pending") {
            return false;
        }
        // Find the trust transition rule
        const targetLevel = request.targetTrustLevel ?? obj.targetTrustLevel;
        const rule = this.trustRules.find((r) => r.fromLevel === obj.currentTrustLevel && r.toLevel === targetLevel);
        if (!rule) {
            return false;
        }
        // Check validation score requirement
        if (obj.validationScore != null && obj.validationScore < rule.minValidationScore) {
            return false;
        }
        // Approve
        obj.status = "approved";
        obj.approvedBy = request.approvedBy;
        obj.approvedAt = nowIso();
        obj.approvalNotes = request.notes ?? null;
        obj.currentTrustLevel = targetLevel;
        obj.updatedAt = nowIso();
        return true;
    }
    /**
     * Rejects a LearningObject
     */
    reject(learningObjectId, reason) {
        const obj = this.learningObjects.get(learningObjectId);
        if (!obj) {
            return false;
        }
        if (obj.status !== "approval_pending") {
            return false;
        }
        obj.status = "rejected";
        obj.metadata.rejectionReason = reason;
        obj.updatedAt = nowIso();
        return true;
    }
    /**
     * Rolls out an approved LearningObject
     */
    rollout(request) {
        const obj = this.learningObjects.get(request.learningObjectId);
        if (!obj) {
            return {
                success: false,
                learningObject: null,
                error: "LearningObject not found",
            };
        }
        if (obj.status !== "approved") {
            return {
                success: false,
                learningObject: null,
                error: `Cannot rollout LearningObject in status: ${obj.status}`,
            };
        }
        obj.status = "rolled_out";
        obj.rolledOutAt = nowIso();
        obj.rolloutTargets = request.rolloutTargets;
        obj.updatedAt = nowIso();
        return {
            success: true,
            learningObject: obj,
            error: null,
        };
    }
    /**
     * Deprecates a LearningObject
     */
    deprecate(learningObjectId, note) {
        const obj = this.learningObjects.get(learningObjectId);
        if (!obj) {
            return false;
        }
        obj.status = "deprecated";
        if (note) {
            obj.metadata.rollbackNote = note;
        }
        obj.updatedAt = nowIso();
        return true;
    }
    /**
     * Gets a LearningObject by ID
     */
    getLearningObject(id) {
        return this.learningObjects.get(id) ?? null;
    }
    /**
     * Lists LearningObjects by status
     */
    listByStatus(status) {
        const results = [];
        for (const obj of Array.from(this.learningObjects.values())) {
            if (obj.status === status) {
                results.push(obj);
            }
        }
        return results;
    }
    /**
     * Lists LearningObjects by trust level
     */
    listByTrustLevel(trustLevel) {
        const results = [];
        for (const obj of Array.from(this.learningObjects.values())) {
            if (obj.currentTrustLevel === trustLevel) {
                results.push(obj);
            }
        }
        return results;
    }
    /**
     * Lists LearningObjects by author
     */
    listByAuthor(authorId) {
        const results = [];
        for (const obj of Array.from(this.learningObjects.values())) {
            if (obj.authorId === authorId) {
                results.push(obj);
            }
        }
        return results;
    }
    /**
     * Gets all LearningObjects
     */
    listAll() {
        return Array.from(this.learningObjects.values());
    }
    /**
     * Gets the trust transition rules
     */
    getTrustRules() {
        return this.trustRules;
    }
    /**
     * Checks if a trust level transition is allowed
     */
    canTransitionTo(from, to) {
        return canTransitionTrustLevel(from, to, this.trustRules);
    }
    /**
     * Gets the next trust level for a given level
     */
    getNextTrustLevel(current) {
        switch (current) {
            case "private_unverified":
                return "team_reviewed";
            case "team_reviewed":
                return "official";
            case "official":
                return "authoritative";
            case "authoritative":
                return null;
        }
    }
}
//# sourceMappingURL=trust-level-service.js.map