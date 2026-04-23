import { buildPlatformStartupTargets, listPlatformApps } from "./apps/index.js";
import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
export const PLATFORM_LAYER_MANIFESTS = Object.freeze([
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
export function listPlatformLayerManifests() {
    return PLATFORM_LAYER_MANIFESTS;
}
export function listPlatformAppsByKind(kind) {
    return listPlatformApps().filter((app) => app.kind === kind);
}
export function buildPlatformArchitectureBootstrapSummary() {
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
export function registerPlatformArchitectureServices(registry = ServiceRegistry.getInstance()) {
    registry.register("architecture.layer-catalog", {
        init: () => PLATFORM_LAYER_MANIFESTS,
    });
    registry.register("architecture.app-catalog", {
        init: () => Object.freeze([...listPlatformApps()]),
    });
    registry.register("architecture.startup-targets", {
        init: () => Object.freeze([...buildPlatformStartupTargets()]),
    });
    registry.register("architecture.bootstrap-summary", {
        init: () => buildPlatformArchitectureBootstrapSummary(),
        dependsOn: ["architecture.layer-catalog", "architecture.app-catalog", "architecture.startup-targets"],
    });
    const layers = registry.get("architecture.layer-catalog");
    const apps = registry.get("architecture.app-catalog");
    const startupTargets = registry.get("architecture.startup-targets");
    const summary = registry.get("architecture.bootstrap-summary");
    return { layers, apps, startupTargets, summary };
}
export function getPlatformArchitectureServices(registry = ServiceRegistry.getInstance()) {
    return registerPlatformArchitectureServices(registry);
}
//# sourceMappingURL=platform-architecture-bootstrap.js.map