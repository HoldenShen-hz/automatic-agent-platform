/**
 * Layer Transition Service
 *
 * Manages transitions between the 6-layer memory model:
 * working → session → episodic → semantic → procedural → meta
 *
 * ## Layer Definitions
 *
 * - working: Immediate context, active task execution (seconds to minutes)
 * - session: Current session context (minutes to hours)
 * - episodic: Event-based memories, experiences (hours to days)
 * - semantic: Consolidated facts and knowledge (days to weeks)
 * - procedural: Skills, patterns, workflows (weeks to months)
 * - meta: Learning how to learn, self-awareness (permanent)
 *
 * ## Transition Rules
 *
 * Memories transition upward through layers based on:
 * - Access frequency (hit count)
 * - Quality score thresholds
 * - Importance score thresholds
 * - Time spent in current layer (age)
 */

import type { MemoryRecord } from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";

/**
 * 6-layer memory hierarchy
 */
export type SixLayerMemoryType =
  | "working"
  | "session"
  | "episodic"
  | "semantic"
  | "procedural"
  | "meta";

/**
 * Layer transition direction
 */
export type LayerTransitionDirection = "up" | "down" | "lateral";

/**
 * Result of a layer transition evaluation
 */
export interface LayerTransitionEvaluation {
  canTransition: boolean;
  targetLayer: SixLayerMemoryType | null;
  reason: string;
  blockers: string[];
}

/**
 * A transition rule between layers
 */
export interface LayerTransitionRule {
  from: SixLayerMemoryType;
  to: SixLayerMemoryType;
  minHitCount: number;
  minQualityScore: number;
  minImportanceScore: number;
  minAgeHours: number;
}

/**
 * Record of a layer transition
 */
export interface LayerTransitionRecord {
  memoryId: string;
  fromLayer: SixLayerMemoryType;
  toLayer: SixLayerMemoryType;
  transitionedAt: string;
  reason: string;
  hitCount: number;
  qualityScore: number | null;
  importanceScore: number | null;
}

/**
 * Default transition rules for 6-layer model
 */
export const DEFAULT_SIX_LAYER_TRANSITION_RULES: readonly LayerTransitionRule[] = [
  { from: "working", to: "session", minHitCount: 3, minQualityScore: 0.4, minImportanceScore: 0.3, minAgeHours: 0.5 },
  { from: "session", to: "episodic", minHitCount: 8, minQualityScore: 0.55, minImportanceScore: 0.5, minAgeHours: 2 },
  { from: "episodic", to: "semantic", minHitCount: 10, minQualityScore: 0.8, minImportanceScore: 0.65, minAgeHours: 24 },
  { from: "semantic", to: "procedural", minHitCount: 25, minQualityScore: 0.8, minImportanceScore: 0.75, minAgeHours: 72 },
  { from: "procedural", to: "meta", minHitCount: 40, minQualityScore: 0.9, minImportanceScore: 0.85, minAgeHours: 168 },
];

/**
 * Layer metadata for display and decision making
 */
export interface LayerMetadata {
  layer: SixLayerMemoryType;
  displayName: string;
  description: string;
  typicalRetentionSeconds: number;
  decayRateMultiplier: number;
  priority: number;
}

export const LAYER_METADATA: readonly LayerMetadata[] = [
  {
    layer: "working",
    displayName: "Working Memory",
    description: "Active task context, immediately accessible",
    typicalRetentionSeconds: 300, // 5 minutes
    decayRateMultiplier: 1.0,
    priority: 6,
  },
  {
    layer: "session",
    displayName: "Session Memory",
    description: "Current session context and recent interactions",
    typicalRetentionSeconds: 3600, // 1 hour
    decayRateMultiplier: 0.8,
    priority: 5,
  },
  {
    layer: "episodic",
    displayName: "Episodic Memory",
    description: "Event-based memories and experiences",
    typicalRetentionSeconds: 86400, // 1 day
    decayRateMultiplier: 0.6,
    priority: 4,
  },
  {
    layer: "semantic",
    displayName: "Semantic Memory",
    description: "Consolidated facts and knowledge",
    typicalRetentionSeconds: 604800, // 1 week
    decayRateMultiplier: 0.4,
    priority: 3,
  },
  {
    layer: "procedural",
    displayName: "Procedural Memory",
    description: "Skills, patterns, and workflows",
    typicalRetentionSeconds: 2592000, // 30 days
    decayRateMultiplier: 0.2,
    priority: 2,
  },
  {
    layer: "meta",
    displayName: "Meta Memory",
    description: "Self-awareness and learning strategies",
    typicalRetentionSeconds: Number.POSITIVE_INFINITY,
    decayRateMultiplier: 0.0,
    priority: 1,
  },
];

/**
 * Maps memory scope to 6-layer type
 */
