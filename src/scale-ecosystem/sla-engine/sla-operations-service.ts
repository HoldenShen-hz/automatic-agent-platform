import { detectSlaBreach, type SlaCommitment, type SlaObservation } from "./breach-detector/index.js";
import { allocateReservedCapacity, type ReservedCapacityAllocation } from "./resource-allocator/index.js";
import { resolveHighestPriorityTier, type SlaTier } from "./tier-resolver/index.js";

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
  readonly workflowClassSlaMap?: Readonly<Record<WorkflowClass, WorkflowClassSlaProfile>>;
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
  /** Amount in credits to be issued (for penaltyType="credit") */
  readonly creditAmount?: number;
  /** Description of the penalty for audit purposes */
  readonly description?: string;
}

const WORKFLOW_CLASS_LATENCY_MULTIPLIER: Record<WorkflowClass, number> = {
  deterministic: 0.5,
  llm_assisted: 1.5,
  hitl_waiting: 2.0,
};

export interface WorkflowClassSlaProfile {
  readonly workflowClass: WorkflowClass;
  readonly targetLatencyMs: number;
  readonly targetSuccessRate: number;
  readonly maxQueueWaitMs: number;
  readonly preemptionPriority: number;
}

const DEFAULT_WORKFLOW_CLASS_SLA_MAP: Record<WorkflowClass, WorkflowClassSlaProfile> = {
  deterministic: {
    workflowClass: "deterministic",
    targetLatencyMs: 500,
    targetSuccessRate: 0.999,
    maxQueueWaitMs: 1000,
    preemptionPriority: 10,
  },
  llm_assisted: {
    workflowClass: "llm_assisted",
    targetLatencyMs: 2000,
    targetSuccessRate: 0.98,
    maxQueueWaitMs: 5000,
    preemptionPriority: 5,
  },
  hitl_waiting: {
    workflowClass: "hitl_waiting",
    targetLatencyMs: 10000,
    targetSuccessRate: 0.95,
    maxQueueWaitMs: 30000,
    preemptionPriority: 1,
  },
};

/**
 * Calculate credit amount based on tier profile and breach severity.
 * Credits are calculated as a percentage of the tier's budget allocation.
 */
function calculateCreditAmount(tier: SlaTierProfile | null, breachCodes: readonly string[]): number {
  if (tier == null) {
    return 0;
  }
  // Base credit amount is 5% of budget allocation per breach code
  const baseCreditPercent = 5;
  const breachCount = breachCodes.length;
  const budgetAllocation = tier.budgetAllocationPercent ?? 0;
  return Math.floor(budgetAllocation * (baseCreditPercent * breachCount) / 100);
}

export class SlaOperationsService {
  public evaluate(request: SlaOperationsRequest): SlaOperationsDecision {
    const selectedTier = request.selectedTierId == null
      ? resolveHighestPriorityTier(request.tiers)
      : request.tiers.find((tier) => tier.tierId === request.selectedTierId) ?? null;
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
      };
    }

    const workflowClassSlaMap = request.workflowClassSlaMap ?? DEFAULT_WORKFLOW_CLASS_SLA_MAP;
    const workflowClassSla = workflowClassSlaMap[request.workflowClass];
    const adjustedMaxLatency = workflowClassSla?.targetLatencyMs ?? (selectedTier.targetLatencyMs ?? 1000) * WORKFLOW_CLASS_LATENCY_MULTIPLIER[request.workflowClass];
    const adjustedMinSuccessRate = workflowClassSla?.targetSuccessRate ?? selectedTier.targetSuccessRate ?? 0.99;
    const adjustedMaxQueueWaitMs = workflowClassSla?.maxQueueWaitMs ?? selectedTier.maxQueueWaitMs ?? 3000;
    const commitment: SlaCommitment = {
      maxLatencyMs: adjustedMaxLatency,
      minSuccessRate: adjustedMinSuccessRate,
      maxQueueWaitMs: adjustedMaxQueueWaitMs,
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
      creditAmount: record.severity === "critical" ? undefined : calculateCreditAmount(selectedTier, breachCodes),
      description: record.severity === "critical"
        ? "Critical SLA breach - contract review required"
        : `SLA breach: ${breachCodes.join(", ")} - credit issued`,
    }));

    const starvationProtected = request.tiers.some((tier) => (reservedCapacity[tier.tierId] ?? 0) > 0);
    // Preemption cap is applied only when selected tier has the highest priority (at the cap)
    const maxPriority = Math.max(...request.tiers.map((tier) => tier.preemptionPriority ?? 0), 0);
    const preemptionCapApplied = (selectedTier.preemptionPriority ?? 0) === maxPriority;
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
    };
  }
}
