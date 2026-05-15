import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";

export type PlatformSurfaceId =
  | "contracts"
  | "interface"
  | "x1-fabric"
  | "control-plane"
  | "orchestration"
  | "execution"
  | "state-evidence"
  | "model-gateway"
  | "prompt-engine"
  | "shared"
  | "compliance";

export interface PlatformSurfaceManifest {
  surfaceId: PlatformSurfaceId;
  entryModule: string;
  description: string;
  architectureSections: string[];
  canonicalSubdomains: string[];
}

export type ArchitectureReadinessRingId = "contract-freeze" | "hardening" | "usability" | "expansion";
export type ArchitectureReadinessStatus = "implemented" | "evidence_registered" | "production_verified";

export interface ArchitectureReadinessRing {
  readonly ringId: ArchitectureReadinessRingId;
  readonly status: ArchitectureReadinessStatus;
  readonly gateMeaning: string;
  readonly architectureSections: readonly string[];
  readonly evidenceModules: readonly string[];
  readonly verificationTests: readonly string[];
}

export const PLATFORM_SURFACE_MANIFESTS: readonly PlatformSurfaceManifest[] = Object.freeze([
  {
    surfaceId: "contracts",
    entryModule: "src/platform/contracts/index.ts",
    description: "Cross-plane contract layer, centrally exposing request/result/control/state/evidence protocols.",
    architectureSections: ["§5"],
    canonicalSubdomains: ["request-envelope", "result-envelope", "control-directive", "execution-plan", "execution-receipt", "state-command"],
  },
  {
    surfaceId: "interface",
    entryModule: "src/platform/five-plane-interface/index.ts",
    description: "P1 Interface Plane, hosting API, Webhook, Scheduler, Console Backend and Ingress.",
    architectureSections: ["§4", "§6", "§7"],
    canonicalSubdomains: ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"],
  },
  {
    surfaceId: "x1-fabric",
    entryModule: "src/platform/shared/index.ts",
    description: "X1 cross-cutting fabric, aggregating shared reliability, observability, compliance, model gateway, and prompt governance surfaces.",
    architectureSections: ["§4.7", "§9", "§15", "§16", "§17", "§23", "§27", "§58"],
    canonicalSubdomains: ["shared", "model-gateway", "prompt-engine", "compliance"],
  },
  {
    surfaceId: "control-plane",
    entryModule: "src/platform/five-plane-control-plane/index.ts",
    description: "P2 Control Plane, hosting configuration, approval, policy, incident control, IAM and tenant boundaries.",
    architectureSections: ["§10", "§11", "§12", "§24"],
    canonicalSubdomains: ["approval-center", "config-center", "iam", "incident-control", "policy-center", "risk-control", "rollout-controller", "tenant"],
  },
  {
    surfaceId: "orchestration",
    entryModule: "src/platform/five-plane-orchestration/index.ts",
    description: "P3 Orchestration Plane, hosting OAPEFLIR, Planner, Routing, HITL, Replan and delegated collaboration.",
    architectureSections: ["§13", "§19", "§21", "§45"],
    canonicalSubdomains: ["agent-delegation", "escalation", "harness", "hitl", "oapeflir", "planner", "replan", "routing"],
  },
  {
    surfaceId: "execution",
    entryModule: "src/platform/five-plane-execution/index.ts",
    description: "P4 Execution Plane, hosting dispatcher, worker, lease, queue, tool execution and recovery.",
    architectureSections: ["§14", "§31"],
    canonicalSubdomains: ["dispatcher", "distributed-lock", "execution-engine", "ha", "lease", "queue", "recovery", "resource", "state-transition", "tool-executor", "worker-pool"],
  },
  {
    surfaceId: "state-evidence",
    entryModule: "src/platform/five-plane-state-evidence/index.ts",
    description: "P5 State & Evidence Plane, hosting truth, events, projection, artifact, audit, memory, knowledge.",
    architectureSections: ["§25", "§26", "§28", "§29"],
    canonicalSubdomains: ["artifacts", "audit", "checkpoints", "dlq", "events", "incident", "knowledge", "memory", "projections", "truth"],
  },
  {
    surfaceId: "model-gateway",
    entryModule: "src/platform/model-gateway/index.ts",
    description: "AI operations layer model gateway surface, hosting provider registry, router, fallback, degradation, cost tracking.",
    architectureSections: ["§15", "§18"],
    canonicalSubdomains: ["cache", "cost-tracker", "degradation", "fallback", "messages", "provider-registry", "router"],
  },
  {
    surfaceId: "prompt-engine",
    entryModule: "src/platform/prompt-engine/index.ts",
    description: "AI operations layer Prompt surface, hosting registry, renderer, rollout and eval.",
    architectureSections: ["§16", "§17"],
    canonicalSubdomains: ["eval", "registry", "renderer", "rollout"],
  },
  {
    surfaceId: "shared",
    entryModule: "src/platform/shared/index.ts",
    description: "Cross-cutting shared surface, hosting cache, context, lifecycle, observability, outbox, stability.",
    architectureSections: ["§9", "§27", "§58"],
    canonicalSubdomains: ["cache", "context", "lifecycle", "observability", "outbox", "scaling", "stability", "utils"],
  },
  {
    surfaceId: "compliance",
    entryModule: "src/platform/compliance/index.ts",
    description: "Platform compliance and data governance surface, hosting erasure, crypto-shredding, residency, lineage.",
    architectureSections: ["§23"],
    canonicalSubdomains: ["crypto-shredding", "data-residency", "encryption", "erasure", "lineage"],
  },
]);

