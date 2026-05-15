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
import { nowIso } from "../../contracts/types/ids.js";
import {
  mapScopeToSixLayer,
  type SixLayerMemoryType,
} from "./layer-transition-service.js";

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
 * R5-50: working/procedural use linear decay (no silent discard) instead of exponential
 */
export const DEFAULT_DECAY_CONFIGS: Record<SixLayerMemoryType, DecayConfig> = {
  working: {
    halfLifeSeconds: 300, // 5 minutes
    minFreshness: 0.1,
    decayRateMultiplier: 0.0, // R5-50: Linear decay only - no exponential
    accessBoostFactor: 0.1,
  },
  session: {
    halfLifeSeconds: 3600, // 1 hour
    minFreshness: 0.15,
    decayRateMultiplier: 0.8,
    accessBoostFactor: 0.08,
  },
  episodic: {
    halfLifeSeconds: 86400, // 1 day
    minFreshness: 0.2,
    decayRateMultiplier: 0.6,
    accessBoostFactor: 0.05,
  },
  semantic: {
    halfLifeSeconds: 604800, // 1 week
    minFreshness: 0.25,
    decayRateMultiplier: 0.4,
    accessBoostFactor: 0.03,
  },
  procedural: {
    halfLifeSeconds: 2592000, // 30 days
    minFreshness: 0.3,
    decayRateMultiplier: 0.0, // R5-50: Linear decay only - no exponential
    accessBoostFactor: 0.02,
  },
  meta: {
    halfLifeSeconds: Number.POSITIVE_INFINITY,
    minFreshness: 0.5,
    decayRateMultiplier: 0.0,
    accessBoostFactor: 0.01,
  },
};

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
 * Uses exponential decay with access boosting for most layers.
 * R5-50: working/procedural layers use linear decay instead of exponential.
 * freshness = max(minFreshness, initial * exp(-decayRate * age) * (1 + accessBoost)^hitCount)
 * For linear decay: freshness = max(minFreshness, 1 - (ageSeconds / halfLifeSeconds))
 */
export function calculateFreshness(
  memory: MemoryRecord,
  config: DecayConfig,
  evaluatedAt: string = nowIso(),
): number {
  const createdAt = new Date(memory.createdAt).getTime();
  const evaluated = new Date(evaluatedAt).getTime();
  const ageSeconds = (evaluated - createdAt) / 1000;

  // Base freshness starts at 1.0
  let freshness = 1.0;

  // R5-50: Linear decay for working/procedural (decayRateMultiplier: 0.0)
  // Linear decay: freshness = max(minFreshness, 1 - age/halfLife)
  const isLinearDecay = config.decayRateMultiplier === 0.0;
  if (isLinearDecay && config.halfLifeSeconds !== Number.POSITIVE_INFINITY && config.halfLifeSeconds > 0) {
    freshness = Math.max(config.minFreshness, 1 - (ageSeconds / config.halfLifeSeconds));
  } else if (config.halfLifeSeconds !== Number.POSITIVE_INFINITY && config.halfLifeSeconds > 0) {
    // Apply exponential decay based on layer half-life
    const decayRate = Math.LN2 / config.halfLifeSeconds;
    const effectiveDecayRate = decayRate * config.decayRateMultiplier;
    freshness = freshness * Math.exp(-effectiveDecayRate * ageSeconds);
  } else {
    // Meta layer has no decay
    freshness = 1.0;
  }

  // Apply access boost (each hit slows decay)
  const accessBoost = Math.pow(1 + config.accessBoostFactor, memory.hitCount);
  freshness = freshness * accessBoost;

  // Clamp to minFreshness
  return Math.max(config.minFreshness, Math.min(1.0, freshness));
}

/**
 * Calculates how much a memory has decayed since last check
 */
export function calculateDecayAmount(
  memory: MemoryRecord,
  previousFreshness: number,
  config: DecayConfig,
  evaluatedAt: string = nowIso(),
): number {
  const currentFreshness = calculateFreshness(memory, config, evaluatedAt);
  return Math.max(0, previousFreshness - currentFreshness);
}

/**
 * Memory Decay Service
 *
 * Manages memory decay and compression operations.
 */
export class MemoryDecayService {
  public constructor(
    private readonly decayConfigs: Record<SixLayerMemoryType, DecayConfig> = DEFAULT_DECAY_CONFIGS,
  ) {}

  /**
   * Gets the decay configuration for a memory's layer
   */
  public getDecayConfig(memory: MemoryRecord): DecayConfig {
    const mappedLayer = mapScopeToSixLayer(memory.scope);
    return this.decayConfigs[mappedLayer] ?? this.decayConfigs.session;
  }

  /**
   * Calculates current freshness for a memory
   */
  public calculateFreshness(memory: MemoryRecord, evaluatedAt: string = nowIso()): number {
    const config = this.getDecayConfig(memory);
    return calculateFreshness(memory, config, evaluatedAt);
  }

