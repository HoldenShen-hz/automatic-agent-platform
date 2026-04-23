import { buildDomainsRuntimeCatalog } from "./domains-runtime-catalog.js";
import { buildDomainsStartupPlan } from "./domains-startup-plan.js";
import { listPlatformLayerManifests } from "./platform-architecture-bootstrap.js";
import { buildPlatformStartupTargets, listPlatformApps, resolvePlatformStartupTarget, } from "./apps/index.js";
import { buildInteractionGovernanceRuntimeCatalog, } from "./interaction-governance-runtime-catalog.js";
import { buildInteractionGovernanceStartupPlan, } from "./interaction-governance-startup-plan.js";
import { buildAiOperationsRuntimeCatalog } from "./platform/ai-operations-runtime-catalog.js";
import { buildAiOperationsStartupPlan } from "./platform/ai-operations-startup-plan.js";
import { buildFivePlaneStartupPlan } from "./platform/five-plane-startup-plan.js";
import { buildScaleOpsRuntimeCatalog } from "./scale-ops-runtime-catalog.js";
import { buildScaleOpsStartupPlan } from "./scale-ops-startup-plan.js";
import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
export class PlatformApplicationKernel {
    listLayers() {
        return listPlatformLayerManifests();
    }
    listApps() {
        return listPlatformApps();
    }
    listStartupTargets() {
        return buildPlatformStartupTargets();
    }
    getApp(kind) {
        const app = listPlatformApps().find((item) => item.kind === kind);
        if (app == null) {
            throw new Error(`Unknown platform app kind: ${kind}`);
        }
        return app;
    }
    buildStartupPlan(targetKind) {
        const target = resolvePlatformStartupTarget(targetKind);
        const requiredLayers = new Set(target.requiredLayers);
        if (target.appManifest != null) {
            for (const layer of target.appManifest.requiredLayers) {
                requiredLayers.add(layer);
            }
        }
        const requiredLayerManifests = listPlatformLayerManifests().filter((layer) => requiredLayers.has(layer.layerId));
        return {
            target,
            startupEntryModule: target.rootEntryModule,
            selectedApp: target.appManifest,
            requiredLayerManifests,
            domainsStartupPlan: requiredLayers.has("domains") ? buildDomainsStartupPlan() : null,
            domainsRuntimeCatalog: requiredLayers.has("domains") ? buildDomainsRuntimeCatalog() : null,
            planeStartupPlan: requiredLayers.has("platform") ? buildFivePlaneStartupPlan() : null,
            aiOperationsStartupPlan: requiredLayers.has("platform") ? buildAiOperationsStartupPlan() : null,
            aiOperationsRuntimeCatalog: requiredLayers.has("platform") ? buildAiOperationsRuntimeCatalog() : null,
            interactionGovernanceStartupPlan: requiredLayers.has("interaction") || requiredLayers.has("org-governance")
                ? buildInteractionGovernanceStartupPlan()
                : null,
            interactionGovernanceRuntimeCatalog: requiredLayers.has("interaction") || requiredLayers.has("org-governance")
                ? buildInteractionGovernanceRuntimeCatalog()
                : null,
            scaleOpsStartupPlan: requiredLayers.has("scale-ecosystem") || requiredLayers.has("ops-maturity")
                ? buildScaleOpsStartupPlan()
                : null,
            scaleOpsRuntimeCatalog: requiredLayers.has("scale-ecosystem") || requiredLayers.has("ops-maturity")
                ? buildScaleOpsRuntimeCatalog()
                : null,
        };
    }
    buildSnapshot() {
        const apps = [...this.listApps()];
        const startupTargets = [...this.listStartupTargets()];
        return {
            generatedAt: new Date().toISOString(),
            layerCount: this.listLayers().length,
            appCount: apps.length,
            startupTargetCount: startupTargets.length,
            apps,
            startupTargets,
        };
    }
}
export function registerPlatformApplicationKernel(registry = ServiceRegistry.getInstance()) {
    registry.register("architecture.application-kernel", {
        init: () => new PlatformApplicationKernel(),
    });
    return registry.get("architecture.application-kernel");
}
export function getPlatformApplicationKernel(registry = ServiceRegistry.getInstance()) {
    if (!registry.isInitialized("architecture.application-kernel")) {
        return registerPlatformApplicationKernel(registry);
    }
    return registry.get("architecture.application-kernel");
}
//# sourceMappingURL=platform-application-kernel.js.map