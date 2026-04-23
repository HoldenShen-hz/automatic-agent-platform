import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";

export type PlatformSurfaceId =
  | "contracts"
  | "interface"
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
    entryModule: "src/platform/interface/index.ts",
    description: "P1 Interface Plane, hosting API, Webhook, Scheduler, Console Backend and Ingress.",
    architectureSections: ["§4", "§6", "§7"],
    canonicalSubdomains: ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"],
  },
  {
    surfaceId: "control-plane",
    entryModule: "src/platform/control-plane/index.ts",
    description: "P2 Control Plane, hosting configuration, approval, policy, incident control, IAM and tenant boundaries.",
    architectureSections: ["§10", "§11", "§12", "§24"],
    canonicalSubdomains: ["approval-center", "config-center", "iam", "incident-control", "policy-center", "risk-control", "rollout-controller", "tenant"],
  },
  {
    surfaceId: "orchestration",
    entryModule: "src/platform/orchestration/index.ts",
    description: "P3 Orchestration Plane, hosting OAPEFLIR, Planner, Routing, HITL, Replan and delegated collaboration.",
    architectureSections: ["§13", "§19", "§21", "§45"],
    canonicalSubdomains: ["agent-delegation", "escalation", "harness", "hitl", "oapeflir", "planner", "replan", "routing"],
  },
  {
    surfaceId: "execution",
    entryModule: "src/platform/execution/index.ts",
    description: "P4 Execution Plane, hosting dispatcher, worker, lease, queue, tool execution and recovery.",
    architectureSections: ["§14", "§31"],
    canonicalSubdomains: ["dispatcher", "distributed-lock", "execution-engine", "ha", "lease", "queue", "recovery", "resource", "state-transition", "tool-executor", "worker-pool"],
  },
  {
    surfaceId: "state-evidence",
    entryModule: "src/platform/state-evidence/index.ts",
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
