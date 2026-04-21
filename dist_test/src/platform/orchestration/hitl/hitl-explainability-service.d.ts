/**
 * HITL Explainability Service
 *
 * Provides:
 * - Decision explanation generation for human takeovers
 * - Satisfaction tracking for operator interventions
 * - Feedback loop closure for continuous improvement
 * - Action reason attribution and traceability
 */
import type { TakeoverSessionRecord } from "../../contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
export type DecisionType = "task_escalation" | "approval_required" | "anomaly_detected" | "confidence_low" | "timeout_waiting" | "error_recovery" | "resource_contention" | "policy_violation" | "manual_override";
export type SatisfactionRating = 1 | 2 | 3 | 4 | 5;
export interface DecisionExplanation {
    explanationId: string;
    taskId: string;
    executionId: string | null;
    takeoverSessionId: string | null;
    decisionType: DecisionType;
    summary: string;
    factors: DecisionFactor[];
    recommendations: string[];
    confidenceScore: number;
    generatedAt: string;
    contextSnapshot: Record<string, unknown>;
}
export interface DecisionFactor {
    name: string;
    weight: number;
    value: string | number | boolean;
    reason: string;
}
export interface SatisfactionFeedback {
    feedbackId: string;
    takeoverSessionId: string | null;
    taskId: string | null;
    operatorId: string;
    rating: SatisfactionRating;
    feedbackType: "satisfaction" | "frustration" | "suggestion" | "escalation";
    comment: string | null;
    categories: FeedbackCategory[];
    submittedAt: string;
    followUpRequested: boolean;
}
export type FeedbackCategory = "decision_quality" | "response_time" | "clarity" | "automation_level" | "tooling" | "documentation" | "other";
export interface OperatorMetrics {
    operatorId: string;
    totalInterventions: number;
    averageRating: number | null;
    recentRatings: SatisfactionRating[];
    commonFrustrations: FeedbackCategory[];
    suggestedImprovements: string[];
    lastInterventionAt: string | null;
}
export interface ExplainabilityConfig {
    enableDecisionExplanations: boolean;
    enableSatisfactionTracking: boolean;
    enableFeedbackLoop: boolean;
    minConfidenceForAutoExplain: number;
    feedbackReminderAfterMs: number;
}
export declare class HITLExplainabilityService {
    private readonly store;
    private readonly config;
    private readonly feedbackRecords;
    private readonly explanations;
    constructor(store: AuthoritativeTaskStore, config?: Partial<ExplainabilityConfig>);
    generateExplanation(taskId: string, decisionType: DecisionType, factors: DecisionFactor[], context?: {
        executionId?: string | null;
        takeoverSessionId?: string | null;
        contextSnapshot?: Record<string, unknown>;
    }): DecisionExplanation;
    explainTaskEscalation(taskId: string, reason: {
        complexity?: number;
        duration?: number;
        expectedDuration?: number;
        errorRate?: number;
    }, context?: {
        executionId?: string | null;
        takeoverSessionId?: string | null;
    }): DecisionExplanation;
    explainApprovalRequired(taskId: string, reason: {
        riskLevel?: string;
        policy?: string;
        classification?: string;
    }, context?: {
        executionId?: string | null;
        takeoverSessionId?: string | null;
        contextSnapshot?: Record<string, unknown>;
    }): DecisionExplanation;
    private interpolateTemplate;
    getExplanation(explanationId: string): DecisionExplanation | null;
    getExplanationsForTask(taskId: string): DecisionExplanation[];
    getRecentExplanations(limit?: number): DecisionExplanation[];
    recordFeedback(rating: SatisfactionRating, feedbackType: SatisfactionFeedback["feedbackType"], operatorId: string, options?: {
        takeoverSessionId?: string | null;
        taskId?: string | null;
        comment?: string | null;
        categories?: FeedbackCategory[];
        followUpRequested?: boolean;
    }): SatisfactionFeedback;
    getFeedbackForSession(takeoverSessionId: string): SatisfactionFeedback[];
    getFeedbackForTask(taskId: string): SatisfactionFeedback[];
    getOperatorMetrics(operatorId: string): OperatorMetrics;
    getOverallSatisfactionMetrics(): {
        totalFeedback: number;
        averageRating: number | null;
        ratingDistribution: Record<SatisfactionRating, number>;
        feedbackTypeDistribution: Record<SatisfactionFeedback["feedbackType"], number>;
        commonCategories: {
            category: FeedbackCategory;
            count: number;
        }[];
    };
    isFeedbackDue(takeoverSession: TakeoverSessionRecord): boolean;
    getSessionFeedbackDue(session: TakeoverSessionRecord): boolean;
    getConfig(): ExplainabilityConfig;
    isEnabled(): boolean;
}