export const ARCHITECTURE_READINESS_RINGS: readonly ArchitectureReadinessRing[] = Object.freeze([
  {
    ringId: "contract-freeze",
    status: "production_verified",
    gateMeaning: "Ring 1 executable contract freeze is implemented and covered by source-level runtime contract tests.",
    architectureSections: ["§5", "§13", "§14", "§25", "§26", "§28", "§58"],
    evidenceModules: [
      "src/platform/contracts/executable-contracts/index.ts",
      "src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.ts",
      "src/platform/five-plane-orchestration/harness/runtime/plan-graph-harness-runtime.ts",
      "src/platform/five-plane-execution/runtime-state-machine.ts",
      "src/platform/five-plane-state-evidence/truth/runtime-truth-repository.ts",
    ],
    verificationTests: [
      "tests/unit/platform/contracts/executable-contracts/index.test.ts",
      "tests/unit/platform/five-plane-orchestration/harness/runtime/intake-admission-service.test.ts",
      "tests/unit/platform/five-plane-orchestration/harness/runtime/plan-graph-harness-runtime.test.ts",
      "tests/unit/platform/five-plane-execution/runtime-state-machine.test.ts",
      "tests/unit/platform/five-plane-state-evidence/truth/runtime-truth-repository.test.ts",
    ],
  },
  {
    ringId: "hardening",
    status: "evidence_registered",
    gateMeaning: "Hardening modules and targeted evidence are registered; production drills remain separate release evidence.",
    architectureSections: ["§9", "§17", "§21", "§27", "§28", "§29", "§31", "§58"],
    evidenceModules: [
      "src/platform/five-plane-state-evidence/events/event-registry.ts",
      "src/platform/five-plane-state-evidence/events/dlq-service.ts",
      "src/platform/five-plane-state-evidence/incident/index.ts",
      "src/platform/five-plane-execution/recovery/index.ts",
      "src/platform/five-plane-orchestration/improve-rollout/index.ts",
      "src/platform/five-plane-orchestration/hitl/index.ts",
      "src/platform/shared/observability/index.ts",
    ],
    verificationTests: [
      "tests/unit/platform/five-plane-state-evidence/events/event-registry.test.ts",
      "tests/unit/platform/five-plane-state-evidence/events/dlq-service.test.ts",
      "tests/unit/platform/five-plane-orchestration/improve-rollout/index.test.ts",
      "tests/unit/platform/five-plane-orchestration/hitl/index.test.ts",
    ],
  },
  {
    ringId: "usability",
    status: "evidence_registered",
    gateMeaning: "Usability modules and targeted evidence are registered; pilot-domain production acceptance remains separate release evidence.",
    architectureSections: ["§37", "§38", "§39", "§40", "§41", "§42", "§43", "§44"],
    evidenceModules: [
      "src/interaction/nl-gateway/index.ts",
      "src/interaction/goal-decomposer/index.ts",
      "src/interaction/dashboard/index.ts",
      "src/interaction/autonomy/index.ts",
      "src/domains/domain-descriptor-orchestration-service.ts",
      "src/domains/domain-recipe-service.ts",
    ],
    verificationTests: [
      "tests/unit/platform/five-plane-orchestration/routing/intake-router.test.ts",
      "tests/unit/platform/five-plane-orchestration/planner/task-decomposition-service.test.ts",
      "tests/unit/platform/five-plane-interface/console/hitl.test.ts",
    ],
  },
  {
    ringId: "expansion",
    status: "evidence_registered",
    gateMeaning: "Expansion modules and targeted evidence are registered; multi-region, marketplace, edge, and 24-domain GA remain separate release evidence.",
    architectureSections: ["§46", "§47", "§48", "§49", "§50", "§51", "§52", "§53", "§54", "§55", "§56", "§57", "§59", "§60", "§61", "§62", "§63", "§64", "§65", "§66", "§67", "§68", "§69"],
    evidenceModules: [
      "src/org-governance/index.ts",
      "src/org-governance/sso-scim/index.ts",
      "src/org-governance/knowledge-boundary/index.ts",
      "src/scale-ecosystem/index.ts",
      "src/scale-ecosystem/marketplace/index.ts",
      "src/scale-ecosystem/multi-region/index.ts",
      "src/ops-maturity/index.ts",
      "src/ops-maturity/edge-runtime/index.ts",
      "src/ops-maturity/platform-ops-agent/index.ts",
      "src/domains/index.ts",
    ],
    verificationTests: [
      "tests/unit/platform/platform-module-catalog.test.ts",
      "tests/unit/platform/ai-operations-runtime-catalog.test.ts",
      "tests/unit/platform/five-plane-orchestration/hitl/index.test.ts",
    ],
  },
]);

