import { type PlatformLayerManifest, listPlatformLayerManifests } from "./platform-architecture-bootstrap.js";
import {
  buildPlatformStartupTargets,
  listPlatformApps,
  resolvePlatformStartupTarget,
} from "./apps/index.js";
import {
  buildInteractionGovernanceRuntimeCatalog,
  type InteractionGovernanceRuntimeCatalog,
} from "./interaction-governance-runtime-catalog.js";
import {
  buildInteractionGovernanceStartupPlan,
  type InteractionGovernanceStartupPlan,
} from "./interaction-governance-startup-plan.js";
import { buildAiOperationsRuntimeCatalog, type AiOperationsRuntimeCatalog } from "./platform/ai-operations-runtime-catalog.js";
import { buildAiOperationsStartupPlan, type AiOperationsStartupPlan } from "./platform/ai-operations-startup-plan.js";
import { buildFivePlaneStartupPlan, type FivePlaneStartupPlan } from "./platform/five-plane-startup-plan.js";
import type {
  PlatformAppKind,
  PlatformAppManifest,
  PlatformArchitectureLayer,
  PlatformStartupTarget,
  PlatformStartupTargetKind,
} from "./platform-architecture-types.js";
import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";

export interface PlatformStartupPlan {
  target: PlatformStartupTarget;
  startupEntryModule: string;
  selectedApp: PlatformAppManifest | null;
  requiredLayerManifests: PlatformLayerManifest[];
  planeStartupPlan: FivePlaneStartupPlan | null;
  aiOperationsStartupPlan: AiOperationsStartupPlan | null;
  aiOperationsRuntimeCatalog: AiOperationsRuntimeCatalog | null;
  interactionGovernanceStartupPlan: InteractionGovernanceStartupPlan | null;
  interactionGovernanceRuntimeCatalog: InteractionGovernanceRuntimeCatalog | null;
}

export interface PlatformApplicationKernelSnapshot {
  generatedAt: string;
  layerCount: number;
  appCount: number;
  startupTargetCount: number;
  apps: PlatformAppManifest[];
  startupTargets: PlatformStartupTarget[];
}

export class PlatformApplicationKernel {
  public listLayers(): readonly PlatformLayerManifest[] {
    return listPlatformLayerManifests();
  }

  public listApps(): readonly PlatformAppManifest[] {
    return listPlatformApps();
  }

  public listStartupTargets(): readonly PlatformStartupTarget[] {
    return buildPlatformStartupTargets();
  }

  public getApp(kind: PlatformAppKind): PlatformAppManifest {
    const app = listPlatformApps().find((item) => item.kind === kind);
    if (app == null) {
      throw new Error(`Unknown platform app kind: ${kind}`);
    }
    return app;
  }

  public buildStartupPlan(targetKind: PlatformStartupTargetKind): PlatformStartupPlan {
    const target = resolvePlatformStartupTarget(targetKind);
    const requiredLayers = new Set<PlatformArchitectureLayer>(target.requiredLayers);
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
      planeStartupPlan: requiredLayers.has("platform") ? buildFivePlaneStartupPlan() : null,
      aiOperationsStartupPlan: requiredLayers.has("platform") ? buildAiOperationsStartupPlan() : null,
      aiOperationsRuntimeCatalog: requiredLayers.has("platform") ? buildAiOperationsRuntimeCatalog() : null,
      interactionGovernanceStartupPlan:
        requiredLayers.has("interaction") || requiredLayers.has("org-governance")
          ? buildInteractionGovernanceStartupPlan()
          : null,
      interactionGovernanceRuntimeCatalog:
        requiredLayers.has("interaction") || requiredLayers.has("org-governance")
          ? buildInteractionGovernanceRuntimeCatalog()
          : null,
    };
  }

  public buildSnapshot(): PlatformApplicationKernelSnapshot {
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

export function registerPlatformApplicationKernel(registry: ServiceRegistry = ServiceRegistry.getInstance()): PlatformApplicationKernel {
  registry.register<PlatformApplicationKernel>("architecture.application-kernel", {
    init: () => new PlatformApplicationKernel(),
  });
  return registry.get<PlatformApplicationKernel>("architecture.application-kernel");
}

export function getPlatformApplicationKernel(registry: ServiceRegistry = ServiceRegistry.getInstance()): PlatformApplicationKernel {
  if (!registry.isInitialized("architecture.application-kernel")) {
    return registerPlatformApplicationKernel(registry);
  }
  return registry.get<PlatformApplicationKernel>("architecture.application-kernel");
}