  /**
   * Performs full decay calculation for a memory
   */
  public calculateDecay(
    memory: MemoryRecord,
    previousFreshness: number,
    evaluatedAt: string = nowIso(),
  ): DecayCalculation {
    const config = this.getDecayConfig(memory);
    const currentFreshness = calculateFreshness(memory, config, evaluatedAt);
    const decayAmount = Math.max(0, previousFreshness - currentFreshness);

    // Calculate access boost
    const accessBoost = Math.pow(1 + config.accessBoostFactor, memory.hitCount);

    // Calculate effective decay rate
    const decayRate = config.halfLifeSeconds > 0
      ? Math.LN2 / config.halfLifeSeconds
      : 0;
    const effectiveDecayRate = decayRate * config.decayRateMultiplier;

    return {
      memoryId: memory.id,
      currentFreshness,
      previousFreshness,
      decayAmount,
      accessBoost,
      evaluatedAt,
      halfLifeSeconds: config.halfLifeSeconds,
      effectiveDecayRate,
    };
  }

  /**
   * Generates decay summary for a set of memories
   */
  public generateDecaySummary(
    memories: MemoryRecord[],
    evaluatedAt: string = nowIso(),
  ): DecaySummary {
    const byLayer: Record<SixLayerMemoryType, {
      count: number;
      averageFreshness: number;
      decayedCount: number;
    }> = {
      working: { count: 0, averageFreshness: 0, decayedCount: 0 },
      session: { count: 0, averageFreshness: 0, decayedCount: 0 },
      episodic: { count: 0, averageFreshness: 0, decayedCount: 0 },
      semantic: { count: 0, averageFreshness: 0, decayedCount: 0 },
      procedural: { count: 0, averageFreshness: 0, decayedCount: 0 },
      meta: { count: 0, averageFreshness: 0, decayedCount: 0 },
    };

    let totalFreshness = 0;
    let decayedCount = 0;

    for (const memory of memories) {
      const freshness = this.calculateFreshness(memory, evaluatedAt);
      const config = this.getDecayConfig(memory);
      const layer = mapScopeToSixLayer(memory.scope);

      totalFreshness += freshness;

      if (freshness <= config.minFreshness) {
        decayedCount++;
        byLayer[layer].decayedCount++;
      }

      byLayer[layer].count++;
      byLayer[layer].averageFreshness =
        (byLayer[layer].averageFreshness * (byLayer[layer].count - 1) + freshness) / byLayer[layer].count;
    }

    return {
      totalMemories: memories.length,
      averageFreshness: memories.length > 0 ? totalFreshness / memories.length : 0,
      decayedMemories: decayedCount,
      freshMemories: memories.length - decayedCount,
      byLayer,
    };
  }

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
  public evaluateCompressionCandidates(
    memories: MemoryRecord[],
    evaluatedAt: string = nowIso(),
    maxCandidates?: number,
  ): CompressionResult {
    const candidates: CompressionCandidate[] = [];

    for (const memory of memories) {
      const freshness = this.calculateFreshness(memory, evaluatedAt);
      const config = this.getDecayConfig(memory);

      // Calculate compression score (0-1, higher is better to keep)
      const qualityScore = memory.qualityScore ?? 0.5;
      const importanceScore = memory.importanceScore ?? 0.5;
      const hitScore = Math.min(1.0, (memory.hitCount ?? 0) / 20);

      // Weighted combination
      const compressionScore = (
        qualityScore * 0.35 +
        importanceScore * 0.35 +
        freshness * 0.2 +
        hitScore * 0.1
      );

      // Determine reason for compression candidate
      let reason = "Low overall score";
      if (freshness <= config.minFreshness) {
        reason = `Freshness ${freshness.toFixed(3)} below minimum ${config.minFreshness}`;
      } else if (qualityScore < 0.4) {
        reason = `Low quality score ${qualityScore}`;
      } else if (importanceScore < 0.3) {
        reason = `Low importance score ${importanceScore}`;
      }

      candidates.push({
        memory,
        compressionScore,
        reason,
      });
    }

    // Sort by score (lowest first = highest compression priority)
    candidates.sort((a, b) => a.compressionScore - b.compressionScore);

    // Apply max limit if specified
    const limitedCandidates = maxCandidates != null
      ? candidates.slice(0, maxCandidates)
      : candidates;

    return {
      candidates: limitedCandidates,
      totalCount: memories.length,
      compressedCount: limitedCandidates.length,
      preservedCount: memories.length - limitedCandidates.length,
    };
  }

  /**
   * Gets decay configuration for a specific layer
   */
  public getLayerDecayConfig(layer: SixLayerMemoryType): DecayConfig {
    return this.decayConfigs[layer];
  }

  /**
   * Gets all decay configurations
   */
  public getAllDecayConfigs(): Record<SixLayerMemoryType, DecayConfig> {
    return { ...this.decayConfigs };
  }
}
