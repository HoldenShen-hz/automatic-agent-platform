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
    latencyMs?: number;
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
    adoptionRate: number;
    dismissalRate: number;
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
/**
 * Tracks user preferences for proactive suggestions.
 *
 * Provides data to:
 * 1. Reduce trigger frequency for low-adoption triggers
 * 2. Increase trigger frequency for high-adoption triggers
 * 3. Identify which domains have the most valuable suggestions
 */
export declare class UserPreferenceTracker {
    private readonly feedback;
    private readonly config;
    constructor(config?: Partial<PreferenceTrackerConfig>);
    /**
     * Records user feedback for a suggestion.
     */
    recordFeedback(suggestionId: string, triggerId: string, domainId: string, response: SuggestionResponse, latencyMs?: number): SuggestionFeedback;
    /**
     * Records that a suggestion was adopted (user took the suggested action).
     */
    recordAdopted(suggestionId: string, triggerId: string, domainId: string, latencyMs?: number): SuggestionFeedback;
    /**
     * Records that a suggestion was explicitly dismissed by the user.
     */
    recordDismissed(suggestionId: string, triggerId: string, domainId: string, latencyMs?: number): SuggestionFeedback;
    /**
     * Records that a suggestion was ignored (timed out or no response).
     */
    recordIgnored(suggestionId: string, triggerId: string, domainId: string, latencyMs?: number): SuggestionFeedback;
    /**
     * Gets preference statistics for a specific trigger.
     */
    getTriggerStats(triggerId: string): TriggerPreferenceStats | null;
    /**
     * Gets preference statistics for a specific domain.
     */
    getDomainStats(domainId: string): DomainPreferenceStats | null;
    /**
     * Gets frequency multiplier recommendation for a trigger.
     *
     * Returns a multiplier (0.1 to 2.0) based on adoption rate:
     * - Low adoption (< 0.3) → reduce frequency
     * - High adoption (> 0.7) → increase frequency
     * - Medium adoption → no change
     */
    getFrequencyMultiplier(triggerId: string): number;
    /**
     * Gets all triggers sorted by adoption rate (ascending).
     * Useful for identifying which triggers need frequency reduction.
     */
    getTriggersByAdoption(ascending?: boolean): Array<{
        triggerId: string;
        adoptionRate: number;
    }>;
    /**
     * Gets all domains sorted by adoption rate.
     */
    getDomainsByAdoption(ascending?: boolean): Array<{
        domainId: string;
        adoptionRate: number;
    }>;
    /**
     * Clears old feedback data beyond the analysis window.
     */
    cleanup(): number;
    /**
     * Gets total feedback count.
     */
    getTotalFeedbackCount(): number;
    private getCutoffDate;
    private computeStats;
    private computeDomainStats;
}
