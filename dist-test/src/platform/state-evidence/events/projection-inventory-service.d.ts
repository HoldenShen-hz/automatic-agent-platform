import { EventReliabilityInventoryService } from "./event-reliability-inventory-service.js";
export interface ProjectionInventoryRecord {
    readonly projectionName: string;
    readonly consumerId: string;
    readonly namespace: string;
    readonly eventTypes: readonly string[];
    readonly lagThresholdSeconds: number;
    readonly rebuildRequired: boolean;
    readonly coverageStatus: "implemented" | "contract_gap";
}
export declare class ProjectionInventoryService {
    private readonly eventInventoryService;
    constructor(eventInventoryService?: EventReliabilityInventoryService);
    listProjectionInventory(): ProjectionInventoryRecord[];
    buildSummary(): {
        total: number;
        contractGaps: string[];
    };
}
