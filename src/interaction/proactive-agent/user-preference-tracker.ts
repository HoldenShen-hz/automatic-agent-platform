/**
 * User Preference Tracker for Proactive Agent
 *
 * Tracks user responses to proactive suggestions and learns from adoption patterns
 * to adjust trigger frequency and relevance.
 *
 * ## Purpose
 *
 * Solves the "notification fatigue" problem by learning which suggestions
 * users find valuable and which are ignored. This data feeds back into
 * the trigger frequency to reduce noise.
 *
 * ## Tracking Data
 *
 * - Suggestion adoption vs dismissal rates
 * - Per-trigger and per-domain preference scores
 * - Historical feedback for pattern learning
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * User response to a suggestion.
 */
export type SuggestionResponse = "adopted" | "dismissed" | "ignored";

/**
 * Record of a single user response to a suggestion.
 */
export interface SuggestionFeedback {
  feedbackId: string;
  suggestionId: string;
  triggerId: string;
  domainId: string;
  response: SuggestionResponse;
  respondedAt: string;
  latencyMs?: number; // How long it took user to respond
}

/**
 * Aggregated preference statistics for a trigger.
 */
export interface TriggerPreferenceStats {
  triggerId: string;
  totalSuggestions: number;
  adoptedCount: number;
  dismissedCount: number;
  ignoredCount: number;
  adoptionRate: number; // 0-1
  dismissalRate: number; // 0-1
  avgResponseLatencyMs: number | null;
  lastUpdatedAt: string;
}

/**
 * Aggregated preference statistics for a domain.
 */
export interface DomainPreferenceStats {
  domainId: string;
  totalSuggestions: number;
  adoptedCount: number;
  dismissedCount: number;
  ignoredCount: number;
  adoptionRate: number;
  dismissalRate: number;
  avgResponseLatencyMs: number | null;
  lastUpdatedAt: string;
}

/**
 * Configuration for user preference learning.
 */
export interface PreferenceTrackerConfig {
  /** Minimum number of samples before adjusting frequency */
  minSamplesForAdjustment: number;
  /** Adoption rate below which frequency should decrease */
  lowAdoptionThreshold: number;
  /** Adoption rate above which frequency can increase */
  highAdoptionThreshold: number;
  /** Maximum frequency multiplier (e.g., 2.0 = double the frequency) */
  maxFrequencyMultiplier: number;
  /** Minimum frequency multiplier (e.g., 0.1 = reduce to 10%) */
  minFrequencyMultiplier: number;
  /** Time window for calculating adoption rate (in days) */
  analysisWindowDays: number;
}

const DEFAULT_CONFIG: PreferenceTrackerConfig = {
  minSamplesForAdjustment: 5,
  lowAdoptionThreshold: 0.3,
  highAdoptionThreshold: 0.7,
  maxFrequencyMultiplier: 2.0,
  minFrequencyMultiplier: 0.1,
  analysisWindowDays: 7,
};

/**
 * Tracks user preferences for proactive suggestions.
 *
 * Provides data to:
 * 1. Reduce trigger frequency for low-adoption triggers
 * 2. Increase trigger frequency for high-adoption triggers
 * 3. Identify which domains have the most valuable suggestions
 */
export class UserPreferenceTracker {
  private readonly feedback: SuggestionFeedback[] = [];
  private readonly config: PreferenceTrackerConfig;

