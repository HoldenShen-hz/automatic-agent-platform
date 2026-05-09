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
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

// ── Types ──────────────────────────────────────────────────────────────

export type DecisionType =
  | "task_escalation"
  | "approval_required"
  | "anomaly_detected"
  | "confidence_low"
  | "timeout_waiting"
  | "error_recovery"
  | "resource_contention"
  | "policy_violation"
  | "manual_override";

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
  matched_rule_or_policy: string | null;
  reason_source: string | null;
  remediation_hint: string | null;
  routingExplanation?: RoutingExplanation;
  riskExplanation?: RiskExplanation;
  fallbackExplanation?: FallbackExplanation;
  takeoverJustification?: TakeoverJustification;
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

export type FeedbackCategory =
  | "decision_quality"
  | "response_time"
  | "clarity"
  | "automation_level"
  | "tooling"
  | "documentation"
  | "other";

export interface OperatorMetrics {
  operatorId: string;
  totalInterventions: number;
  averageRating: number | null;
  recentRatings: SatisfactionRating[];
  commonFrustrations: FeedbackCategory[];
  suggestedImprovements: string[];
  lastInterventionAt: string | null;
}

export interface RoutingExplanation {
  routeId: string;
  selectedPath: string;
  candidatePaths: string[];
  rationale: string;
}

export interface RiskExplanation {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskDrivers: string[];
  mitigationStatus: "covered" | "partial" | "missing";
}

export interface FallbackExplanation {
  fallbackMode: "retry" | "degrade" | "handoff" | "abort";
  trigger: string;
  expectedImpact: string;
}

export interface TakeoverJustification {
  takeoverType: "manual_override" | "approval_gate" | "incident_response";
  operatorId: string | null;
  justification: string;
}

export interface ExplainabilityConfig {
  enableDecisionExplanations: boolean;
  enableSatisfactionTracking: boolean;
  enableFeedbackLoop: boolean;
  minConfidenceForAutoExplain: number;
  feedbackReminderAfterMs: number;
}

// ── Default Decision Templates ─────────────────────────────────────────

interface DecisionTemplate {
  type: DecisionType;
  summaryTemplate: string;
  factorTemplates: { name: string; reasonTemplate: string }[];
  recommendationTemplates: string[];
}