export function mapScopeToSixLayer(scope: string): SixLayerMemoryType {
  const normalizedScope = scope.trim().toLowerCase().replace(/[\s-]+/g, "_");
  switch (normalizedScope) {
    case "task_runtime":
    case "working":
      return "working";
    case "session":
      return "session";
    case "agent":
    case "episode":
    case "episodic":
      return "episodic";
    case "workspace":
    case "project":
      return "semantic";
    case "semantic":
      return "semantic";
    case "user":
    case "procedure":
    case "procedural":
      return "procedural";
    case "experience":
    case "evolution":
    case "meta":
      return "meta";
    default:
      throw new ValidationError(
        "memory.six_layer_unknown_scope",
        `memory.six_layer_unknown_scope:${scope}`,
        {
          retryable: false,
          details: { scope },
        },
      );
  }
}

/**
 * Maps 6-layer type to scope string
 */
export function mapLayerToScope(layer: SixLayerMemoryType): string {
  switch (layer) {
    case "working":
      return "working";
    case "session":
      return "session";
    case "episodic":
      return "episodic";
    case "semantic":
      return "semantic";
    case "procedural":
      return "procedural";
    case "meta":
      return "meta";
  }
}

/**
 * Gets the next layer in the hierarchy (or null if at top)
 */
export function getNextLayer(current: SixLayerMemoryType): SixLayerMemoryType | null {
  switch (current) {
    case "working":
      return "session";
    case "session":
      return "episodic";
    case "episodic":
      return "semantic";
    case "semantic":
      return "procedural";
    case "procedural":
      return "meta";
    case "meta":
      return null;
  }
}

/**
 * Gets the previous layer in the hierarchy (or null if at bottom)
 */
export function getPreviousLayer(current: SixLayerMemoryType): SixLayerMemoryType | null {
  switch (current) {
    case "working":
      return null;
    case "session":
      return "working";
    case "episodic":
      return "session";
    case "semantic":
      return "episodic";
    case "procedural":
      return "semantic";
    case "meta":
      return "procedural";
  }
}

/**
 * Gets layer metadata by layer type
 */
export function getLayerMetadata(layer: SixLayerMemoryType): LayerMetadata | null {
  return LAYER_METADATA.find((m) => m.layer === layer) ?? null;
}

/**
 * Gets the layer priority (lower number = higher priority/longer retention)
 */
export function getLayerPriority(layer: SixLayerMemoryType): number {
  const meta = getLayerMetadata(layer);
  return meta?.priority ?? 0;
}

/**
 * Layer Transition Service
 *
 * Evaluates and executes transitions between memory layers.
 */
export class LayerTransitionService {
  public constructor(private readonly rules: readonly LayerTransitionRule[] = DEFAULT_SIX_LAYER_TRANSITION_RULES) {}

  private resolveLayerAgeAnchor(memory: MemoryRecord): Date {
    const createdAt = new Date(memory.createdAt);
    const lastAccessedAt = memory.lastAccessedAt == null ? null : new Date(memory.lastAccessedAt);
    if (!Number.isFinite(createdAt.getTime())) {
      throw new ValidationError(
        "memory.transition_invalid_created_at",
        `memory.transition_invalid_created_at:${memory.id}`,
        {
          retryable: false,
          details: { memoryId: memory.id, createdAt: memory.createdAt },
        },
      );
    }
    if (lastAccessedAt != null && Number.isFinite(lastAccessedAt.getTime()) && lastAccessedAt.getTime() >= createdAt.getTime()) {
      return lastAccessedAt;
    }
    return createdAt;
  }

  private shouldDemote(memory: MemoryRecord, currentLayer: SixLayerMemoryType, evaluatedAt: Date): boolean {
    const previousLayer = getPreviousLayer(currentLayer);
    const layerMetadata = getLayerMetadata(currentLayer);
    if (previousLayer == null || layerMetadata == null || !Number.isFinite(layerMetadata.typicalRetentionSeconds)) {
      return false;
    }
    const anchor = this.resolveLayerAgeAnchor(memory);
    const ageSeconds = Math.max(0, (evaluatedAt.getTime() - anchor.getTime()) / 1000);
    const lowSignal =
      memory.hitCount <= 1
      && (memory.qualityScore ?? 0) < 0.5
      && (memory.importanceScore ?? 0) < 0.5;
    return ageSeconds > layerMetadata.typicalRetentionSeconds && lowSignal;
  }

