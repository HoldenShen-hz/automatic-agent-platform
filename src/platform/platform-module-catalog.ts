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
    description: "平面间契约层，集中暴露 request/result/control/state/evidence 等跨面协议。",
    architectureSections: ["§5"],
    canonicalSubdomains: ["request-envelope", "result-envelope", "control-directive", "execution-plan", "execution-receipt", "state-command"],
  },
  {
    surfaceId: "interface",
    entryModule: "src/platform/interface/index.ts",
    description: "P1 Interface Plane，承载 API、Webhook、Scheduler、Console Backend 与 Ingress。",
    architectureSections: ["§4", "§6", "§7"],
    canonicalSubdomains: ["api", "channel-gateway", "console-backend", "ingress", "scheduler", "webhook"],
  },
  {
    surfaceId: "control-plane",
    entryModule: "src/platform/control-plane/index.ts",
    description: "P2 Control Plane，承载配置、审批、策略、事故控制、IAM 与租户边界。",
    architectureSections: ["§10", "§11", "§12", "§24"],
    canonicalSubdomains: ["approval-center", "config-center", "iam", "incident-control", "policy-center", "risk-control", "rollout-controller", "tenant"],
  },
  {
    surfaceId: "orchestration",
    entryModule: "src/platform/orchestration/index.ts",
    description: "P3 Orchestration Plane，承载 OAPEFLIR、Planner、Routing、HITL、Replan 与委托协作。",
    architectureSections: ["§13", "§19", "§21", "§45"],
    canonicalSubdomains: ["agent-delegation", "escalation", "harness", "hitl", "oapeflir", "planner", "replan", "routing"],
  },
  {
    surfaceId: "execution",
    entryModule: "src/platform/execution/index.ts",
    description: "P4 Execution Plane，承载 dispatcher、worker、lease、queue、tool execution 与 recovery。",
    architectureSections: ["§14", "§31"],
    canonicalSubdomains: ["dispatcher", "distributed-lock", "execution-engine", "ha", "lease", "queue", "recovery", "resource", "state-transition", "tool-executor", "worker-pool"],
  },
  {
    surfaceId: "state-evidence",
    entryModule: "src/platform/state-evidence/index.ts",
    description: "P5 State & Evidence Plane，承载 truth、events、projection、artifact、audit、memory、knowledge。",
    architectureSections: ["§25", "§26", "§28", "§29"],
    canonicalSubdomains: ["artifacts", "audit", "checkpoints", "dlq", "events", "incident", "knowledge", "memory", "projections", "truth"],
  },
  {
    surfaceId: "model-gateway",
    entryModule: "src/platform/model-gateway/index.ts",
    description: "AI 运营层的模型网关面，承载 provider registry、router、fallback、degradation、cost tracking。",
    architectureSections: ["§15", "§18"],
    canonicalSubdomains: ["cache", "cost-tracker", "degradation", "fallback", "messages", "provider-registry", "router"],
  },
  {
    surfaceId: "prompt-engine",
    entryModule: "src/platform/prompt-engine/index.ts",
    description: "AI 运营层的 Prompt 面，承载 registry、renderer、rollout 与 eval。",
    architectureSections: ["§16", "§17"],
    canonicalSubdomains: ["eval", "registry", "renderer", "rollout"],
  },
  {
    surfaceId: "shared",
    entryModule: "src/platform/shared/index.ts",
    description: "横切共享面，承载 cache、context、lifecycle、observability、outbox、stability。",
    architectureSections: ["§9", "§27", "§58"],
    canonicalSubdomains: ["cache", "context", "lifecycle", "observability", "outbox", "scaling", "stability", "utils"],
  },
  {
    surfaceId: "compliance",
    entryModule: "src/platform/compliance/index.ts",
    description: "平台合规与数据治理面，承载 erasure、crypto-shredding、residency、lineage。",
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