const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    type: "task_escalation",
    summaryTemplate: "Task {taskId} was escalated due to {escalationReason}",
    factorTemplates: [
      { name: "complexity", reasonTemplate: "Task complexity score {complexity} exceeded threshold" },
      { name: "duration", reasonTemplate: "Task duration {duration}s exceeded expected {expected}s" },
      { name: "error_rate", reasonTemplate: "Error rate {errorRate}% exceeded acceptable threshold" },
    ],
    recommendationTemplates: [
      "Consider reviewing task complexity before assignment",
      "Implement earlier intervention points for long-running tasks",
      "Evaluate if current resource allocation is adequate",
    ],
  },
  {
    type: "approval_required",
    summaryTemplate: "Task {taskId} requires human approval before proceeding",
    factorTemplates: [
      { name: "risk_level", reasonTemplate: "Risk level {risk} requires manual approval" },
      { name: "policy", reasonTemplate: "Policy {policy} mandates approval for this operation" },
      { name: "sensitive_data", reasonTemplate: "Operation involves sensitive data classification {classification}" },
    ],
    recommendationTemplates: [
      "Review approval policies for potential optimization",
      "Consider pre-approval for low-risk operations",
      "Implement batch approval workflows for efficiency",
    ],
  },
  {
    type: "anomaly_detected",
    summaryTemplate: "Anomalous behavior detected in task {taskId}",
    factorTemplates: [
      { name: "metric", reasonTemplate: "Metric {metric} showed unexpected value {value}" },
      { name: "baseline", reasonTemplate: "Deviation from baseline: {deviation}% (threshold: {threshold}%)" },
      { name: "pattern", reasonTemplate: "Pattern match: {pattern} detected" },
    ],
    recommendationTemplates: [
      "Investigate root cause of anomaly",
      "Consider adding monitoring for this pattern",
      "Review if thresholds need adjustment",
    ],
  },
  {
    type: "confidence_low",
    summaryTemplate: "System confidence below threshold for task {taskId}",
    factorTemplates: [
      { name: "model_confidence", reasonTemplate: "AI model confidence {confidence} below threshold {threshold}" },
      { name: "training_data", reasonTemplate: "Limited training data for this scenario type" },
      { name: "edge_case", reasonTemplate: "Input falls outside typical distribution" },
    ],
    recommendationTemplates: [
      "Consider providing more context to improve confidence",
      "Review if training data covers this scenario",
      "Human validation recommended for edge cases",
    ],
  },
  {
    type: "timeout_waiting",
    summaryTemplate: "Task {taskId} timed out waiting for {resource}",
    factorTemplates: [
      { name: "wait_duration", reasonTemplate: "Waited {duration}s for {resource}" },
      { name: "timeout_threshold", reasonTemplate: "Timeout threshold set to {threshold}s" },
      { name: "retry_count", reasonTemplate: "Retried {count} times before escalation" },
    ],
    recommendationTemplates: [
      "Review resource availability and allocation",
      "Consider adjusting timeout thresholds",
      "Implement circuit breakers for dependent services",
    ],
  },
  {
    type: "error_recovery",
    summaryTemplate: "Automatic error recovery failed for task {taskId}",
    factorTemplates: [
      { name: "error_type", reasonTemplate: "Error type {errorType} not recoverable automatically" },
      { name: "recovery_attempts", reasonTemplate: "Attempted {attempts} recovery strategies" },
      { name: "impact", reasonTemplate: "Error impact: {impact}" },
    ],
    recommendationTemplates: [
      "Review error handling procedures",
      "Consider adding recovery strategies for this error type",
      "Document workaround procedures",
    ],
  },
  {
    type: "resource_contention",
    summaryTemplate: "Resource contention detected affecting task {taskId}",
    factorTemplates: [
      { name: "cpu_usage", reasonTemplate: "CPU usage at {cpu}% across cluster" },
      { name: "memory_pressure", reasonTemplate: "Memory pressure: {memory}% utilized" },
      { name: "queue_depth", reasonTemplate: "Task queue depth: {depth}" },
    ],
    recommendationTemplates: [
      "Consider scaling resources",
      "Review task scheduling priorities",
      "Implement load shedding if necessary",
    ],
  },
  {
    type: "policy_violation",
    summaryTemplate: "Policy violation detected in task {taskId}",
    factorTemplates: [
      { name: "policy_name", reasonTemplate: "Policy '{policy}' was violated" },
      { name: "violation_details", reasonTemplate: "Details: {details}" },
      { name: "severity", reasonTemplate: "Violation severity: {severity}" },
    ],
    recommendationTemplates: [
      "Review and update policy configuration",
      "Consider if policy is too restrictive or permissive",
      "Implement policy exception handling if needed",
    ],
  },
  {
    type: "manual_override",
    summaryTemplate: "Manual override invoked for task {taskId}",
    factorTemplates: [
      { name: "operator", reasonTemplate: "Operator {operatorId} initiated override" },
      { name: "action", reasonTemplate: "Action taken: {action}" },
      { name: "reason", reasonTemplate: "Stated reason: {reason}" },
    ],
    recommendationTemplates: [
      "Document manual override procedures",
      "Consider if this scenario should be automated",
      "Review operator training needs",
    ],
  },
];

// ── Service ────────────────────────────────────────────────────────────

export class HITLExplainabilityService {
  private readonly config: ExplainabilityConfig;
  private readonly feedbackRecords: SatisfactionFeedback[] = [];
  private readonly explanations: DecisionExplanation[] = [];

