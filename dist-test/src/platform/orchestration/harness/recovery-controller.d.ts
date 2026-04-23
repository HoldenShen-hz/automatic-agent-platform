import type { DurableHarnessService } from "./durable/durable-harness-service.js";
import type { HarnessRun, HarnessRuntimeService } from "./index.js";
export type HarnessFailureType = "worker_crash" | "tool_timeout" | "operator_abort";
export declare class RecoveryController {
    private readonly durableService;
    private readonly runtime;
    constructor(durableService: DurableHarnessService, runtime: HarnessRuntimeService);
    handleFailure(run: HarnessRun, failure: HarnessFailureType): HarnessRun;
}
