/**
 * Memory Decay Service
 *
 * Implements memory decay and compression logic for the 6-layer memory model.
 *
 * ## Decay Model
 *
 * Memories decay based on:
 * - Time since last access (exponential decay)
 * - Layer-specific decay rates
 * - Access frequency (more frequent access slows decay)
 *
 * ## Compression
 *
 * When memory exceeds capacity thresholds, compression:
 * - Consolidates similar memories
 * - Removes redundant information
 * - Preserves high-quality, high-importance memories
 */
import type { MemoryRecord } from "../../contracts/types/domain.js";
import { type SixLayerMemoryType } from "./layer-transition-service.js";
/**
 * Decay configuration for a memory layer
 */
export interface DecayConfig {
    /** Half-life in seconds for decay calculation */
    halfLifeSeconds: number;
    /** Minimum freshness score a memory can have */
    minFreshness: number;
    /** Decay rate multiplier (1.0 = full decay, 0.0 = no decay) */
    decayRateMultiplier: number;
    /** Access boost factor - how much each hit slows decay */
    accessBoostFactor: number;
}
/**
 * Default decay configs per layer
 */
export declare const DEFAULT_DECAY_CONFIGS: Record<SixLayerMemoryType, DecayConfig>;
/**
 * Result of a decay calculation
 */
export interface DecayCalculation {
    memoryId: string;
    currentFreshness: number;
    previousFreshness: number;
    decayAmount: number;
    accessBoost: number;
    evaluatedAt: string;
    halfLifeSeconds: number;
    effectiveDecayRate: number;
}
/**
 * Compression candidate for memory consolidation
 */
export interface CompressionCandidate {
    memory: MemoryRecord;
    compressionScore: number;
    reason: string;
}
/**
 * Compression result
 */
export interface CompressionResult {
    candidates: CompressionCandidate[];
    totalCount: number;
    compressedCount: number;
    preservedCount: number;
}
/**
 * Memory decay summary for a set of memories
 */
export interface DecaySummary {
    totalMemories: number;
    averageFreshness: number;
    decayedMemories: number;
    freshMemories: number;
    byLayer: Record<SixLayerMemoryType, {
        count: number;
        averageFreshness: number;
        decayedCount: number;
    }>;
}
/**
 * Calculates the freshness score for a memory
 *
 * Uses exponential decay with access boosting:
 * freshness = max(minFreshness, initial * exp(-decayRate * age) * (1 + accessBoost)^hitCount)
 */
export declare function calculateFreshness(memory: MemoryRecord, config: DecayConfig, evaluatedAt?: string): number;
/**
 * Calculates how much a memory has decayed since last check
 */
export declare function calculateDecayAmount(memory: MemoryRecord, previousFreshness: number, config: DecayConfig, evaluatedAt?: string): number;
/**
 * Memory Decay Service
 *
 * Manages memory decay and compression operations.
 */
export declare class MemoryDecayService {
    private readonly decayConfigs;
    constructor(decayConfigs?: Record<SixLayerMemoryType, DecayConfig>);
    /**
     * Gets the decay configuration for a memory's layer
     */
    getDecayConfig(memory: MemoryRecord): DecayConfig;
    /**
     * Calculates current freshness for a memory
     */
    calculateFreshness(memory: MemoryRecord, evaluatedAt?: string): number;
    /**
     * Performs full decay calculation for a memory
     */
    calculateDecay(memory: MemoryRecord, previousFreshness: number, evaluatedAt?: string): DecayCalculation;
    /**
     * Generates decay summary for a set of memories
     */
    generateDecaySummary(memories: MemoryRecord[], evaluatedAt?: string): DecaySummary;
    /**
     * Evaluates compression candidates from a set of memories
     *
     * Candidates are scored based on:
     * - Quality score (higher is better)
     * - Importance score (higher is better)
     * - Hit count (higher is better)
     * - Freshness (higher is better)
     *
     * Low-scoring memories are recommended for compression/consolidation.
     */
    evaluateCompressionCandidates(memories: MemoryRecord[], evaluatedAt?: string, maxCandidates?: number): CompressionResult;
    /**
     * Gets decay configuration for a specific layer
     */
    getLayerDecayConfig(layer: SixLayerMemoryType): DecayConfig;
    /**
     * Gets all decay configurations
     */
    getAllDecayConfigs(): Record<SixLayerMemoryType, DecayConfig>;
}
