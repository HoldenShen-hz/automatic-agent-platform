import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  COMPLIANCE_BOOTSTRAP_SERVICE_ID,
  buildComplianceBootstrap,
} from "./compliance/compliance-bootstrap.js";
import {
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
  buildModelGatewayBootstrap,
} from "./model-gateway/model-gateway-bootstrap.js";
import {
  PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
  buildPromptEngineBootstrap,
} from "./prompt-engine/prompt-engine-bootstrap.js";
import {
  resolvePlatformMainlineCapability,
  type PlatformMainlineCapabilityId,
} from "./platform-mainline-bootstrap.js";
import {
  HARNESS_BOOTSTRAP_SERVICE_ID,
  buildHarnessBootstrap,
} from "./five-plane-orchestration/harness/harness-bootstrap.js";

export const AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID = "aiops.runtime.startup-plan";

export type AiOperationsStartupStepId =
  | "model-gateway"
  | "prompt-engine"
  | "compliance"
  | "harness";

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

export function buildAiOperationsStartupPlan(): AiOperationsStartupPlan {
  const modelGateway = resolvePlatformMainlineCapability("model-gateway");
  const promptEngine = resolvePlatformMainlineCapability("prompt-engine");
  const compliance = resolvePlatformMainlineCapability("compliance");
  const orchestration = resolvePlatformMainlineCapability("orchestration");

  const steps = [
    {
      stepId: "model-gateway",
      capabilityId: "model-gateway",
      entryModule: modelGateway.entryModule,
      bootstrapServiceId: MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildModelGatewayBootstrap().catalog.length,
      dependsOnStepIds: [],
    },
    {
      stepId: "prompt-engine",
      capabilityId: "prompt-engine",
      entryModule: promptEngine.entryModule,
      bootstrapServiceId: PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildPromptEngineBootstrap().catalog.length,
      dependsOnStepIds: ["model-gateway"],
    },
    {
      stepId: "compliance",
      capabilityId: "compliance",
      entryModule: compliance.entryModule,
      bootstrapServiceId: COMPLIANCE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildComplianceBootstrap().catalog.length,
      dependsOnStepIds: ["prompt-engine"],
    },
    {
      stepId: "harness",
      capabilityId: "orchestration",
      entryModule: orchestration.entryModule,
      bootstrapServiceId: HARNESS_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildHarnessBootstrap().catalog.length,
      dependsOnStepIds: ["compliance"],
    },
  ] as const satisfies readonly AiOperationsStartupStep[];

  return {
    steps,
    totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
    startupOrder: steps.map((step) => step.stepId),
  };
}

export function registerAiOperationsStartupPlan(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): AiOperationsStartupPlan {
  if (registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID)) {
    return registry.get<AiOperationsStartupPlan>(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID);
  }

  registry.register<AiOperationsStartupPlan>(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID, {
    init: () => buildAiOperationsStartupPlan(),
    dependsOn: [
      MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
      PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
      COMPLIANCE_BOOTSTRAP_SERVICE_ID,
      HARNESS_BOOTSTRAP_SERVICE_ID,
    ],
  });
  return registry.get<AiOperationsStartupPlan>(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID);
}
