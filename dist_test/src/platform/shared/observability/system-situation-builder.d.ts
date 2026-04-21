import type { HealthService } from "./health-service.js";
import type { SystemSituation } from "./system-situation-model.js";
export interface SystemSituationBuilderOptions {
    /** HealthService instance for live system data */
    healthService?: HealthService | null;
}
/**
 * SystemSituationBuilder — builds a SystemSituation from live health data.
 *
 * §3 defines SystemSituation as the system-level complement to TaskSituation,
 * capturing health status, provider health, resource utilization, and queue backpressure.
 *
 * When a HealthService is injected, it queries live data; otherwise falls back
 * to process-level metrics (memory, event loop lag).
 */
export declare class SystemSituationBuilder {
    private readonly options;
    constructor(options?: SystemSituationBuilderOptions);
    /**
     * Build a SystemSituation snapshot from current system state.
     */
    build(): SystemSituation;
}
