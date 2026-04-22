import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

export * as apps from "./apps/index.js";
export * as domains from "./domains/index.js";
export * as interaction from "./interaction/index.js";
export * from "./interaction-governance-runtime-catalog.js";
export * from "./interaction-governance-runtime-orchestrator.js";
export * from "./interaction-governance-startup-plan.js";
export * as opsMaturity from "./ops-maturity/index.js";
export * as orgGovernance from "./org-governance/index.js";
export * from "./platform-application-kernel.js";
export * from "./platform-architecture-bootstrap.js";
export * from "./platform-architecture-types.js";
export * as platform from "./platform/index.js";
export * as plugins from "./plugins/index.js";
export * as scaleEcosystem from "./scale-ecosystem/index.js";
export * as sdk from "./sdk/index.js";

export type PlatformRootEntryMode = "summary" | "demo" | PlatformAppKind;

export interface PlatformRootSummary {
  readonly architecture: ReturnType<typeof buildPlatformArchitectureBootstrapSummary>;
  readonly planes: {
    readonly startupOrder: readonly string[];
    readonly totalCapabilityCount: number;
    readonly capabilityCounts: {
      readonly interface: number;
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

function resolveRootEntryMode(): PlatformRootEntryMode {
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

export async function runPlatformRootDemo(): Promise<void> {
  requireValidStartupEnv();

  const snapshot = await runSingleTaskExecution({
    dbPath: resolveDbPath(),
    title: "Single-task execution baseline",
    request: "Create the minimal stable single-agent execution baseline.",
  });

  console.log(
    JSON.stringify(
      {
        task: {
          id: snapshot.task.id,
          status: snapshot.task.status,
          output: snapshot.task.outputJson ? JSON.parse(snapshot.task.outputJson) : null,
        },
        workflow: snapshot.workflow
          ? {
              status: snapshot.workflow.status,
              currentStepIndex: snapshot.workflow.currentStepIndex,
            }
          : null,
        execution: snapshot.execution
          ? {
              id: snapshot.execution.id,
              status: snapshot.execution.status,
              traceId: snapshot.execution.traceId,
            }
          : null,
        session: snapshot.session
          ? {
              id: snapshot.session.id,
              status: snapshot.session.status,
            }
          : null,
        stepOutputs: snapshot.stepOutputs.length,
        events: snapshot.events.map((event) => ({
          eventType: event.eventType,
          eventTier: event.eventTier,
        })),
      },
      null,
      2,
    ),
  );
}

export async function runPlatformRootSummary(): Promise<void> {
  const summary = buildPlatformRootSummary();
  console.log(JSON.stringify(summary, null, 2));
}

export function buildPlatformRootSummary(): PlatformRootSummary {
  const architecture = buildPlatformArchitectureBootstrapSummary();
  const startupPlan = buildFivePlaneStartupPlan();
  const aiOperationsStartupPlan = buildAiOperationsStartupPlan();
  const interactionGovernanceStartupPlan = buildInteractionGovernanceStartupPlan();
  const runtimeCatalog = buildFivePlaneRuntimeCatalog();
  const aiOperationsRuntimeCatalog = buildAiOperationsRuntimeCatalog();
  const interactionGovernanceRuntimeCatalog = buildInteractionGovernanceRuntimeCatalog();

  return {
    architecture,
    planes: {
      startupOrder: startupPlan.startupOrder,
      totalCapabilityCount: startupPlan.totalCapabilityCount,
      capabilityCounts: {
        interface: runtimeCatalog.interfacePlane.length,
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
  };
}

export async function runPlatformStartupPlan(targetKind: Extract<PlatformStartupTargetKind, PlatformAppKind>): Promise<void> {
  const kernel = getPlatformApplicationKernel();
  const plan = kernel.buildStartupPlan(targetKind);
  console.log(JSON.stringify(plan, null, 2));
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
    console.error(JSON.stringify({ mode: resolveRootEntryMode(), error: normalized }, null, 2));
    process.exitCode = 1;
  });
}