  /**
   * Evaluates whether a memory can transition to the next layer
   */
  public evaluateTransition(memory: MemoryRecord, evaluatedAt: string): LayerTransitionEvaluation {
    const currentLayer = mapScopeToSixLayer(memory.scope);
    const blockers: string[] = [];
    if (evaluatedAt.trim().length === 0) {
      throw new ValidationError("memory.transition_missing_evaluated_at", "memory.transition_missing_evaluated_at");
    }

    // Check if already at top layer
    if (currentLayer === "meta") {
      return {
        canTransition: false,
        targetLayer: null,
        reason: "Already at top layer (meta)",
        blockers: ["at_max_layer"],
      };
    }

    // Find applicable rule
    const rule = this.rules.find((r) => r.from === currentLayer);
    if (!rule) {
      return {
        canTransition: false,
        targetLayer: null,
        reason: `No transition rule from layer ${currentLayer}`,
        blockers: ["no_rule_found"],
      };
    }

    // Check hit count threshold
    if (memory.hitCount < rule.minHitCount) {
      blockers.push(`hitCount ${memory.hitCount} < ${rule.minHitCount}`);
    }

    // Check quality score threshold
    const qualityScore = memory.qualityScore ?? 0;
    if (qualityScore < rule.minQualityScore) {
      blockers.push(`qualityScore ${qualityScore} < ${rule.minQualityScore}`);
    }

    // Check importance score threshold
    const importanceScore = memory.importanceScore ?? 0;
    if (importanceScore < rule.minImportanceScore) {
      blockers.push(`importanceScore ${importanceScore} < ${rule.minImportanceScore}`);
    }

    // Check age threshold
    const evaluated = new Date(evaluatedAt);
    if (!Number.isFinite(evaluated.getTime())) {
      throw new ValidationError(
        "memory.transition_invalid_evaluated_at",
        `memory.transition_invalid_evaluated_at:${evaluatedAt}`,
        {
          retryable: false,
          details: { evaluatedAt },
        },
      );
    }
    if (memory.lastAccessedAt != null) {
      const createdAt = new Date(memory.createdAt);
      const lastAccessedAt = new Date(memory.lastAccessedAt);
      if (Number.isFinite(createdAt.getTime()) && Number.isFinite(lastAccessedAt.getTime()) && lastAccessedAt.getTime() < createdAt.getTime()) {
        blockers.push("clock_skew_detected:lastAccessedAt_before_createdAt");
      }
    }
    // Fail closed on recent mutations/accesses: when we do not track an explicit
    // "entered current layer at" timestamp, the newest observable timestamp is the
    // safest proxy for time-in-current-layer.
    const layerAgeAnchor = this.resolveLayerAgeAnchor(memory);
    const ageHours = (evaluated.getTime() - layerAgeAnchor.getTime()) / (1000 * 60 * 60);
    if (ageHours < rule.minAgeHours) {
      blockers.push(`age ${ageHours.toFixed(2)}h < ${rule.minAgeHours}h`);
    }

    if (blockers.length > 0) {
      return {
        canTransition: false,
        targetLayer: rule.to,
        reason: `Blocked by: ${blockers.join(", ")}`,
        blockers,
      };
    }

    return {
      canTransition: true,
      targetLayer: rule.to,
      reason: "All thresholds met",
      blockers: [],
    };
  }

  /**
   * Gets the transition direction for a memory
   */
  public getTransitionDirection(memory: MemoryRecord, evaluatedAt: string): LayerTransitionDirection {
    const currentLayer = mapScopeToSixLayer(memory.scope);
    const evaluation = this.evaluateTransition(memory, evaluatedAt);

    if (evaluation.canTransition && evaluation.targetLayer !== null) {
      const currentPriority = getLayerPriority(currentLayer);
      const targetPriority = getLayerPriority(evaluation.targetLayer);

      if (targetPriority < currentPriority) {
        return "up";
      }
      return "lateral";
    }

    if (this.shouldDemote(memory, currentLayer, new Date(evaluatedAt))) {
      return "down";
    }

    return "lateral";
  }

  /**
   * Gets applicable rule for a layer transition
   */
  public getRule(fromLayer: SixLayerMemoryType): LayerTransitionRule | null {
    return this.rules.find((r) => r.from === fromLayer) ?? null;
  }

  /**
   * Gets all transition rules
   */
  public getRules(): readonly LayerTransitionRule[] {
    return this.rules;
  }

  /**
   * Creates a transition record for audit trail
   */
  public createTransitionRecord(
    memory: MemoryRecord,
    evaluation: LayerTransitionEvaluation,
  ): LayerTransitionRecord | null {
    if (!evaluation.canTransition || evaluation.targetLayer === null) {
      return null;
    }

    const currentLayer = mapScopeToSixLayer(memory.scope);
    return {
      memoryId: memory.id,
      fromLayer: currentLayer,
      toLayer: evaluation.targetLayer,
      transitionedAt: new Date().toISOString(),
      reason: evaluation.reason,
      hitCount: memory.hitCount,
      qualityScore: memory.qualityScore,
      importanceScore: memory.importanceScore,
    };
  }
}
