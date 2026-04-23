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
/**
 * 6-layer memory hierarchy
 */
export type SixLayerMemoryType = "working" | "session" | "episodic" | "semantic" | "procedural" | "meta";
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
export declare const DEFAULT_SIX_LAYER_TRANSITION_RULES: readonly LayerTransitionRule[];
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
export declare const LAYER_METADATA: readonly LayerMetadata[];
/**
 * Maps memory scope to 6-layer type
 */
export declare function mapScopeToSixLayer(scope: string): SixLayerMemoryType;
/**
 * Maps 6-layer type to scope string
 */
export declare function mapLayerToScope(layer: SixLayerMemoryType): string;
/**
 * Gets the next layer in the hierarchy (or null if at top)
 */
export declare function getNextLayer(current: SixLayerMemoryType): SixLayerMemoryType | null;
/**
 * Gets the previous layer in the hierarchy (or null if at bottom)
 */
export declare function getPreviousLayer(current: SixLayerMemoryType): SixLayerMemoryType | null;
/**
 * Gets layer metadata by layer type
 */
export declare function getLayerMetadata(layer: SixLayerMemoryType): LayerMetadata | null;
/**
 * Gets the layer priority (lower number = higher priority/longer retention)
 */
export declare function getLayerPriority(layer: SixLayerMemoryType): number;
/**
 * Layer Transition Service
 *
 * Evaluates and executes transitions between memory layers.
 */
export declare class LayerTransitionService {
    private readonly rules;
    constructor(rules?: readonly LayerTransitionRule[]);
    /**
     * Evaluates whether a memory can transition to the next layer
     */
    evaluateTransition(memory: MemoryRecord, evaluatedAt?: string): LayerTransitionEvaluation;
    /**
     * Gets the transition direction for a memory
     */
    getTransitionDirection(memory: MemoryRecord): LayerTransitionDirection;
    /**
     * Gets applicable rule for a layer transition
     */
    getRule(fromLayer: SixLayerMemoryType): LayerTransitionRule | null;
    /**
     * Gets all transition rules
     */
    getRules(): readonly LayerTransitionRule[];
    /**
     * Creates a transition record for audit trail
     */
    createTransitionRecord(memory: MemoryRecord, evaluation: LayerTransitionEvaluation): LayerTransitionRecord | null;
}
