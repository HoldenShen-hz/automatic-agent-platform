import { buildPlatformStartupTargets, listPlatformApps } from "./apps/index.js";
import type {
  PlatformAppKind,
  PlatformAppManifest,
  PlatformArchitectureLayer,
  PlatformPlane,
  PlatformStartupTarget,
} from "./platform-architecture-types.js";
import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";

export interface PlatformLayerManifest {
  layerId: PlatformArchitectureLayer;
  entryModule: string;
  description: string;
  architectureSections: string[];
  canonicalSubdomains: string[];
}

export interface PlatformPlaneManifest {
  planeId: PlatformPlane;
  surfaceIds: string[];
  description: string;
  architectureSections: string[];
}

export interface PlatformArchitectureBootstrapSummary {
  generatedAt: string;
  startupEntryModule: string;
  architectureDocPath: string;
  layerCount: number;
  planeCount: number;
  appCount: number;
  startupTargetCount: number;
  layers: PlatformLayerManifest[];
  planes: PlatformPlaneManifest[];
  apps: PlatformAppManifest[];
  startupTargets: PlatformStartupTarget[];
}

export interface PlatformArchitectureServices {
  layers: readonly PlatformLayerManifest[];
  planes: readonly PlatformPlaneManifest[];
  apps: readonly PlatformAppManifest[];
  startupTargets: readonly PlatformStartupTarget[];
  summary: PlatformArchitectureBootstrapSummary;
}

const registeredArchitectureCatalogs = new WeakSet<ServiceRegistry>();

export const PLATFORM_LAYER_MANIFESTS: readonly PlatformLayerManifest[] = Object.freeze([
  {
    layerId: "platform",
    entryModule: "src/platform/index.ts",
    description: "Five-plane runtime core, hosting interface, control, orchestration, execution, state & evidence, and shared capabilities.",
    architectureSections: ["§5", "§6", "§24", "§29"],
    canonicalSubdomains: ["interface", "control-plane", "orchestration", "execution", "state-evidence", "shared", "prompt-engine", "model-gateway", "compliance"],
  },
  {
    layerId: "domains",
    entryModule: "src/domains/index.ts",
    description: "Business domain access layer, responsible for DomainDescriptor, DomainRiskProfile, DomainRecipe and domain governance.",
    architectureSections: ["§37", "§38"],
    canonicalSubdomains: ["business-pack", "registry", "risk-profile", "knowledge-schema", "eval-framework", "prompt-library", "recipes", "governance", "roadmap"],
  },
  {
    layerId: "interaction",
    entryModule: "src/interaction/index.ts",
    description: "Intelligent interaction layer, hosting NL entry, goal decomposition, proactive agent, autonomy, and UX.",
    architectureSections: ["§39", "§44"],
    canonicalSubdomains: ["nl-gateway", "goal-decomposer", "proactive-agent", "autonomy", "dashboard", "ux"],
  },
  {
    layerId: "org-governance",
    entryModule: "src/org-governance/index.ts",
    description: "Organization governance layer, hosting org model, approval routing, SSO/SCIM, knowledge boundary and governance delegation.",
    architectureSections: ["§46", "§51"],
    canonicalSubdomains: ["org-model", "approval-routing", "sso-scim", "compliance-engine", "knowledge-boundary", "delegated-governance"],
  },
  {
    layerId: "scale-ecosystem",
    entryModule: "src/scale-ecosystem/index.ts",
    description: "Scale-out runtime and ecosystem layer, hosting multi-region, resource competition, marketplace, connector, and feedback loop.",
    architectureSections: ["§52", "§57"],
    canonicalSubdomains: ["multi-region", "resource-manager", "sla-engine", "marketplace", "feedback-loop", "integration"],
  },
  {
    layerId: "ops-maturity",
    entryModule: "src/ops-maturity/index.ts",
    description: "Operations maturity layer, hosting explainability, emergency brake, lifecycle, edge runtime, drift detection, debugging, and platform self-operation.",
    architectureSections: ["§59", "§69"],
    canonicalSubdomains: ["agent-lifecycle", "capacity-planner", "chaos", "drift-detection", "edge-runtime", "emergency", "explainability", "monitoring", "multimodal", "platform-ops-agent", "workflow-debugger"],
  },
  {
    layerId: "plugins",
    entryModule: "src/plugins/index.ts",
    description: "Cross-layer plugin ecosystem, providing adapter/planner/presenter/retriever/validator SPI.",
    architectureSections: ["§22", "§55", "§88"],
    canonicalSubdomains: ["adapters", "planners", "presenters", "retrievers", "validators"],
  },
  {
    layerId: "sdk",
    entryModule: "src/sdk/index.ts",
    description: "Developer toolchain and CLI/SDK, supporting pack/plugin/client/workbench development experience.",
    architectureSections: ["§22", "§35"],
    canonicalSubdomains: ["cli", "client-sdk", "pack-sdk", "plugin-sdk", "workbench"],
  },
  {
    layerId: "apps",
    entryModule: "src/apps/index.ts",
    description: "Application entry orchestration layer, responsible for API, Console, Worker startup assembly and manifest exposure.",
    architectureSections: ["§35"],
    canonicalSubdomains: ["api", "console", "workers"],
  },
]);

