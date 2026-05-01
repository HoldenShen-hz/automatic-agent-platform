import { detectSlaBreach, type SlaCommitment, type SlaObservation } from "./breach-detector/index.js";
import { allocateReservedCapacity, type ReservedCapacityAllocation } from "./resource-allocator/index.js";
import { resolveHighestPriorityTier, type SlaTier } from "./tier-resolver/index.js";

// §54.3: Domain-specific SLA alert threshold overrides
// Global defaults can be overridden per domain for latency/success rate thresholds
export interface DomainSlaThresholds {
  readonly domainId: string;
  readonly latencyThresholdMs?: number;
  readonly successRateThreshold?: number;
  readonly maxQueueWaitMs?: number;
}

export type WorkflowClass = "deterministic" | "llm_assisted" | "hitl_waiting";

export interface SlaTierProfile extends SlaTier {
  readonly targetLatencyMs: number;
  readonly targetSuccessRate: number;
  readonly maxQueueWaitMs: number;
  readonly preemptionPriority: number;
}

export interface SlaRoutingHint {
  readonly tierId: string;
  readonly preemptionPriority: number;
  readonly reservedCapacityUnits: number;
  readonly maxQueueWaitMs: number;
}

export interface SlaBreachRecord {
  readonly tierId: string;
  readonly breachCodes: readonly string[];
  readonly observedAt: string;
  readonly severity: "warning" | "critical";
}

export interface SlaOperationsRequest {
  readonly tiers: readonly SlaTierProfile[];
  readonly selectedTierId?: string | null;
  readonly workflowClass: WorkflowClass;
  readonly observation: SlaObservation;
  readonly reservedCapacityPlan?: readonly ReservedCapacityAllocation[];
  readonly totalCapacityUnits: number;
  readonly observedAt: string;
  // §54.3: Domain-specific threshold overrides
  readonly domainThresholds?: DomainSlaThresholds | null;
  // §54.3/R15-72: Historical observations for trend prediction
  readonly historicalObservations?: readonly SlaObservation[] | null;
  // §54.3/R15-72: Current queue depth for scaling decisions
  readonly queueDepth?: number | null;
}

export interface SlaOperationsDecision {
  readonly selectedTierId: string | null;
  readonly routingHint: SlaRoutingHint | null;
  readonly reservedCapacity: Readonly<Record<string, number>>;
  readonly breachRecords: readonly SlaBreachRecord[];
  readonly escalationActions: readonly SlaEscalationAction[];
  readonly penaltyDecisions: readonly SlaPenaltyDecision[];
  readonly starvationProtected: boolean;
  readonly preemptionCapApplied: boolean;
  readonly workflowClass: WorkflowClass;
  // §54.3/R15-72: Delay prediction
  readonly delayPrediction: DelayPrediction | null;
  // §54.3/R15-72: Auto-scaling recommendation
  readonly scalingRecommendation: ScalingRecommendation | null;
  // §54.3/R15-72: Preemption decisions
  readonly preemptionDecisions: readonly PreemptionDecision[];
}

export interface SlaEscalationAction {
  readonly tierId: string;
  readonly action: "notify_owner" | "page_sre" | "freeze_rollout";
  readonly reason: string;
}

export interface SlaPenaltyDecision {
  readonly tierId: string;
  readonly penaltyType: "credit" | "capacity_boost" | "contract_review";
  readonly severity: "warning" | "critical";
}

/**
 * §54.3/R15-72: Delay prediction based on trend analysis.
 */
export interface DelayPrediction {
  /** Predicted queue wait time in milliseconds */
  readonly predictedQueueWaitMs: number;
  /** Predicted total latency in milliseconds */
  readonly predictedLatencyMs: number;
  /** Confidence level of prediction (0-1) */
  readonly confidence: number;
  /** Trend direction: improving, stable, degrading */
  readonly trend: "improving" | "stable" | "degrading";
  /** Time window of prediction in milliseconds */
  readonly predictionWindowMs: number;
  /** Reason for prediction */
  readonly reason: string;
}

/**
 * §54.3/R15-72: Auto-scaling recommendation.
 */
export interface ScalingRecommendation {
  /** Recommended action */
  readonly action: "scale_up" | "scale_down" | "maintain" | "emergency_scale";
  /** Recommended capacity change percentage */
  readonly capacityChangePercent: number;
  /** Recommended additional units */
  readonly additionalUnits: number;
  /** Urgency of scaling action */
  readonly urgency: "low" | "medium" | "high" | "critical";
  /** Reason for recommendation */
  readonly reason: string;
  /** Whether to preempt lower priority work */
  readonly preemptEnabled: boolean;
}