  constructor(
    private readonly store: AuthoritativeTaskStore,
    config?: Partial<ExplainabilityConfig>,
  ) {
    this.config = {
      enableDecisionExplanations: config?.enableDecisionExplanations ?? true,
      enableSatisfactionTracking: config?.enableSatisfactionTracking ?? true,
      enableFeedbackLoop: config?.enableFeedbackLoop ?? true,
      minConfidenceForAutoExplain: config?.minConfidenceForAutoExplain ?? 0.6,
      feedbackReminderAfterMs: config?.feedbackReminderAfterMs ?? 5 * 60 * 1000,
    };
  }

  generateExplanation(
    taskId: string,
    decisionType: DecisionType,
    factors: DecisionFactor[],
    context?: {
      executionId?: string | null;
      takeoverSessionId?: string | null;
      contextSnapshot?: Record<string, unknown>;
      matchedRuleOrPolicy?: string | null;
      reasonSource?: string | null;
      remediationHint?: string | null;
      routingExplanation?: RoutingExplanation;
      riskExplanation?: RiskExplanation;
      fallbackExplanation?: FallbackExplanation;
      takeoverJustification?: TakeoverJustification;
    },
  ): DecisionExplanation {
    const explanationId = newId("explain");
    const template = DECISION_TEMPLATES.find((t) => t.type === decisionType) ?? DECISION_TEMPLATES[0]!;

    const factorWeights = factors.reduce((sum, f) => sum + Math.abs(f.weight), 0);
    const confidenceScore = factorWeights > 0
      ? factors.reduce((sum, f) => sum + (f.weight / factorWeights) * (typeof f.value === "number" ? f.value : 1), 0) / factors.length
      : 0.5;

    const explanation: DecisionExplanation = {
      explanationId,
      taskId,
      executionId: context?.executionId ?? null,
      takeoverSessionId: context?.takeoverSessionId ?? null,
      decisionType,
      summary: this.interpolateTemplate(template.summaryTemplate, factors),
      factors,
      recommendations: template.recommendationTemplates,
      confidenceScore: Math.max(0, Math.min(1, confidenceScore)),
      generatedAt: nowIso(),
      contextSnapshot: context?.contextSnapshot ?? {},
      matched_rule_or_policy: context?.matchedRuleOrPolicy ?? this.resolveMatchedRuleOrPolicy(decisionType, factors),
      reason_source: context?.reasonSource ?? this.resolveReasonSource(decisionType),
      remediation_hint: context?.remediationHint ?? template.recommendationTemplates[0] ?? null,
      ...(context?.routingExplanation != null ? { routingExplanation: context.routingExplanation } : {}),
      ...(context?.riskExplanation != null ? { riskExplanation: context.riskExplanation } : {}),
      ...(context?.fallbackExplanation != null ? { fallbackExplanation: context.fallbackExplanation } : {}),
      ...(context?.takeoverJustification != null ? { takeoverJustification: context.takeoverJustification } : {}),
    };

    if (this.config.enableDecisionExplanations) {
      this.explanations.push(explanation);
      if (this.explanations.length > 1000) {
        this.explanations.splice(0, this.explanations.length - 1000);
      }
    }

    return explanation;
  }

  explainTaskEscalation(
    taskId: string,
    reason: {
      complexity?: number;
      duration?: number;
      expectedDuration?: number;
      errorRate?: number;
    },
    context?: {
      executionId?: string | null;
      takeoverSessionId?: string | null;
    },
  ): DecisionExplanation {
    const factors: DecisionFactor[] = [];

    if (reason.complexity !== undefined) {
      factors.push({
        name: "complexity",
        weight: 0.4,
        value: reason.complexity,
        reason: `Task complexity score ${reason.complexity} exceeded acceptable threshold`,
      });
    }

    if (reason.duration !== undefined && reason.expectedDuration !== undefined) {
      factors.push({
        name: "duration",
        weight: 0.3,
        value: reason.duration,
        reason: `Task duration ${reason.duration}s exceeded expected ${reason.expectedDuration}s`,
      });
    }

    if (reason.errorRate !== undefined) {
      factors.push({
        name: "error_rate",
        weight: 0.3,
        value: reason.errorRate,
        reason: `Error rate ${reason.errorRate}% exceeded acceptable threshold`,
      });
    }

    return this.generateExplanation(taskId, "task_escalation", factors, context);
  }

