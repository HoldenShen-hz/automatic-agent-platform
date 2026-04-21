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
const DEFAULT_CONFIG = {
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
    feedback = [];
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Records user feedback for a suggestion.
     */
    recordFeedback(suggestionId, triggerId, domainId, response, latencyMs) {
        const feedback = {
            feedbackId: newId("feedback"),
            suggestionId,
            triggerId,
            domainId,
            response,
            respondedAt: nowIso(),
            ...(latencyMs !== undefined ? { latencyMs } : {}),
        };
        this.feedback.push(feedback);
        return feedback;
    }
    /**
     * Records that a suggestion was adopted (user took the suggested action).
     */
    recordAdopted(suggestionId, triggerId, domainId, latencyMs) {
        return this.recordFeedback(suggestionId, triggerId, domainId, "adopted", latencyMs);
    }
    /**
     * Records that a suggestion was explicitly dismissed by the user.
     */
    recordDismissed(suggestionId, triggerId, domainId, latencyMs) {
        return this.recordFeedback(suggestionId, triggerId, domainId, "dismissed", latencyMs);
    }
    /**
     * Records that a suggestion was ignored (timed out or no response).
     */
    recordIgnored(suggestionId, triggerId, domainId, latencyMs) {
        return this.recordFeedback(suggestionId, triggerId, domainId, "ignored", latencyMs);
    }
    /**
     * Gets preference statistics for a specific trigger.
     */
    getTriggerStats(triggerId) {
        const cutoff = this.getCutoffDate();
        const relevant = this.feedback.filter((f) => f.triggerId === triggerId && new Date(f.respondedAt) >= cutoff);
        if (relevant.length === 0) {
            return null;
        }
        return this.computeStats(relevant, triggerId);
    }
    /**
     * Gets preference statistics for a specific domain.
     */
    getDomainStats(domainId) {
        const cutoff = this.getCutoffDate();
        const relevant = this.feedback.filter((f) => f.domainId === domainId && new Date(f.respondedAt) >= cutoff);
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
    getFrequencyMultiplier(triggerId) {
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
    getTriggersByAdoption(ascending = true) {
        const triggerIds = [...new Set(this.feedback.map((f) => f.triggerId))];
        const results = [];
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
    getDomainsByAdoption(ascending = true) {
        const domainIds = [...new Set(this.feedback.map((f) => f.domainId))];
        const results = [];
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
    cleanup() {
        const cutoff = this.getCutoffDate();
        const before = this.feedback.length;
        this.feedback.splice(0, this.feedback.length, ...this.feedback.filter((f) => new Date(f.respondedAt) >= cutoff));
        return before - this.feedback.length;
    }
    /**
     * Gets total feedback count.
     */
    getTotalFeedbackCount() {
        return this.feedback.length;
    }
    getCutoffDate() {
        const now = new Date();
        return new Date(now.getTime() - this.config.analysisWindowDays * 24 * 60 * 60 * 1000);
    }
    computeStats(records, triggerId) {
        const adoptedCount = records.filter((r) => r.response === "adopted").length;
        const dismissedCount = records.filter((r) => r.response === "dismissed").length;
        const ignoredCount = records.filter((r) => r.response === "ignored").length;
        const totalSuggestions = records.length;
        const latencies = records.filter((r) => r.latencyMs != null).map((r) => r.latencyMs);
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
                ? records.sort((a, b) => b.respondedAt.localeCompare(a.respondedAt))[0].respondedAt
                : nowIso(),
        };
    }
    computeDomainStats(records, domainId) {
        const stats = this.computeStats(records, "");
        return {
            domainId,
            totalSuggestions: stats.totalSuggestions,
            adoptedCount: stats.adoptedCount,
            dismissedCount: stats.dismissedCount,
            ignoredCount: stats.ignoredCount,
            adoptionRate: stats.adoptionRate,
            dismissalRate: stats.dismissalRate,
            avgResponseLatencyMs: stats.avgResponseLatencyMs,
            lastUpdatedAt: stats.lastUpdatedAt,
        };
    }
}
//# sourceMappingURL=user-preference-tracker.js.map