/**
 * §54.3/R15-72: Preemption decision for a workflow.
 */
export interface PreemptionDecision {
  /** Tier ID affected */
  readonly tierId: string;
  /** Whether to preempt */
  readonly shouldPreempt: boolean;
  /** Priority threshold for preemption */
  readonly priorityThreshold: number;
  /** Reason for preemption decision */
  readonly reason: string;
}

const WORKFLOW_CLASS_LATENCY_MULTIPLIER: Record<WorkflowClass, number> = {
  deterministic: 0.5,
  llm_assisted: 1.5,
  hitl_waiting: 2.0,
};

// §54.3/R15-72: Thresholds for scaling decisions
const SCALING_THRESHOLDS = {
  // Queue wait time above this triggers scale-up (ms)
  scaleUpQueueWaitMs: 5000,
  // Capacity utilization above this triggers scale-up (0-1)
  scaleUpUtilizationThreshold: 0.8,
  // Capacity utilization below this triggers scale-down (0-1)
  scaleDownUtilizationThreshold: 0.3,
  // Prediction confidence minimum for scaling actions
  minPredictionConfidence: 0.6,
  // Prediction window for trend analysis (ms)
  predictionWindowMs: 60000,
};

/**
 * §54.3/R15-72: Predicts delay based on historical observations and trend analysis.
 */
function predictDelay(
  currentObservation: SlaObservation,
  historicalObservations: readonly SlaObservation[] | null | undefined,
  workflowClass: WorkflowClass,
): DelayPrediction {
  const latencyMultiplier = WORKFLOW_CLASS_LATENCY_MULTIPLIER[workflowClass];
  const now = Date.now();

  // Build history array for trend analysis
  const allObservations = historicalObservations
    ? [...historicalObservations, currentObservation]
    : [currentObservation];

  // Calculate trend using simple linear regression on recent observations
  const recentObservations = allObservations.slice(-10);
  const trend = calculateTrend(recentObservations, (o) => o.queueWaitMs);

  // Predict future queue wait
  const basePrediction = currentObservation.queueWaitMs * latencyMultiplier;
  const trendFactor = trend.slope > 0 ? 1 + (trend.slope * 0.1) : 1 + (trend.slope * 0.05);
  const predictedQueueWaitMs = Math.max(0, Math.round(basePrediction * trendFactor));

  // Predict future latency
  const predictedLatencyMs = Math.max(0, Math.round(currentObservation.latencyMs * latencyMultiplier * trendFactor));

  // Determine trend direction
  let trendDirection: "improving" | "stable" | "degrading";
  if (trend.slope < -0.1) {
    trendDirection = "improving";
  } else if (trend.slope > 0.1) {
    trendDirection = "degrading";
  } else {
    trendDirection = "stable";
  }

  return {
    predictedQueueWaitMs,
    predictedLatencyMs,
    confidence: trend.confidence,
    trend: trendDirection,
    predictionWindowMs: SCALING_THRESHOLDS.predictionWindowMs,
    reason: `Based on ${recentObservations.length} observations, ${trendDirection} trend detected`,
  };
}

/**
 * §54.3/R15-72: Calculates scaling recommendation based on prediction and queue depth.
 */
function calculateScalingRecommendation(
  prediction: DelayPrediction,
  currentUtilization: number,
  queueDepth: number | null | undefined,
): ScalingRecommendation {
  // High confidence required for scaling decisions
  if (prediction.confidence < SCALING_THRESHOLDS.minPredictionConfidence) {
    return {
      action: "maintain",
      capacityChangePercent: 0,
      additionalUnits: 0,
      urgency: "low",
      reason: "Insufficient prediction confidence for scaling action",
      preemptEnabled: false,
    };
  }

  // Check if queue wait prediction exceeds threshold
  if (prediction.predictedQueueWaitMs > SCALING_THRESHOLDS.scaleUpQueueWaitMs) {
    return {
      action: "scale_up",
      capacityChangePercent: 20,
      additionalUnits: Math.ceil(queueDepth ?? 1 * 0.2),
      urgency: prediction.predictedQueueWaitMs > SCALING_THRESHOLDS.scaleUpQueueWaitMs * 2 ? "critical" : "high",
      reason: `Predicted queue wait ${prediction.predictedQueueWaitMs}ms exceeds threshold ${SCALING_THRESHOLDS.scaleUpQueueWaitMs}ms`,
      preemptEnabled: prediction.trend === "degrading",
    };
  }

  // Check utilization thresholds
  if (currentUtilization > SCALING_THRESHOLDS.scaleUpUtilizationThreshold) {
    return {
      action: "scale_up",
      capacityChangePercent: 15,
      additionalUnits: Math.ceil((queueDepth ?? 1) * 0.15),
      urgency: "medium",
      reason: `Utilization ${(currentUtilization * 100).toFixed(0)}% exceeds threshold ${(SCALING_THRESHOLDS.scaleUpUtilizationThreshold * 100).toFixed(0)}%`,
      preemptEnabled: false,
    };
  }

  if (currentUtilization < SCALING_THRESHOLDS.scaleDownUtilizationThreshold) {
    return {
      action: "scale_down",
      capacityChangePercent: -10,
      additionalUnits: 0,
      urgency: "low",
      reason: `Utilization ${(currentUtilization * 100).toFixed(0)}% below threshold ${(SCALING_THRESHOLDS.scaleDownUtilizationThreshold * 100).toFixed(0)}%`,
      preemptEnabled: false,
    };
  }

  return {
    action: "maintain",
    capacityChangePercent: 0,
    additionalUnits: 0,
    urgency: "low",
    reason: "System within normal parameters",
    preemptEnabled: false,
  };
}

