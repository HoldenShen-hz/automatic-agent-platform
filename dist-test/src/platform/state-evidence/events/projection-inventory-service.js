import { EventReliabilityInventoryService } from "./event-reliability-inventory-service.js";
const DEFAULT_PROJECTIONS = [
    { projectionName: "task_summary", consumerId: "task_projection", namespace: "task", lagThresholdSeconds: 30 },
    { projectionName: "workflow_summary", consumerId: "workflow_projection", namespace: "workflow", lagThresholdSeconds: 30 },
    { projectionName: "approval_summary", consumerId: "approval_projection", namespace: "decision", lagThresholdSeconds: 15 },
    { projectionName: "division_summary", consumerId: "division_projection", namespace: "division", lagThresholdSeconds: 60 },
    { projectionName: "budget_summary", consumerId: "budget_projection", namespace: "billing", lagThresholdSeconds: 60 },
    { projectionName: "inspect_projection", consumerId: "inspect_projection", namespace: "task", lagThresholdSeconds: 10 },
    { projectionName: "feedback_summary", consumerId: "feedback_projection", namespace: "feedback", lagThresholdSeconds: 60 },
    { projectionName: "gateway_summary", consumerId: "gateway_projection", namespace: "gateway", lagThresholdSeconds: 30 },
    { projectionName: "observability_summary", consumerId: "observability_sink", namespace: "runtime", lagThresholdSeconds: 10 },
];
export class ProjectionInventoryService {
    eventInventoryService;
    constructor(eventInventoryService = new EventReliabilityInventoryService()) {
        this.eventInventoryService = eventInventoryService;
    }
    listProjectionInventory() {
        const consumerSurfaces = new Map(this.eventInventoryService.listConsumerSurfaces().map((surface) => [surface.consumerId, surface]));
        return DEFAULT_PROJECTIONS.map((baseline) => {
            const consumer = consumerSurfaces.get(baseline.consumerId);
            return {
                projectionName: baseline.projectionName,
                consumerId: baseline.consumerId,
                namespace: baseline.namespace,
                eventTypes: consumer?.consumedEvents ?? [],
                lagThresholdSeconds: baseline.lagThresholdSeconds,
                rebuildRequired: true,
                coverageStatus: consumer?.coverageStatus ?? "contract_gap",
            };
        });
    }
    buildSummary() {
        const records = this.listProjectionInventory();
        return {
            total: records.length,
            contractGaps: records.filter((record) => record.coverageStatus === "contract_gap").map((record) => record.projectionName),
        };
    }
}
//# sourceMappingURL=projection-inventory-service.js.map