import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildDomainsRuntimeCatalog } from "./domains-runtime-catalog.js";
import { buildDomainsStartupPlan } from "./domains-startup-plan.js";
import { buildInteractionGovernanceRuntimeCatalog } from "./interaction-governance-runtime-catalog.js";
import { buildInteractionGovernanceStartupPlan } from "./interaction-governance-startup-plan.js";
import { buildAiOperationsRuntimeCatalog } from "./platform/ai-operations-runtime-catalog.js";
import { buildAiOperationsStartupPlan } from "./platform/ai-operations-startup-plan.js";
import { requireValidStartupEnv } from "./platform/control-plane/config-center/startup-env-schema.js";
import { runSingleTaskExecution } from "./platform/execution/execution-engine/single-task-execution.js";
import { buildFivePlaneRuntimeCatalog } from "./platform/five-plane-runtime-bootstrap.js";
import { buildFivePlaneStartupPlan } from "./platform/five-plane-startup-plan.js";
import { buildPlatformArchitectureBootstrapSummary } from "./platform-architecture-bootstrap.js";
import { getPlatformApplicationKernel } from "./platform-application-kernel.js";
import type { PlatformAppKind, PlatformStartupTargetKind } from "./platform-architecture-types.js";
import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { StructuredLogger } from "./platform/shared/observability/structured-logger.js";
import { buildScaleOpsRuntimeCatalog } from "./scale-ops-runtime-catalog.js";
import { buildScaleOpsStartupPlan } from "./scale-ops-startup-plan.js";

export * as apps from "./apps/index.js";
export * as domains from "./domains/index.js";
export * as interaction from "./interaction/index.js";
export * as opsMaturity from "./ops-maturity/index.js";
export * as orgGovernance from "./org-governance/index.js";
export * as platform from "./platform/index.js";
export * as plugins from "./plugins/index.js";
export * as scaleEcosystem from "./scale-ecosystem/index.js";
export * as sdk from "./sdk/index.js";

export { buildDomainsRuntimeCatalog } from "./domains-runtime-catalog.js";
export { buildDomainsStartupPlan } from "./domains-startup-plan.js";
export { buildInteractionGovernanceRuntimeCatalog } from "./interaction-governance-runtime-catalog.js";
export { buildInteractionGovernanceStartupPlan } from "./interaction-governance-startup-plan.js";
export { getPlatformApplicationKernel } from "./platform-application-kernel.js";
export { buildAiOperationsRuntimeCatalog } from "./platform/ai-operations-runtime-catalog.js";
export { buildAiOperationsStartupPlan } from "./platform/ai-operations-startup-plan.js";
export { buildFivePlaneRuntimeCatalog } from "./platform/five-plane-runtime-bootstrap.js";
export { buildFivePlaneStartupPlan } from "./platform/five-plane-startup-plan.js";
export { buildPlatformArchitectureBootstrapSummary } from "./platform-architecture-bootstrap.js";
export type { PlatformAppKind, PlatformStartupTargetKind } from "./platform-architecture-types.js";
export { buildScaleOpsRuntimeCatalog } from "./scale-ops-runtime-catalog.js";
export { buildScaleOpsStartupPlan } from "./scale-ops-startup-plan.js";
export {
  CrossRegionRoutingService,
  DataReplicatorService,
  RegionHealthCheckService,
  FairSchedulingService,
  ResourcePoolService,
  SlaOperationsService,
  MarketplaceGovernanceService,
  PackSecurityService,
  sortMarketplaceCatalog,
  BillingService,
  StripeBillingPaymentGateway,
  buildBillingMarkdown,
  TenantPlatformService,
  ComplianceProgramService,
  DataPlaneFlowService,
  PerceptionService,
  PmfValidationService,
  EnterpriseCapabilityMatrixService,
  LicenseEnforcementService,
  PlatformOperatorService,
  FeedbackImprovementService,
  FeedbackCollector,
  FeedbackQualityGrader,
  ConnectorFrameworkService,
  GitHubConnector,
  JiraConnector,
  SlackConnector,
} from "./scale-ecosystem/index.js";

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