export const PLATFORM_PLANE_MANIFESTS: readonly PlatformPlaneManifest[] = Object.freeze([
  {
    planeId: "P1",
    surfaceIds: ["interface"],
    description: "P1 interface plane.",
    architectureSections: ["§4", "§6", "§7"],
  },
  {
    planeId: "X1",
    surfaceIds: ["x1-fabric", "shared", "model-gateway", "prompt-engine", "compliance"],
    description: "X1 cross-cutting reliability, observability, compliance, and AI governance fabric.",
    architectureSections: ["§4.7", "§9", "§15", "§16", "§17", "§23", "§27", "§58"],
  },
  {
    planeId: "P2",
    surfaceIds: ["control-plane"],
    description: "P2 control plane.",
    architectureSections: ["§10", "§11", "§12", "§24"],
  },
  {
    planeId: "P3",
    surfaceIds: ["orchestration"],
    description: "P3 orchestration plane.",
    architectureSections: ["§13", "§19", "§21", "§45"],
  },
  {
    planeId: "P4",
    surfaceIds: ["execution"],
    description: "P4 execution plane.",
    architectureSections: ["§14", "§31"],
  },
  {
    planeId: "P5",
    surfaceIds: ["state-evidence"],
    description: "P5 state and evidence plane.",
    architectureSections: ["§25", "§26", "§28", "§29"],
  },
]);

export function listPlatformLayerManifests(): readonly PlatformLayerManifest[] {
  return PLATFORM_LAYER_MANIFESTS;
}

export function listPlatformAppsByKind(kind: PlatformAppKind): readonly PlatformAppManifest[] {
  return listPlatformApps().filter((app) => app.kind === kind);
}

export function buildPlatformArchitectureBootstrapSummary(): PlatformArchitectureBootstrapSummary {
  const layers = [...listPlatformLayerManifests()];
  const planes = [...PLATFORM_PLANE_MANIFESTS];
  const apps = [...listPlatformApps()];
  const startupTargets = [...buildPlatformStartupTargets()];
  return {
    generatedAt: new Date().toISOString(),
    startupEntryModule: "src/index.ts",
    architectureDocPath: "docs_zh/architecture/00-platform-architecture.md",
    layerCount: layers.length,
    planeCount: planes.length,
    appCount: apps.length,
    startupTargetCount: startupTargets.length,
    layers,
    planes,
    apps,
    startupTargets,
  };
}

