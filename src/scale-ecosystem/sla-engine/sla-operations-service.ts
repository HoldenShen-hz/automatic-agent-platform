import { detectSlaBreach, type SlaCommitment, type SlaObservation } from "./breach-detector/index.js";
import { allocateReservedCapacity, type ReservedCapacityAllocation } from "./resource-allocator/index.js";
import { resolveHighestPriorityTier, type SlaTier } from "./tier-resolver/index.js";

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
  readonly observation: SlaObservation;
  readonly reservedCapacityPlan?: readonly ReservedCapacityAllocation[];
  readonly totalCapacityUnits: number;
  readonly observedAt: string;
}

export interface SlaOperationsDecision {
  readonly selectedTierId: string | null;
  readonly routingHint: SlaRoutingHint | null;
  readonly reservedCapacity: Readonly<Record<string, number>>;
  readonly breachRecords: readonly SlaBreachRecord[];
  readonly escalationActions: readonly SlaEscalationAction[];
  readonly penaltyDecisions: readonly SlaPenaltyDecision[];
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

export class SlaOperationsService {
  public evaluate(request: SlaOperationsRequest): SlaOperationsDecision {
    const selectedTier = request.selectedTierId == null
      ? resolveHighestPriorityTier(request.tiers)
      : request.tiers.find((tier) => tier.tierId === request.selectedTierId) ?? null;
    const reservedCapacity = allocateReservedCapacity(
      request.totalCapacityUnits,
      request.reservedCapacityPlan ?? request.tiers.map((tier) => ({
        tierId: tier.tierId,
        reservedPercent: tier.reservedCapacityPercent,
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
      };
    }

    const commitment: SlaCommitment = {
      maxLatencyMs: selectedTier.targetLatencyMs ?? 1000,
      minSuccessRate: selectedTier.targetSuccessRate ?? 0.99,
      maxQueueWaitMs: selectedTier.maxQueueWaitMs ?? 3000,
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
    };
  }
}
