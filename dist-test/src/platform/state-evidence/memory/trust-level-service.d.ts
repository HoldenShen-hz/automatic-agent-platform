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
import type { MemoryRecord } from "../../contracts/types/domain.js";
/**
 * Trust levels in ascending order of trust
 */
export type TrustLevel = "private_unverified" | "team_reviewed" | "official" | "authoritative";
/**
 * Trust level metadata
 */
export interface TrustLevelMetadata {
    level: TrustLevel;
    displayName: string;
    description: string;
    priority: number;
}
export declare const TRUST_LEVEL_METADATA: readonly TrustLevelMetadata[];
/**
 * LearningObject status in the validation pipeline
 */
export type LearningObjectStatus = "draft" | "validation_pending" | "validation_failed" | "approval_pending" | "approved" | "rejected" | "rolled_out" | "deprecated";
/**
 * LearningObject representing a piece of knowledge in the pipeline
 */
export interface LearningObject {
    id: string;
    memoryId: string | null;
    title: string;
    content: string;
    classification: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
    status: LearningObjectStatus;
    currentTrustLevel: TrustLevel;
    targetTrustLevel: TrustLevel;
    validationScore: number | null;
    validationErrors: string[];
    approvalNotes: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    rolledOutAt: string | null;
    rolloutTargets: string[];
    metadata: LearningObjectMetadata;
}
/**
 * Additional metadata for LearningObject
 */
export interface LearningObjectMetadata {
    teamId?: string;
    projectId?: string;
    tags?: string[];
    categories?: string[];
    usageCount?: number;
    lastUsedAt?: string | null;
    rejectionReason?: string;
    rollbackNote?: string;
}
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    score: number;
    errors: string[];
    warnings: string[];
}
/**
 * Approval request
 */
export interface ApprovalRequest {
    learningObjectId: string;
    approvedBy: string;
    notes?: string;
    targetTrustLevel?: TrustLevel;
}
/**
 * Rollout request
 */
export interface RolloutRequest {
    learningObjectId: string;
    rolloutTargets: string[];
    rolledOutBy: string;
    note?: string;
}
/**
 * Rollout result
 */
export interface RolloutResult {
    success: boolean;
    learningObject: LearningObject | null;
    error: string | null;
}
/**
 * Trust transition rule
 */
export interface TrustTransitionRule {
    fromLevel: TrustLevel;
    toLevel: TrustLevel;
    minValidationScore: number;
    requiresApproval: boolean;
    requiresReviewerRole: boolean;
}
/**
 * Default trust transition rules
 */
export declare const DEFAULT_TRUST_TRANSITION_RULES: readonly TrustTransitionRule[];
/**
 * Gets trust level metadata
 */
export declare function getTrustLevelMetadata(level: TrustLevel): TrustLevelMetadata | null;
/**
 * Gets the priority of a trust level (higher = more trusted)
 */
export declare function getTrustLevelPriority(level: TrustLevel): number;
/**
 * Compares two trust levels
 * Returns negative if a < b, 0 if a == b, positive if a > b
 */
export declare function compareTrustLevels(a: TrustLevel, b: TrustLevel): number;
/**
 * Determines if transition between trust levels is allowed
 */
export declare function canTransitionTrustLevel(from: TrustLevel, to: TrustLevel, rules: readonly TrustTransitionRule[]): boolean;
/**
 * Trust Level Service
 *
 * Manages trust levels and LearningObject pipeline.
 */
export declare class TrustLevelService {
    private readonly trustRules;
    private readonly learningObjects;
    private readonly MAX_LEARNING_OBJECTS;
    private readonly OBJECT_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(trustRules?: readonly TrustTransitionRule[]);
    /**
     * C-11: Evict expired learning objects to prevent memory leaks.
     */
    private evictExpiredObjects;
    /**
     * Creates a new LearningObject from a memory record
     */
    createLearningObject(memory: MemoryRecord, authorId: string, title: string, content: string): LearningObject;
    /**
     * Validates a LearningObject
     */
    validate(learningObjectId: string): ValidationResult;
    /**
     * Submits a LearningObject for approval
     */
    submitForApproval(learningObjectId: string): boolean;
    /**
     * Approves a LearningObject and optionally promotes trust level
     */
    approve(request: ApprovalRequest): boolean;
    /**
     * Rejects a LearningObject
     */
    reject(learningObjectId: string, reason: string): boolean;
    /**
     * Rolls out an approved LearningObject
     */
    rollout(request: RolloutRequest): RolloutResult;
    /**
     * Deprecates a LearningObject
     */
    deprecate(learningObjectId: string, note?: string): boolean;
    /**
     * Gets a LearningObject by ID
     */
    getLearningObject(id: string): LearningObject | null;
    /**
     * Lists LearningObjects by status
     */
    listByStatus(status: LearningObjectStatus): LearningObject[];
    /**
     * Lists LearningObjects by trust level
     */
    listByTrustLevel(trustLevel: TrustLevel): LearningObject[];
    /**
     * Lists LearningObjects by author
     */
    listByAuthor(authorId: string): LearningObject[];
    /**
     * Gets all LearningObjects
     */
    listAll(): LearningObject[];
    /**
     * Gets the trust transition rules
     */
    getTrustRules(): readonly TrustTransitionRule[];
    /**
     * Checks if a trust level transition is allowed
     */
    canTransitionTo(from: TrustLevel, to: TrustLevel): boolean;
    /**
     * Gets the next trust level for a given level
     */
    getNextTrustLevel(current: TrustLevel): TrustLevel | null;
}