/**
 * §54.3/R15-72: Calculates trend using simple linear regression.
 */
function calculateTrend<T>(
  observations: T[],
  valueExtractor: (o: T) => number,
): { slope: number; intercept: number; confidence: number } {
  if (observations.length < 2) {
    return { slope: 0, intercept: valueExtractor(observations[0] ?? ({} as T)), confidence: 0 };
  }

  const n = observations.length;
  const times = observations.map((_, i) => i);
  const values = observations.map(valueExtractor);

  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = times.reduce((acc, x, i) => acc + x * values[i]!, 0);
  const sumXX = times.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared for confidence
  const meanY = sumY / n;
  const ssTotal = values.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
  const ssResidual = values.reduce((acc, y, i) => {
    const predicted = slope * times[i]! + intercept;
    return acc + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal);

  return {
    slope,
    intercept,
    confidence: Math.max(0, Math.min(1, rSquared)),
  };
}

export class SlaOperationsService {
  public evaluate(request: SlaOperationsRequest): SlaOperationsDecision {
    const selectedTier = request.selectedTierId == null
      ? resolveHighestPriorityTier(request.tiers) as SlaTierProfile | null
      : request.tiers.find((tier) => tier.tierId === request.selectedTierId) as SlaTierProfile | null ?? null;
    const reservedCapacity = allocateReservedCapacity(
      request.totalCapacityUnits,
      request.reservedCapacityPlan ?? request.tiers.map((tier) => ({
        tierId: tier.tierId,
        reservedPercent: tier.reservedCapacityPercent ?? 0,
      })),
    );

    if (selectedTier == null) {
      return {
        selectedTierId: null,
        routingHint: null,
        reservedCapacity,
        breachRecords: [],
        escalationActions: [],
        penaltyDecisions: [],
        starvationProtected: true,
        preemptionCapApplied: false,
        workflowClass: request.workflowClass,
        // §54.3/R15-72: No delay prediction without tier
        delayPrediction: null,
        scalingRecommendation: null,
        preemptionDecisions: [],
      };
    }

    const latencyMultiplier = WORKFLOW_CLASS_LATENCY_MULTIPLIER[request.workflowClass];
    // §54.3: Apply domain-specific threshold overrides if provided
    const domainThresholds = request.domainThresholds;
    const adjustedMaxLatency = ((domainThresholds?.latencyThresholdMs) ?? (selectedTier.targetLatencyMs ?? 1000)) * latencyMultiplier;
    const minSuccessRate = (domainThresholds?.successRateThreshold) ?? (selectedTier.targetSuccessRate ?? 0.99);
    const maxQueueWaitMs = (domainThresholds?.maxQueueWaitMs) ?? (selectedTier.maxQueueWaitMs ?? 3000);
    const commitment: SlaCommitment = {
      maxLatencyMs: adjustedMaxLatency,
      minSuccessRate,
      maxQueueWaitMs,
      // Root cause: Missing SLA timeout and dependency fields from commitment
      // Fix: Include maxExecutionTimeoutRate and minDependencyAvailability from selectedTier
      // exactOptionalPropertyTypes requires explicit undefined handling
      maxExecutionTimeoutRate: selectedTier.maxExecutionTimeoutRate ?? 0.05,
      minDependencyAvailability: selectedTier.minDependencyAvailability ?? 0.99,
    };
    const breachCodes = detectSlaBreach(request.observation, commitment);

    const breachRecords = breachCodes.length === 0
      ? []
      : [{
          tierId: selectedTier.tierId,
          breachCodes,
          observedAt: request.observedAt,
          severity: (breachCodes.includes("sla.success_rate_breach") ? "critical" : "warning") as "warning" | "critical",
        }];
    const escalationActions = breachRecords.map((record) => ({
      tierId: record.tierId,
      action: (record.severity === "critical" ? "page_sre" : "notify_owner") as "notify_owner" | "page_sre",
      reason: record.breachCodes.join(","),
    }));
    const penaltyDecisions = breachRecords.map((record) => ({
      tierId: record.tierId,
      penaltyType: (record.severity === "critical" ? "contract_review" : "credit") as "credit" | "capacity_boost" | "contract_review",
      severity: record.severity,
    }));

    const starvationProtected = request.tiers.some((tier) => (reservedCapacity[tier.tierId] ?? 0) > 0);
    // R16-36 FIX #2123: preemptionCapApplied was always true due to incorrect condition.
    // The original condition `selectedTier.preemptionPriority <= maxPriority` always evaluated
    // to true when selectedTier had the max priority (max priority == max priority).
    // The fix: preemption cap should only apply when there exists a strictly HIGHER priority
    // tier that could preempt this tier. If selectedTier IS the max priority, nothing can
    // preempt it, so preemptionCapApplied should be false.
    const maxPriority = Math.max(...request.tiers.map((tier) => tier.preemptionPriority ?? 0));
    const preemptionCapApplied = selectedTier.preemptionPriority < maxPriority;

    // §54.3/R15-72: Delay prediction based on historical observations
    const delayPrediction = predictDelay(
      request.observation,
      request.historicalObservations,
      request.workflowClass,
    );

    // Calculate current utilization
    const currentUtilization = request.totalCapacityUnits > 0
      ? (request.queueDepth ?? request.observation.queueWaitMs) / request.totalCapacityUnits
      : 0;

    // §54.3/R15-72: Auto-scaling recommendation
    const scalingRecommendation = calculateScalingRecommendation(
      delayPrediction,
      currentUtilization,
      request.queueDepth,
    );

    // §54.3/R15-72: Preemption decisions
    const preemptionDecisions = this.calculatePreemptionDecisions(
      request.tiers,
      selectedTier,
      breachRecords,
      delayPrediction,
    );

    return {
      selectedTierId: selectedTier.tierId,
      routingHint: {
        tierId: selectedTier.tierId,
        preemptionPriority: selectedTier.preemptionPriority ?? 0,
        reservedCapacityUnits: reservedCapacity[selectedTier.tierId] ?? 0,
        maxQueueWaitMs: selectedTier.maxQueueWaitMs ?? 3000,
      },
      reservedCapacity,
      breachRecords,
      escalationActions,
      penaltyDecisions,
      starvationProtected,
      preemptionCapApplied,
      workflowClass: request.workflowClass,
      // §54.3/R15-72: Include new predictive fields
      delayPrediction,
      scalingRecommendation,
      preemptionDecisions,
    };
  }

  /**
   * §54.3/R15-72: Calculates preemption decisions based on tier priorities and conditions.
   */
  private calculatePreemptionDecisions(
    tiers: readonly SlaTierProfile[],
    selectedTier: SlaTierProfile | null,
    breachRecords: readonly SlaBreachRecord[],
    prediction: DelayPrediction | null,
  ): PreemptionDecision[] {
    const decisions: PreemptionDecision[] = [];

    // No selected tier or prediction means no preemption
    if (selectedTier == null || prediction == null) {
      return [];
    }

    // Only consider preemption if we have critical breach or degrading trend
    const hasCriticalBreach = breachRecords.some((r) => r.severity === "critical");
    const shouldConsiderPreemption = hasCriticalBreach || prediction.trend === "degrading";

    if (!shouldConsiderPreemption) {
      // Return maintain decisions for all tiers
      return tiers.map((tier) => ({
        tierId: tier.tierId,
        shouldPreempt: false,
        priorityThreshold: tier.preemptionPriority ?? 0,
        reason: "No critical conditions for preemption",
      }));
    }

    // Find tiers with lower priority that could be preempted
    const selectedPriority = selectedTier.preemptionPriority ?? 0;
    const lowerPriorityTiers = tiers.filter((t) => (t.preemptionPriority ?? 0) < selectedPriority);

    for (const tier of lowerPriorityTiers) {
      // Recommend preemption if selected tier is at risk
      const shouldPreempt = hasCriticalBreach || prediction.predictedQueueWaitMs > (tier.maxQueueWaitMs ?? 3000);
      decisions.push({
        tierId: tier.tierId,
        shouldPreempt,
        priorityThreshold: tier.preemptionPriority ?? 0,
        reason: shouldPreempt
          ? `Higher priority tier ${selectedTier.tierId} requires resources due to SLA pressure`
          : "Preemption threshold not met",
      });
    }

    return decisions;
  }
}