interface PlatformRootSummaryBuilderDeps {
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

const logger = new StructuredLogger({ retentionLimit: 100 });

function writeJsonToStdout(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeJsonToStderr(payload: unknown): void {
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
}

interface PlatformRootDemoLegacySnapshot {
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

function resolveDbPath(): string {
  const base = process.cwd();
  const sqliteDir = join(base, "data", "sqlite");
  mkdirSync(sqliteDir, { recursive: true });
  return join(sqliteDir, "single-task-demo.db");
}

function isDirectExecution(): boolean {
  const scriptPath = process.argv[1];
  if (scriptPath == null || scriptPath.length === 0) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(scriptPath)).href;
}

function resolveRootEntryMode(): PlatformStartupTargetKind {
  const explicit = process.env.AA_PLATFORM_ENTRY_MODE;
  if (
    explicit === "demo" ||
    explicit === "summary" ||
    explicit === "api" ||
    explicit === "console" ||
    explicit === "worker"
  ) {
    return explicit;
  }
  return process.env.npm_lifecycle_event === "demo" ? "demo" : "summary";
}

function parseTaskOutput(outputJson: string | null): unknown {
  if (outputJson == null) {
    return null;
  }
  try {
    return JSON.parse(outputJson);
  } catch {
    return outputJson;
  }
}

export function buildPlatformRootDemoSummary(snapshot: PlatformRootDemoLegacySnapshot): PlatformRootDemoSummary {
  return {
    contractSurface: "platform_root_demo_summary_v1",
    runRef: {
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      sessionId: snapshot.session?.id ?? null,
      traceId: snapshot.execution?.traceId ?? null,
    },
    lifecycle: {
      taskStatus: snapshot.task.status,
      workflowStatus: snapshot.workflow?.status ?? null,
      executionStatus: snapshot.execution?.status ?? null,
      sessionStatus: snapshot.session?.status ?? null,
      currentStepIndex: snapshot.workflow?.currentStepIndex ?? null,
    },
    result: {
      output: parseTaskOutput(snapshot.task.outputJson),
      stepOutputCount: snapshot.stepOutputs.length,
    },
    events: snapshot.events.map((event) => ({
      eventType: event.eventType,
      eventTier: event.eventTier,
    })),
  };
}

export async function runPlatformRootDemo(): Promise<void> {
  requireValidStartupEnv();

  const snapshot = await runSingleTaskExecution({
    dbPath: resolveDbPath(),
    title: "Single-task execution baseline",
    request: "Create the minimal stable single-agent execution baseline.",
  });

  writeJsonToStdout(buildPlatformRootDemoSummary(snapshot));
}

export async function runPlatformRootSummary(): Promise<void> {
  const summary = buildPlatformRootSummary();
  writeJsonToStdout(summary);
}

function safeBuildSection<T>(section: string, build: () => T, fallback: T): T {
  try {
    return build();
  } catch (error) {
    logger.warn("Platform root summary section failed; using fallback", {
      section,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export function buildPlatformRootSummary(
  deps: Partial<PlatformRootSummaryBuilderDeps> = {},
): PlatformRootSummary {
  const resolvedDeps: PlatformRootSummaryBuilderDeps = {
    buildArchitectureSummary: deps.buildArchitectureSummary ?? buildPlatformArchitectureBootstrapSummary,
    buildDomainsStartupPlan: deps.buildDomainsStartupPlan ?? buildDomainsStartupPlan,
    buildDomainsRuntimeCatalog: deps.buildDomainsRuntimeCatalog ?? buildDomainsRuntimeCatalog,
    buildFivePlaneStartupPlan: deps.buildFivePlaneStartupPlan ?? buildFivePlaneStartupPlan,
    buildFivePlaneRuntimeCatalog: deps.buildFivePlaneRuntimeCatalog ?? buildFivePlaneRuntimeCatalog,
    buildAiOperationsStartupPlan: deps.buildAiOperationsStartupPlan ?? buildAiOperationsStartupPlan,
    buildAiOperationsRuntimeCatalog: deps.buildAiOperationsRuntimeCatalog ?? buildAiOperationsRuntimeCatalog,
    buildInteractionGovernanceStartupPlan: deps.buildInteractionGovernanceStartupPlan ?? buildInteractionGovernanceStartupPlan,
    buildInteractionGovernanceRuntimeCatalog: deps.buildInteractionGovernanceRuntimeCatalog ?? buildInteractionGovernanceRuntimeCatalog,
    buildScaleOpsStartupPlan: deps.buildScaleOpsStartupPlan ?? buildScaleOpsStartupPlan,
    buildScaleOpsRuntimeCatalog: deps.buildScaleOpsRuntimeCatalog ?? buildScaleOpsRuntimeCatalog,
  };

  // R9-15 fix: Initialize sections in proper dependency order
  // Order: architecture (base) → domains → planes → aiOperations → interactionGovernance → scaleOps
  // Each section builds on prior sections (e.g., planes need domain catalog for ring assignments)
  const architecture = safeBuildSection("architecture", resolvedDeps.buildArchitectureSummary, null);

  // Domains layer - no dependencies on other sections
  const domainsStartupPlan = safeBuildSection("domains.startupPlan", resolvedDeps.buildDomainsStartupPlan, {
    startupOrder: [],
    totalCapabilityCount: 0,
    steps: [],
  });
  const domainsRuntimeCatalog = safeBuildSection("domains.runtimeCatalog", resolvedDeps.buildDomainsRuntimeCatalog, {
    ring1: [],
    ring2: [],
    ring3: [],
  });
  const startupPlan = safeBuildSection("planes.startupPlan", resolvedDeps.buildFivePlaneStartupPlan, {
    startupOrder: [],
    totalCapabilityCount: 0,
    steps: [],
  });
  const aiOperationsStartupPlan = safeBuildSection("aiOperations.startupPlan", resolvedDeps.buildAiOperationsStartupPlan, {
    startupOrder: [],
    totalCapabilityCount: 0,
    steps: [],
  });
  const interactionGovernanceStartupPlan = safeBuildSection("interactionGovernance.startupPlan", resolvedDeps.buildInteractionGovernanceStartupPlan, {
    startupOrder: [],
    totalCapabilityCount: 0,
    steps: [],
  });
  const runtimeCatalog = safeBuildSection("planes.runtimeCatalog", resolvedDeps.buildFivePlaneRuntimeCatalog, {
    interfacePlane: [],
    controlPlane: [],
    orchestrationPlane: [],
    executionPlane: [],
    stateEvidencePlane: [],
  });
  const aiOperationsRuntimeCatalog = safeBuildSection("aiOperations.runtimeCatalog", resolvedDeps.buildAiOperationsRuntimeCatalog, {
    modelGateway: [],
    promptEngine: [],
    compliance: [],
    harness: [],
  });
  const interactionGovernanceRuntimeCatalog = safeBuildSection(
    "interactionGovernance.runtimeCatalog",
    resolvedDeps.buildInteractionGovernanceRuntimeCatalog,
    {
      interaction: [],
      governance: [],
    },
  );
  const scaleOpsStartupPlan = safeBuildSection("scaleOps.startupPlan", resolvedDeps.buildScaleOpsStartupPlan, {
    startupOrder: [],
    totalCapabilityCount: 0,
    steps: [],
  });
  const scaleOpsRuntimeCatalog = safeBuildSection("scaleOps.runtimeCatalog", resolvedDeps.buildScaleOpsRuntimeCatalog, {
    scaleEcosystem: [],
    opsMaturity: [],
  });

  return {
    architecture,
    domains: {
      startupOrder: domainsStartupPlan.startupOrder,
      totalCapabilityCount: domainsStartupPlan.totalCapabilityCount,
      capabilityCounts: {
        ring1: domainsRuntimeCatalog.ring1.length,
        ring2: domainsRuntimeCatalog.ring2.length,
        ring3: domainsRuntimeCatalog.ring3.length,
      },
    },
    planes: {
      startupOrder: startupPlan.startupOrder,
      totalCapabilityCount: startupPlan.totalCapabilityCount,
      capabilityCounts: {
        interface: runtimeCatalog.interfacePlane.length,
        x1Fabric: startupPlan.steps.find((step) => step.stepId === "x1-fabric")?.capabilityCount ?? 0,
        controlPlane: runtimeCatalog.controlPlane.length,
        orchestration: runtimeCatalog.orchestrationPlane.length,
        execution: runtimeCatalog.executionPlane.length,
        stateEvidence: runtimeCatalog.stateEvidencePlane.length,
      },
    },
    aiOperations: {
      startupOrder: aiOperationsStartupPlan.startupOrder,
      totalCapabilityCount: aiOperationsStartupPlan.totalCapabilityCount,
      capabilityCounts: {
        modelGateway: aiOperationsRuntimeCatalog.modelGateway.length,
        promptEngine: aiOperationsRuntimeCatalog.promptEngine.length,
        compliance: aiOperationsRuntimeCatalog.compliance.length,
        harness: aiOperationsRuntimeCatalog.harness.length,
      },
    },
    interactionGovernance: {
      startupOrder: interactionGovernanceStartupPlan.startupOrder,
      totalCapabilityCount: interactionGovernanceStartupPlan.totalCapabilityCount,
      capabilityCounts: {
        interaction: interactionGovernanceRuntimeCatalog.interaction.length,
        governance: interactionGovernanceRuntimeCatalog.governance.length,
      },
    },
    scaleOps: {
      startupOrder: scaleOpsStartupPlan.startupOrder,
      totalCapabilityCount: scaleOpsStartupPlan.totalCapabilityCount,
      capabilityCounts: {
        scaleEcosystem: scaleOpsRuntimeCatalog.scaleEcosystem.length,
        opsMaturity: scaleOpsRuntimeCatalog.opsMaturity.length,
      },
    },
  };
}

export async function runPlatformStartupPlan(
  targetKind: Extract<PlatformStartupTargetKind, PlatformAppKind>,
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): Promise<void> {
  const kernel = getPlatformApplicationKernel(registry);
  const plan = kernel.buildStartupPlan(targetKind);
  writeJsonToStdout(plan);
}

export async function main(): Promise<void> {
  const mode = resolveRootEntryMode();
  if (mode === "demo") {
    await runPlatformRootDemo();
    return;
  }
  if (mode === "api" || mode === "console" || mode === "worker") {
    await runPlatformStartupPlan(mode);
    return;
  }
  await runPlatformRootSummary();
}

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    const normalized = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
    writeJsonToStderr({ mode: resolveRootEntryMode(), error: normalized });
    process.exitCode = 1;
  });
}