export function assertStartupOrderEnforced(startupTargets: readonly PlatformStartupTarget[] = buildPlatformStartupTargets()): void {
  const seen = new Set<PlatformStartupTarget["targetKind"]>();
  for (const target of startupTargets) {
    if (seen.has(target.targetKind)) {
      throw new Error(`Duplicate startup target kind: ${target.targetKind}`);
    }
    seen.add(target.targetKind);
  }
}

export function registerPlatformArchitectureServices(registry: ServiceRegistry = ServiceRegistry.createScoped()): PlatformArchitectureServices {
  if (!registeredArchitectureCatalogs.has(registry)) {
    registry.register<readonly PlatformLayerManifest[]>("architecture.layer-catalog", {
      init: () => PLATFORM_LAYER_MANIFESTS,
    });
    registry.register<readonly PlatformPlaneManifest[]>("architecture.plane-catalog", {
      init: () => PLATFORM_PLANE_MANIFESTS,
    });
    registry.register<readonly PlatformAppManifest[]>("architecture.app-catalog", {
      init: () => Object.freeze([...listPlatformApps()]),
    });
    registry.register<readonly PlatformStartupTarget[]>("architecture.startup-targets", {
      init: () => Object.freeze([...buildPlatformStartupTargets()]),
    });
    registry.register<PlatformArchitectureBootstrapSummary>("architecture.bootstrap-summary", {
      init: () => buildPlatformArchitectureBootstrapSummary(),
      dependsOn: ["architecture.layer-catalog", "architecture.plane-catalog", "architecture.app-catalog", "architecture.startup-targets"],
    });
    registeredArchitectureCatalogs.add(registry);
  }

  // Ensure all services are fully initialized before returning to avoid
  // returning uninitialized data when get() is called immediately after register().
  const readinessGates = [
    "architecture.layer-catalog",
    "architecture.plane-catalog",
    "architecture.app-catalog",
    "architecture.startup-targets",
    "architecture.bootstrap-summary",
  ];
  for (const gate of readinessGates) {
    if (!registry.isInitialized(gate)) {
      registry.get(gate);
    }
  }

  return {
    layers: registry.get<readonly PlatformLayerManifest[]>("architecture.layer-catalog"),
    planes: registry.get<readonly PlatformPlaneManifest[]>("architecture.plane-catalog"),
    apps: registry.get<readonly PlatformAppManifest[]>("architecture.app-catalog"),
    startupTargets: registry.get<readonly PlatformStartupTarget[]>("architecture.startup-targets"),
    summary: registry.get<PlatformArchitectureBootstrapSummary>("architecture.bootstrap-summary"),
  };
}

export function getPlatformArchitectureServices(registry: ServiceRegistry = ServiceRegistry.createScoped()): PlatformArchitectureServices {
  if (!registeredArchitectureCatalogs.has(registry)) {
    registerPlatformArchitectureServices(registry);
  }

  // Ensure all services are fully initialized before returning to avoid
  // returning uninitialized data when get() is called immediately after register().
  const readinessGates = [
    "architecture.layer-catalog",
    "architecture.plane-catalog",
    "architecture.app-catalog",
    "architecture.startup-targets",
    "architecture.bootstrap-summary",
  ];
  for (const gate of readinessGates) {
    if (!registry.isInitialized(gate)) {
      registry.get(gate);
    }
  }

  // Return services from the registry to ensure idempotent results.
  // All services are frozen/immutable at registration time, so fetching
  // from the registry prevents returning new object instances on repeated calls.
  return {
    layers: registry.get<readonly PlatformLayerManifest[]>("architecture.layer-catalog"),
    planes: registry.get<readonly PlatformPlaneManifest[]>("architecture.plane-catalog"),
    apps: registry.get<readonly PlatformAppManifest[]>("architecture.app-catalog"),
    startupTargets: registry.get<readonly PlatformStartupTarget[]>("architecture.startup-targets"),
    summary: registry.get<PlatformArchitectureBootstrapSummary>("architecture.bootstrap-summary"),
  };
}
