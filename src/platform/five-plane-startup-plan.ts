import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { X1_FABRIC_BOOTSTRAP_SERVICE_ID } from "./five-plane-runtime-bootstrap.js";
import {
  buildComplianceBootstrap,
  COMPLIANCE_BOOTSTRAP_SERVICE_ID,
} from "./compliance/compliance-bootstrap.js";
import {
  CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
  buildControlPlaneBootstrap,
} from "./control-plane/control-plane-bootstrap.js";
import {
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  buildExecutionPlaneBootstrap,
} from "./execution/execution-plane-bootstrap.js";
import {
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
  buildInterfacePlaneBootstrap,
} from "./interface/interface-plane-bootstrap.js";
import {
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
  buildModelGatewayBootstrap,
} from "./model-gateway/model-gateway-bootstrap.js";
import {
  ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
  buildOrchestrationPlaneBootstrap,
} from "./orchestration/orchestration-plane-bootstrap.js";
import {
  PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
  buildPromptEngineBootstrap,
} from "./prompt-engine/prompt-engine-bootstrap.js";
import {
  resolvePlatformSurfaceManifest,
  type PlatformSurfaceId,
} from "./platform-module-catalog.js";
import {
  STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
  buildStateEvidencePlaneBootstrap,
} from "./state-evidence/state-evidence-plane-bootstrap.js";

export const FIVE_PLANE_STARTUP_PLAN_SERVICE_ID = "plane.runtime.startup-plan";

export type FivePlaneStartupStepId =
  | "interface"
  | "x1-fabric"
  | "control-plane"
  | "orchestration"
  | "execution"
  | "state-evidence";

export interface FivePlaneStartupStep {
  readonly stepId: FivePlaneStartupStepId;
  readonly surfaceId: PlatformSurfaceId;
  readonly entryModule: string;
  readonly bootstrapServiceId: string;
  readonly capabilityCount: number;
  readonly dependsOnStepIds: readonly FivePlaneStartupStepId[];
}

export interface FivePlaneStartupPlan {
  readonly steps: readonly FivePlaneStartupStep[];
  readonly totalCapabilityCount: number;
  readonly startupOrder: readonly FivePlaneStartupStepId[];
}

export function buildFivePlaneStartupPlan(): FivePlaneStartupPlan {
  const interfaceSurface = resolvePlatformSurfaceManifest("interface");
  const x1Surface = resolvePlatformSurfaceManifest("x1-fabric");
  const controlSurface = resolvePlatformSurfaceManifest("control-plane");
  const orchestrationSurface = resolvePlatformSurfaceManifest("orchestration");
  const executionSurface = resolvePlatformSurfaceManifest("execution");
  const stateEvidenceSurface = resolvePlatformSurfaceManifest("state-evidence");
  const x1CapabilityCount =
    x1Surface.canonicalSubdomains.length
    + buildModelGatewayBootstrap().catalog.length
    + buildPromptEngineBootstrap().catalog.length
    + buildComplianceBootstrap().catalog.length;

  const steps = [
    {
      stepId: "interface",
      surfaceId: "interface",
      entryModule: interfaceSurface.entryModule,
      bootstrapServiceId: INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildInterfacePlaneBootstrap().catalog.length,
      dependsOnStepIds: [],
    },
    {
      stepId: "x1-fabric",
      surfaceId: "x1-fabric",
      entryModule: x1Surface.entryModule,
      bootstrapServiceId: X1_FABRIC_BOOTSTRAP_SERVICE_ID,
      capabilityCount: x1CapabilityCount,
      dependsOnStepIds: ["interface"],
    },
    {
      stepId: "control-plane",
      surfaceId: "control-plane",
      entryModule: controlSurface.entryModule,
      bootstrapServiceId: CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildControlPlaneBootstrap().catalog.length,
      dependsOnStepIds: ["x1-fabric"],
    },
    {
      stepId: "orchestration",
      surfaceId: "orchestration",
      entryModule: orchestrationSurface.entryModule,
      bootstrapServiceId: ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildOrchestrationPlaneBootstrap().catalog.length,
      dependsOnStepIds: ["control-plane"],
    },
    {
      stepId: "execution",
      surfaceId: "execution",
      entryModule: executionSurface.entryModule,
      bootstrapServiceId: EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildExecutionPlaneBootstrap().catalog.length,
      dependsOnStepIds: ["orchestration"],
    },
    {
      stepId: "state-evidence",
      surfaceId: "state-evidence",
      entryModule: stateEvidenceSurface.entryModule,
      bootstrapServiceId: STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
      capabilityCount: buildStateEvidencePlaneBootstrap().catalog.length,
      dependsOnStepIds: ["execution"],
    },
  ] as const satisfies readonly FivePlaneStartupStep[];

  return {
    steps,
    totalCapabilityCount: steps.reduce((sum, step) => sum + step.capabilityCount, 0),
    startupOrder: steps.map((step) => step.stepId),
  };
}

export function registerFivePlaneStartupPlan(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): FivePlaneStartupPlan {
  registry.register<FivePlaneStartupPlan>(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID, {
    init: () => buildFivePlaneStartupPlan(),
    dependsOn: [
      INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
      X1_FABRIC_BOOTSTRAP_SERVICE_ID,
      MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
      PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
      COMPLIANCE_BOOTSTRAP_SERVICE_ID,
      CONTROL_PLANE_BOOTSTRAP_SERVICE_ID,
      ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID,
      EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
      STATE_EVIDENCE_PLANE_BOOTSTRAP_SERVICE_ID,
    ],
  });
  return registry.get<FivePlaneStartupPlan>(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID);
}
