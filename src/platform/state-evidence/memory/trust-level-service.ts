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
import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Trust levels in ascending order of trust
 */
export type TrustLevel =
  | "private_unverified"
  | "team_reviewed"
  | "official"
  | "authoritative";

/**
 * Trust level metadata
 */
export interface TrustLevelMetadata {
  level: TrustLevel;
  displayName: string;
  description: string;
  priority: number;
}

export const TRUST_LEVEL_METADATA: readonly TrustLevelMetadata[] = [
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
 * LearningObject status in the validation pipeline
 */
export type LearningObjectStatus =
  | "draft"
  | "validation_pending"
  | "validation_failed"
  | "approval_pending"
  | "approved"
  | "rejected"
  | "rolled_out"
  | "deprecated";

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
export const DEFAULT_TRUST_TRANSITION_RULES: readonly TrustTransitionRule[] = [
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
export function getTrustLevelMetadata(level: TrustLevel): TrustLevelMetadata | null {
  return TRUST_LEVEL_METADATA.find((m) => m.level === level) ?? null;
}

/**
 * Gets the priority of a trust level (higher = more trusted)
 */
export function getTrustLevelPriority(level: TrustLevel): number {
  const meta = getTrustLevelMetadata(level);
  return meta?.priority ?? 0;
}

/**
 * Compares two trust levels
 * Returns negative if a < b, 0 if a == b, positive if a > b
 */
export function compareTrustLevels(a: TrustLevel, b: TrustLevel): number {
  return getTrustLevelPriority(a) - getTrustLevelPriority(b);
}

/**
 * Determines if transition between trust levels is allowed
 */
export function canTransitionTrustLevel(
  from: TrustLevel,
  to: TrustLevel,
  rules: readonly TrustTransitionRule[],
): boolean {
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
  private readonly learningObjects: Map<string, LearningObject> = new Map();

  public constructor(
    private readonly trustRules: readonly TrustTransitionRule[] = DEFAULT_TRUST_TRANSITION_RULES,
  ) {}

  /**
   * Creates a new LearningObject from a memory record
   */
  public createLearningObject(
    memory: MemoryRecord,
    authorId: string,
    title: string,
    content: string,
  ): LearningObject {
    const now = nowIso();
    const learningObject: LearningObject = {
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
  public validate(learningObjectId: string): ValidationResult {
    const obj = this.learningObjects.get(learningObjectId);
    if (!obj) {
      return {
        valid: false,
        score: 0,
        errors: ["LearningObject not found"],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    // Check content quality
    if (obj.content.length < 20) {
      errors.push("Content too short (minimum 20 characters)");
      score -= 0.3;
    } else if (obj.content.length < 50) {
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
    } else {
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
  public submitForApproval(learningObjectId: string): boolean {
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
  public approve(request: ApprovalRequest): boolean {
    const obj = this.learningObjects.get(request.learningObjectId);
    if (!obj) {
      return false;
    }

    if (obj.status !== "approval_pending") {
      return false;
    }

    // Find the trust transition rule
    const targetLevel = request.targetTrustLevel ?? obj.targetTrustLevel;
    const rule = this.trustRules.find(
      (r) => r.fromLevel === obj.currentTrustLevel && r.toLevel === targetLevel,
    );

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
  public reject(learningObjectId: string, reason: string): boolean {
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
  public rollout(request: RolloutRequest): RolloutResult {
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
  public deprecate(learningObjectId: string, note?: string): boolean {
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
  public getLearningObject(id: string): LearningObject | null {
    return this.learningObjects.get(id) ?? null;
  }

  /**
   * Lists LearningObjects by status
   */
  public listByStatus(status: LearningObjectStatus): LearningObject[] {
    const results: LearningObject[] = [];
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
  public listByTrustLevel(trustLevel: TrustLevel): LearningObject[] {
    const results: LearningObject[] = [];
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
  public listByAuthor(authorId: string): LearningObject[] {
    const results: LearningObject[] = [];
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
  public listAll(): LearningObject[] {
    return Array.from(this.learningObjects.values());
  }

  /**
   * Gets the trust transition rules
   */
  public getTrustRules(): readonly TrustTransitionRule[] {
    return this.trustRules;
  }

  /**
   * Checks if a trust level transition is allowed
   */
  public canTransitionTo(from: TrustLevel, to: TrustLevel): boolean {
    return canTransitionTrustLevel(from, to, this.trustRules);
  }

  /**
   * Gets the next trust level for a given level
   */
  public getNextTrustLevel(current: TrustLevel): TrustLevel | null {
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
