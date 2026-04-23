import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { type PlatformMainlineCapabilityId } from "./platform-mainline-bootstrap.js";
export declare const AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID = "aiops.runtime.startup-plan";
export type AiOperationsStartupStepId = "model-gateway" | "prompt-engine" | "compliance" | "harness";
export interface AiOperationsStartupStep {
    readonly stepId: AiOperationsStartupStepId;
    readonly capabilityId: Extract<PlatformMainlineCapabilityId, "model-gateway" | "prompt-engine" | "compliance" | "orchestration">;
    readonly entryModule: string;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly dependsOnStepIds: readonly AiOperationsStartupStepId[];
}
export interface AiOperationsStartupPlan {
    readonly steps: readonly AiOperationsStartupStep[];
    readonly totalCapabilityCount: number;
    readonly startupOrder: readonly AiOperationsStartupStepId[];
}
export declare function buildAiOperationsStartupPlan(): AiOperationsStartupPlan;
export declare function registerAiOperationsStartupPlan(registry?: ServiceRegistry): AiOperationsStartupPlan;