export function listPlatformSurfaceManifests(): readonly PlatformSurfaceManifest[] {
  return PLATFORM_SURFACE_MANIFESTS;
}

export function resolvePlatformSurfaceManifest(surfaceId: PlatformSurfaceId): PlatformSurfaceManifest {
  const manifest = PLATFORM_SURFACE_MANIFESTS.find((item) => item.surfaceId === surfaceId);
  if (manifest == null) {
    throw new Error(`Unknown platform surface: ${surfaceId}`);
  }
  return manifest;
}

export function registerPlatformSurfaceCatalog(registry: ServiceRegistry = ServiceRegistry.getInstance()): readonly PlatformSurfaceManifest[] {
  registry.register<readonly PlatformSurfaceManifest[]>("platform.surface-catalog", {
    init: () => PLATFORM_SURFACE_MANIFESTS,
  });
  return registry.get<readonly PlatformSurfaceManifest[]>("platform.surface-catalog");
}

export function listArchitectureReadinessRings(): readonly ArchitectureReadinessRing[] {
  return ARCHITECTURE_READINESS_RINGS;
}

export function resolveArchitectureReadinessRing(ringId: ArchitectureReadinessRingId): ArchitectureReadinessRing {
  const ring = ARCHITECTURE_READINESS_RINGS.find((item) => item.ringId === ringId);
  if (ring == null) {
    throw new Error(`Unknown architecture readiness ring: ${ringId}`);
  }
  return ring;
}
