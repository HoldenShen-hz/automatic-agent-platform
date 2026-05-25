import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID,
  registerAiOperationsRuntimeCatalog,
} from "./ai-operations-runtime-catalog.js";
import {
  AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID,
  buildAiOperationsStartupPlan,
  registerAiOperationsStartupPlan,
  type AiOperationsStartupPlan,
  type AiOperationsStartupStepId,
} from "./ai-operations-startup-plan.js";
import {
  COMPLIANCE_BOOTSTRAP_SERVICE_ID,
  registerComplianceBootstrap,
} from "./compliance/compliance-bootstrap.js";
import {
  HARNESS_BOOTSTRAP_SERVICE_ID,
  registerHarnessBootstrap,
} from "./five-plane-orchestration/harness/harness-bootstrap.js";
import {
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
  registerModelGatewayBootstrap,
} from "./model-gateway/model-gateway-bootstrap.js";
import {
  PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
  registerPromptEngineBootstrap,
} from "./prompt-engine/prompt-engine-bootstrap.js";
import {
  executeStartupPlan,
  snapshotStartupReadiness,
} from "./shared/lifecycle/runtime-orchestrator-support.js";

export const AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "aiops.runtime.orchestrator";

export interface AiOperationsStartupExecutionStep {
  readonly stepId: AiOperationsStartupStepId;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly initialized: boolean;
  readonly initializedDependencyServiceIds: readonly string[];
}

export interface AiOperationsRuntimeStartupResult {
  readonly ready: boolean;
  readonly startupOrder: readonly AiOperationsStartupStepId[];
  readonly initializedServiceIds: readonly string[];
  readonly steps: readonly AiOperationsStartupExecutionStep[];
}

export interface AiOperationsReadinessSnapshot {
  readonly runtimeCatalogInitialized: boolean;
  readonly startupPlanInitialized: boolean;
  readonly orchestratorInitialized: boolean;
  readonly capabilityReadiness: readonly {
    readonly stepId: AiOperationsStartupStepId;
    readonly bootstrapServiceId: string;
    readonly initialized: boolean;
  }[];
}

export class AiOperationsRuntimeOrchestrator {
  public constructor(private readonly registry: ServiceRegistry = ServiceRegistry.createScoped()) {}

  public prepare(): AiOperationsStartupPlan {
    registerModelGatewayBootstrap(this.registry);
    registerPromptEngineBootstrap(this.registry);
    registerComplianceBootstrap(this.registry);
    registerHarnessBootstrap(this.registry);
    registerAiOperationsRuntimeCatalog(this.registry);
    return registerAiOperationsStartupPlan(this.registry);
  }

  public startup(): AiOperationsRuntimeStartupResult {
    const startupPlan = this.prepare();
    const runtime = executeStartupPlan(this.registry, startupPlan, "aiops_startup_plan.missing_dependency");

    return {
      ...runtime,
    };
  }

  public snapshotReadiness(): AiOperationsReadinessSnapshot {
    const startupPlan = buildAiOperationsStartupPlan();
    return {
      runtimeCatalogInitialized: this.registry.isInitialized(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID),
      startupPlanInitialized: this.registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID),
      orchestratorInitialized: this.registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID),
      capabilityReadiness: snapshotStartupReadiness(this.registry, startupPlan),
    };
  }
}

export function registerAiOperationsRuntimeOrchestrator(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): AiOperationsRuntimeOrchestrator {
  registerModelGatewayBootstrap(registry);
  registerPromptEngineBootstrap(registry);
  registerComplianceBootstrap(registry);
  registerHarnessBootstrap(registry);
  registerAiOperationsRuntimeCatalog(registry);
  registerAiOperationsStartupPlan(registry);
  registry.register<AiOperationsRuntimeOrchestrator>(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID, {
    init: () => new AiOperationsRuntimeOrchestrator(registry),
    dependsOn: [
      AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID,
      MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
      PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
      COMPLIANCE_BOOTSTRAP_SERVICE_ID,
      HARNESS_BOOTSTRAP_SERVICE_ID,
      AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID,
    ],
  });
  return registry.get<AiOperationsRuntimeOrchestrator>(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID);
}
