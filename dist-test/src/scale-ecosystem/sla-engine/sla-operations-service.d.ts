import { type SlaObservation } from "./breach-detector/index.js";
import { type ReservedCapacityAllocation } from "./resource-allocator/index.js";
import { type SlaTier } from "./tier-resolver/index.js";
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
export declare class SlaOperationsService {
    evaluate(request: SlaOperationsRequest): SlaOperationsDecision;
}