  public constructor(config: Partial<PreferenceTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Records user feedback for a suggestion.
   */
  public recordFeedback(
    suggestionId: string,
    triggerId: string,
    domainId: string,
    response: SuggestionResponse,
    latencyMs?: number,
  ): SuggestionFeedback {
    const feedback: SuggestionFeedback = {
      feedbackId: newId("feedback"),
      suggestionId,
      triggerId,
      domainId,
      response,
      respondedAt: nowIso(),
      latencyMs,
    };
    this.feedback.push(feedback);
    return feedback;
  }

  /**
   * Records that a suggestion was adopted (user took the suggested action).
   */
  public recordAdopted(suggestionId: string, triggerId: string, domainId: string, latencyMs?: number): SuggestionFeedback {
    return this.recordFeedback(suggestionId, triggerId, domainId, "adopted", latencyMs);
  }

  /**
   * Records that a suggestion was explicitly dismissed by the user.
   */
  public recordDismissed(suggestionId: string, triggerId: string, domainId: string, latencyMs?: number): SuggestionFeedback {
    return this.recordFeedback(suggestionId, triggerId, domainId, "dismissed", latencyMs);
  }

  /**
   * Records that a suggestion was ignored (timed out or no response).
   */
  public recordIgnored(suggestionId: string, triggerId: string, domainId: string, latencyMs?: number): SuggestionFeedback {
    return this.recordFeedback(suggestionId, triggerId, domainId, "ignored", latencyMs);
  }

  /**
   * Gets preference statistics for a specific trigger.
   */
  public getTriggerStats(triggerId: string): TriggerPreferenceStats | null {
    const cutoff = this.getCutoffDate();
    const relevant = this.feedback.filter(
      (f) => f.triggerId === triggerId && new Date(f.respondedAt) >= cutoff,
    );

    if (relevant.length === 0) {
      return null;
    }

    return this.computeStats(relevant, triggerId);
  }

  /**
   * Gets preference statistics for a specific domain.
   */
  public getDomainStats(domainId: string): DomainPreferenceStats | null {
    const cutoff = this.getCutoffDate();
    const relevant = this.feedback.filter(
      (f) => f.domainId === domainId && new Date(f.respondedAt) >= cutoff,
    );

    if (relevant.length === 0) {
      return null;
    }

    return this.computeDomainStats(relevant, domainId);
  }

  /**
   * Gets frequency multiplier recommendation for a trigger.
   *
   * Returns a multiplier (0.1 to 2.0) based on adoption rate:
   * - Low adoption (< 0.3) → reduce frequency
   * - High adoption (> 0.7) → increase frequency
   * - Medium adoption → no change
   */
  public getFrequencyMultiplier(triggerId: string): number {
    const stats = this.getTriggerStats(triggerId);

    if (stats === null || stats.totalSuggestions < this.config.minSamplesForAdjustment) {
      return 1.0; // No adjustment without enough data
    }

    if (stats.adoptionRate < this.config.lowAdoptionThreshold) {
      // Linear reduction from 1.0 to minFrequencyMultiplier
      const reduction = (this.config.lowAdoptionThreshold - stats.adoptionRate) / this.config.lowAdoptionThreshold;
      return Math.max(this.config.minFrequencyMultiplier, 1.0 - reduction * 0.9);
    }

    if (stats.adoptionRate > this.config.highAdoptionThreshold) {
      // Linear increase from 1.0 to maxFrequencyMultiplier
      const increase = (stats.adoptionRate - this.config.highAdoptionThreshold) / (1 - this.config.highAdoptionThreshold);
      return Math.min(this.config.maxFrequencyMultiplier, 1.0 + increase);
    }

    return 1.0; // No change for medium adoption
  }

  /**
   * Gets all triggers sorted by adoption rate (ascending).
   * Useful for identifying which triggers need frequency reduction.
   */
  public getTriggersByAdoption(ascending = true): Array<{ triggerId: string; adoptionRate: number }> {
    const triggerIds = [...new Set(this.feedback.map((f) => f.triggerId))];
    const results: Array<{ triggerId: string; adoptionRate: number }> = [];

    for (const triggerId of triggerIds) {
      const stats = this.getTriggerStats(triggerId);
      if (stats !== null) {
        results.push({ triggerId, adoptionRate: stats.adoptionRate });
      }
    }

    return results.sort((a, b) => ascending ? a.adoptionRate - b.adoptionRate : b.adoptionRate - a.adoptionRate);
  }

  /**
   * Gets all domains sorted by adoption rate.
   */
  public getDomainsByAdoption(ascending = true): Array<{ domainId: string; adoptionRate: number }> {
    const domainIds = [...new Set(this.feedback.map((f) => f.domainId))];
    const results: Array<{ domainId: string; adoptionRate: number }> = [];

    for (const domainId of domainIds) {
      const stats = this.getDomainStats(domainId);
      if (stats !== null) {
        results.push({ domainId, adoptionRate: stats.adoptionRate });
      }
    }

    return results.sort((a, b) => ascending ? a.adoptionRate - b.adoptionRate : b.adoptionRate - a.adoptionRate);
  }

  /**
   * Clears old feedback data beyond the analysis window.
   */
  public cleanup(): number {
    const cutoff = this.getCutoffDate();
    const before = this.feedback.length;
    this.feedback.splice(0, this.feedback.length, ...this.feedback.filter((f) => new Date(f.respondedAt) >= cutoff));
    return before - this.feedback.length;
  }

  /**
   * Gets total feedback count.
   */
  public getTotalFeedbackCount(): number {
    return this.feedback.length;
  }

  private getCutoffDate(): Date {
    const now = new Date();
    return new Date(now.getTime() - this.config.analysisWindowDays * 24 * 60 * 60 * 1000);
  }

  private computeStats(records: SuggestionFeedback[], triggerId: string): TriggerPreferenceStats {
    const adoptedCount = records.filter((r) => r.response === "adopted").length;
    const dismissedCount = records.filter((r) => r.response === "dismissed").length;
    const ignoredCount = records.filter((r) => r.response === "ignored").length;
    const totalSuggestions = records.length;
    const latencies = records.filter((r) => r.latencyMs != null).map((r) => r.latencyMs!);
    const avgResponseLatencyMs = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : null;

    return {
      triggerId,
      totalSuggestions,
      adoptedCount,
      dismissedCount,
      ignoredCount,
      adoptionRate: totalSuggestions > 0 ? adoptedCount / totalSuggestions : 0,
      dismissalRate: totalSuggestions > 0 ? dismissedCount / totalSuggestions : 0,
      avgResponseLatencyMs,
      lastUpdatedAt: records.length > 0
        ? records.sort((a, b) => b.respondedAt.localeCompare(a.respondedAt))[0]!.respondedAt
        : nowIso(),
    };
  }

  private computeDomainStats(records: SuggestionFeedback[], domainId: string): DomainPreferenceStats {
    const stats = this.computeStats(records, "");
    return {
      domainId,
      totalSuggestions: stats.totalSuggestions,
      adoptedCount: stats.adoptedCount,
      dismissedCount: stats.dismissedCount,
      ignoredCount: stats.ignoredCount,
      adoptionRate: stats.adoptionRate,
      dismissalRate: stats.dismissovalRate,
      avgResponseLatencyMs: stats.avgResponseLatencyMs,
      lastUpdatedAt: stats.lastUpdatedAt,
    };
  }
}