  explainApprovalRequired(
    taskId: string,
    reason: {
      riskLevel?: string;
      policy?: string;
      classification?: string;
    },
    context?: {
      executionId?: string | null;
      takeoverSessionId?: string | null;
      contextSnapshot?: Record<string, unknown>;
    },
  ): DecisionExplanation {
    const factors: DecisionFactor[] = [];

    if (reason.riskLevel) {
      factors.push({
        name: "risk_level",
        weight: 0.5,
        value: reason.riskLevel,
        reason: `Risk level ${reason.riskLevel} requires manual approval`,
      });
    }

    if (reason.policy) {
      factors.push({
        name: "policy",
        weight: 0.3,
        value: reason.policy,
        reason: `Policy '${reason.policy}' mandates approval for this operation`,
      });
    }

    if (reason.classification) {
      factors.push({
        name: "sensitive_data",
        weight: 0.2,
        value: reason.classification,
        reason: `Operation involves sensitive data classification ${reason.classification}`,
      });
    }

    return this.generateExplanation(taskId, "approval_required", factors, context);
  }

  private interpolateTemplate(template: string, factors: DecisionFactor[]): string {
    let result = template;
    for (const factor of factors) {
      result = result.replace(`{${factor.name}}`, String(factor.value));
    }
    return result;
  }

  private resolveMatchedRuleOrPolicy(decisionType: DecisionType, factors: DecisionFactor[]): string | null {
    const policyFactor = factors.find((factor) => factor.name === "policy" || factor.name === "policy_name");
    if (policyFactor != null) {
      return String(policyFactor.value);
    }
    switch (decisionType) {
      case "approval_required":
        return "manual_approval_policy";
      case "policy_violation":
        return "policy_violation_guardrail";
      case "manual_override":
        return "human_takeover_override_policy";
      default:
        return null;
    }
  }

  private resolveReasonSource(decisionType: DecisionType): string {
    switch (decisionType) {
      case "manual_override":
        return "human_operator";
      case "approval_required":
      case "policy_violation":
        return "policy_engine";
      default:
        return "runtime_signal";
    }
  }

  getExplanation(explanationId: string): DecisionExplanation | null {
    return this.explanations.find((e) => e.explanationId === explanationId) ?? null;
  }

  getExplanationsForTask(taskId: string): DecisionExplanation[] {
    return this.explanations.filter((e) => e.taskId === taskId);
  }

  getRecentExplanations(limit = 50): DecisionExplanation[] {
    return this.explanations.slice(-limit);
  }

  recordFeedback(
    rating: SatisfactionRating,
    feedbackType: SatisfactionFeedback["feedbackType"],
    operatorId: string,
    options?: {
      takeoverSessionId?: string | null;
      taskId?: string | null;
      comment?: string | null;
      categories?: FeedbackCategory[];
      followUpRequested?: boolean;
    },
  ): SatisfactionFeedback {
    const feedback: SatisfactionFeedback = {
      feedbackId: newId("fb"),
      takeoverSessionId: options?.takeoverSessionId ?? null,
      taskId: options?.taskId ?? null,
      operatorId,
      rating,
      feedbackType,
      comment: options?.comment ?? null,
      categories: options?.categories ?? [],
      submittedAt: nowIso(),
      followUpRequested: options?.followUpRequested ?? false,
    };

    if (this.config.enableSatisfactionTracking) {
      this.feedbackRecords.push(feedback);
      if (this.feedbackRecords.length > 1000) {
        this.feedbackRecords.splice(0, this.feedbackRecords.length - 1000);
      }
    }

    return feedback;
  }

  getFeedbackForSession(takeoverSessionId: string): SatisfactionFeedback[] {
    return this.feedbackRecords.filter((f) => f.takeoverSessionId === takeoverSessionId);
  }

