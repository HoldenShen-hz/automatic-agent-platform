import { buildPlatformStartupTargets, listPlatformApps } from "./apps/index.js";
import type {
  PlatformAppKind,
  PlatformAppManifest,
  PlatformArchitectureLayer,
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

export interface PlatformArchitectureBootstrapSummary {
  generatedAt: string;
  startupEntryModule: string;
  architectureDocPath: string;
  layerCount: number;
  appCount: number;
  startupTargetCount: number;
  layers: PlatformLayerManifest[];
  apps: PlatformAppManifest[];
  startupTargets: PlatformStartupTarget[];
}

export interface PlatformArchitectureServices {
  layers: readonly PlatformLayerManifest[];
  apps: readonly PlatformAppManifest[];
  startupTargets: readonly PlatformStartupTarget[];
  summary: PlatformArchitectureBootstrapSummary;
}

export const PLATFORM_LAYER_MANIFESTS: readonly PlatformLayerManifest[] = Object.freeze([
  {
    layerId: "platform",
    entryModule: "src/platform/index.ts",
    description: "五平面运行时核心，承载接口、控制、编排、执行、状态与证据，以及共享能力。",
    architectureSections: ["§5", "§6", "§24", "§29"],
    canonicalSubdomains: ["interface", "control-plane", "orchestration", "execution", "state-evidence", "shared", "prompt-engine", "model-gateway", "compliance"],
  },
  {
    layerId: "domains",
    entryModule: "src/domains/index.ts",
    description: "业务域接入层，负责 DomainDescriptor、DomainRiskProfile、DomainRecipe 和域治理。",
    architectureSections: ["§37", "§38"],
    canonicalSubdomains: ["business-pack", "registry", "risk-profile", "knowledge-schema", "eval-framework", "prompt-library", "recipes", "governance", "roadmap"],
  },
  {
    layerId: "interaction",
    entryModule: "src/interaction/index.ts",
    description: "智能交互层，承载 NL 入口、目标分解、主动式 Agent、自主权和 UX。",
    architectureSections: ["§39", "§44"],
    canonicalSubdomains: ["nl-gateway", "goal-decomposer", "proactive-agent", "autonomy", "dashboard", "ux"],
  },
  {
    layerId: "org-governance",
    entryModule: "src/org-governance/index.ts",
    description: "组织治理层，承载组织模型、审批路由、SSO/SCIM、知识边界与治理委托。",
    architectureSections: ["§46", "§51"],
    canonicalSubdomains: ["org-model", "approval-routing", "sso-scim", "compliance-engine", "knowledge-boundary", "delegated-governance"],
  },
  {
    layerId: "scale-ecosystem",
    entryModule: "src/scale-ecosystem/index.ts",
    description: "规模化运行层与生态层，承载多 Region、资源竞争、Marketplace、Connector 和反馈闭环。",
    architectureSections: ["§52", "§57"],
    canonicalSubdomains: ["multi-region", "resource-manager", "sla-engine", "marketplace", "feedback-loop", "integration"],
  },
  {
    layerId: "ops-maturity",
    entryModule: "src/ops-maturity/index.ts",
    description: "运营成熟度层，承载可解释性、紧急制动、生命周期、边缘运行、漂移检测、调试与平台自运维。",
    architectureSections: ["§59", "§69"],
    canonicalSubdomains: ["agent-lifecycle", "capacity-planner", "chaos", "drift-detection", "edge-runtime", "emergency", "explainability", "monitoring", "multimodal", "platform-ops-agent", "workflow-debugger"],
  },
  {
    layerId: "plugins",
    entryModule: "src/plugins/index.ts",
    description: "跨层插件生态，提供 adapter / planner / presenter / retriever / validator SPI。",
    architectureSections: ["§22", "§55", "§88"],
    canonicalSubdomains: ["adapters", "planners", "presenters", "retrievers", "validators"],
  },
  {
    layerId: "sdk",
    entryModule: "src/sdk/index.ts",
    description: "开发者工具链与 CLI/SDK，支撑 pack/plugin/client/workbench 的开发体验。",
    architectureSections: ["§22", "§35"],
    canonicalSubdomains: ["cli", "client-sdk", "pack-sdk", "plugin-sdk", "workbench"],
  },
  {
    layerId: "apps",
    entryModule: "src/apps/index.ts",
    description: "应用入口编排层，负责 API、Console、Worker 的启动装配与清单暴露。",
    architectureSections: ["§35"],
    canonicalSubdomains: ["api", "console", "workers"],
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
  const apps = [...listPlatformApps()];
  const startupTargets = [...buildPlatformStartupTargets()];
  return {
    generatedAt: new Date().toISOString(),
    startupEntryModule: "src/index.ts",
    architectureDocPath: "docs_zh/architecture/00-platform-architecture.md",
    layerCount: layers.length,
    appCount: apps.length,
    startupTargetCount: startupTargets.length,
    layers,
    apps,
    startupTargets,
  };
}

export function registerPlatformArchitectureServices(registry: ServiceRegistry = ServiceRegistry.getInstance()): PlatformArchitectureServices {
  registry.register<readonly PlatformLayerManifest[]>("architecture.layer-catalog", {
    init: () => PLATFORM_LAYER_MANIFESTS,
  });
  registry.register<readonly PlatformAppManifest[]>("architecture.app-catalog", {
    init: () => Object.freeze([...listPlatformApps()]),
  });
  registry.register<readonly PlatformStartupTarget[]>("architecture.startup-targets", {
    init: () => Object.freeze([...buildPlatformStartupTargets()]),
  });
  registry.register<PlatformArchitectureBootstrapSummary>("architecture.bootstrap-summary", {
    init: () => buildPlatformArchitectureBootstrapSummary(),
    dependsOn: ["architecture.layer-catalog", "architecture.app-catalog", "architecture.startup-targets"],
  });

  const layers = registry.get<readonly PlatformLayerManifest[]>("architecture.layer-catalog");
  const apps = registry.get<readonly PlatformAppManifest[]>("architecture.app-catalog");
  const startupTargets = registry.get<readonly PlatformStartupTarget[]>("architecture.startup-targets");
  const summary = registry.get<PlatformArchitectureBootstrapSummary>("architecture.bootstrap-summary");
  return { layers, apps, startupTargets, summary };
}

export function getPlatformArchitectureServices(registry: ServiceRegistry = ServiceRegistry.getInstance()): PlatformArchitectureServices {
  return registerPlatformArchitectureServices(registry);
}
