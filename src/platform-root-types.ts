import type { buildDomainsRuntimeCatalog } from "./domains-runtime-catalog.js";
import type { buildDomainsStartupPlan } from "./domains-startup-plan.js";
import type { buildInteractionGovernanceRuntimeCatalog } from "./interaction-governance-runtime-catalog.js";
import type { buildInteractionGovernanceStartupPlan } from "./interaction-governance-startup-plan.js";
import type { buildAiOperationsRuntimeCatalog } from "./platform/ai-operations-runtime-catalog.js";
import type { buildAiOperationsStartupPlan } from "./platform/ai-operations-startup-plan.js";
import type { buildFivePlaneRuntimeCatalog } from "./platform/five-plane-runtime-bootstrap.js";
import type { buildFivePlaneStartupPlan } from "./platform/five-plane-startup-plan.js";
import type { buildPlatformArchitectureBootstrapSummary } from "./platform-architecture-bootstrap.js";
import type { buildScaleOpsRuntimeCatalog } from "./scale-ops-runtime-catalog.js";
import type { buildScaleOpsStartupPlan } from "./scale-ops-startup-plan.js";

export interface PlatformRootSummary {
  readonly architecture: ReturnType<typeof buildPlatformArchitectureBootstrapSummary> | null;
  readonly domains: {
    readonly startupOrder: readonly string[];
    readonly totalCapabilityCount: number;
    readonly capabilityCounts: {
      readonly ring1: number;
      readonly ring2: number;
      readonly ring3: number;
    };
  };
  readonly planes: {
    readonly startupOrder: readonly string[];
    readonly totalCapabilityCount: number;
    readonly capabilityCounts: {
      readonly interface: number;
      readonly x1Fabric: number;
      readonly controlPlane: number;
      readonly orchestration: number;
      readonly execution: number;
      readonly stateEvidence: number;
    };
  };
  readonly aiOperations: {
    readonly startupOrder: readonly string[];
    readonly totalCapabilityCount: number;
    readonly capabilityCounts: {
      readonly modelGateway: number;
      readonly promptEngine: number;
      readonly compliance: number;
      readonly harness: number;
    };
  };
  readonly interactionGovernance: {
    readonly startupOrder: readonly string[];
    readonly totalCapabilityCount: number;
    readonly capabilityCounts: {
      readonly interaction: number;
      readonly governance: number;
    };
  };
  readonly scaleOps: {
    readonly startupOrder: readonly string[];
    readonly totalCapabilityCount: number;
    readonly capabilityCounts: {
      readonly scaleEcosystem: number;
      readonly opsMaturity: number;
    };
  };
}

export interface PlatformRootSummaryBuilderDeps {
  readonly buildArchitectureSummary: () => ReturnType<typeof buildPlatformArchitectureBootstrapSummary>;
  readonly buildDomainsStartupPlan: typeof buildDomainsStartupPlan;
  readonly buildDomainsRuntimeCatalog: typeof buildDomainsRuntimeCatalog;
  readonly buildFivePlaneStartupPlan: typeof buildFivePlaneStartupPlan;
  readonly buildFivePlaneRuntimeCatalog: typeof buildFivePlaneRuntimeCatalog;
  readonly buildAiOperationsStartupPlan: typeof buildAiOperationsStartupPlan;
  readonly buildAiOperationsRuntimeCatalog: typeof buildAiOperationsRuntimeCatalog;
  readonly buildInteractionGovernanceStartupPlan: typeof buildInteractionGovernanceStartupPlan;
  readonly buildInteractionGovernanceRuntimeCatalog: typeof buildInteractionGovernanceRuntimeCatalog;
  readonly buildScaleOpsStartupPlan: typeof buildScaleOpsStartupPlan;
  readonly buildScaleOpsRuntimeCatalog: typeof buildScaleOpsRuntimeCatalog;
}

export interface PlatformRootDemoLegacySnapshot {
  readonly task: {
    readonly id: string;
    readonly status: string;
    readonly outputJson: string | null;
  };
  readonly workflow: {
    readonly status: string;
    readonly currentStepIndex: number;
  } | null;
  readonly execution: {
    readonly id: string;
    readonly status: string;
    readonly traceId: string;
  } | null;
  readonly session: {
    readonly id: string;
    readonly status: string;
  } | null;
  readonly stepOutputs: readonly unknown[];
  readonly events: readonly {
    readonly eventType: string;
    readonly eventTier: string;
  }[];
}

export interface PlatformRootDemoSummary {
  readonly contractSurface: "platform_root_demo_summary_v1";
  readonly runRef: {
    readonly taskId: string;
    readonly executionId: string | null;
    readonly sessionId: string | null;
    readonly traceId: string | null;
  };
  readonly lifecycle: {
    readonly taskStatus: string;
    readonly workflowStatus: string | null;
    readonly executionStatus: string | null;
    readonly sessionStatus: string | null;
    readonly currentStepIndex: number | null;
  };
  readonly result: {
    readonly output: unknown;
    readonly stepOutputCount: number;
  };
  readonly events: readonly {
    readonly eventType: string;
    readonly eventTier: string;
  }[];
}