  getFeedbackForTask(taskId: string): SatisfactionFeedback[] {
    return this.feedbackRecords.filter((f) => f.taskId === taskId);
  }

  getOperatorMetrics(operatorId: string): OperatorMetrics {
    const operatorFeedback = this.feedbackRecords.filter((f) => f.operatorId === operatorId);

    if (operatorFeedback.length === 0) {
      return {
        operatorId,
        totalInterventions: 0,
        averageRating: null,
        recentRatings: [],
        commonFrustrations: [],
        suggestedImprovements: [],
        lastInterventionAt: null,
      };
    }

    const ratings = operatorFeedback.map((f) => f.rating);
    const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

    const frustrationCategories = operatorFeedback
      .filter((f) => f.feedbackType === "frustration")
      .flatMap((f) => f.categories);

    const frustrationCount = new Map<FeedbackCategory, number>();
    for (const cat of frustrationCategories) {
      frustrationCount.set(cat, (frustrationCount.get(cat) ?? 0) + 1);
    }

    const commonFrustrations = Array.from(frustrationCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const suggestions = operatorFeedback
      .filter((f) => f.feedbackType === "suggestion" && f.comment)
      .map((f) => f.comment as string)
      .slice(0, 5);

    const sortedByTime = [...operatorFeedback].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );

    return {
      operatorId,
      totalInterventions: operatorFeedback.length,
      averageRating: Math.round(averageRating * 100) / 100,
      recentRatings: sortedByTime.slice(0, 10).map((f) => f.rating),
      commonFrustrations,
      suggestedImprovements: suggestions,
      lastInterventionAt: sortedByTime[0]?.submittedAt ?? null,
    };
  }

  getOverallSatisfactionMetrics(): {
    totalFeedback: number;
    averageRating: number | null;
    ratingDistribution: Record<SatisfactionRating, number>;
    feedbackTypeDistribution: Record<SatisfactionFeedback["feedbackType"], number>;
    commonCategories: { category: FeedbackCategory; count: number }[];
  } {
    if (this.feedbackRecords.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: null,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        feedbackTypeDistribution: { satisfaction: 0, frustration: 0, suggestion: 0, escalation: 0 },
        commonCategories: [],
      };
    }

    const ratings = this.feedbackRecords.map((f) => f.rating);
    const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

    const ratingDistribution: Record<SatisfactionRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) {
      ratingDistribution[r]++;
    }

    const feedbackTypeDistribution: Record<SatisfactionFeedback["feedbackType"], number> = {
      satisfaction: 0,
      frustration: 0,
      suggestion: 0,
      escalation: 0,
    };
    for (const f of this.feedbackRecords) {
      feedbackTypeDistribution[f.feedbackType]++;
    }

    const categoryCount = new Map<FeedbackCategory, number>();
    for (const f of this.feedbackRecords) {
      for (const cat of f.categories) {
        categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
      }
    }

    const commonCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      totalFeedback: this.feedbackRecords.length,
      averageRating: Math.round(averageRating * 100) / 100,
      ratingDistribution,
      feedbackTypeDistribution,
      commonCategories,
    };
  }

  isFeedbackDue(takeoverSession: TakeoverSessionRecord): boolean {
    if (!this.config.enableFeedbackLoop) return false;

    const closedAt = takeoverSession.closedAt;
    if (!closedAt) return false;

    const closedMs = new Date(closedAt).getTime();
    const nowMs = Date.now();
    const elapsedMs = nowMs - closedMs;

    if (elapsedMs < this.config.feedbackReminderAfterMs) return false;

    const existingFeedback = this.feedbackRecords.filter(
      (f) => f.takeoverSessionId === takeoverSession.id,
    );
    if (existingFeedback.length > 0) return false;

    return true;
  }

  getSessionFeedbackDue(session: TakeoverSessionRecord): boolean {
    return this.isFeedbackDue(session);
  }

  getConfig(): ExplainabilityConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enableDecisionExplanations || this.config.enableSatisfactionTracking;
  }
}
