import { type DomainsRuntimeCatalog } from "./domains-runtime-catalog.js";
import { type DomainsStartupPlan } from "./domains-startup-plan.js";
import { type PlatformLayerManifest } from "./platform-architecture-bootstrap.js";
import { type InteractionGovernanceRuntimeCatalog } from "./interaction-governance-runtime-catalog.js";
import { type InteractionGovernanceStartupPlan } from "./interaction-governance-startup-plan.js";
import { type AiOperationsRuntimeCatalog } from "./platform/ai-operations-runtime-catalog.js";
import { type AiOperationsStartupPlan } from "./platform/ai-operations-startup-plan.js";
import { type FivePlaneStartupPlan } from "./platform/five-plane-startup-plan.js";
import { type ScaleOpsRuntimeCatalog } from "./scale-ops-runtime-catalog.js";
import { type ScaleOpsStartupPlan } from "./scale-ops-startup-plan.js";
import type { PlatformAppKind, PlatformAppManifest, PlatformStartupTarget, PlatformStartupTargetKind } from "./platform-architecture-types.js";
import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
export interface PlatformStartupPlan {
    target: PlatformStartupTarget;
    startupEntryModule: string;
    selectedApp: PlatformAppManifest | null;
    requiredLayerManifests: PlatformLayerManifest[];
    domainsStartupPlan: DomainsStartupPlan | null;
    domainsRuntimeCatalog: DomainsRuntimeCatalog | null;
    planeStartupPlan: FivePlaneStartupPlan | null;
    aiOperationsStartupPlan: AiOperationsStartupPlan | null;
    aiOperationsRuntimeCatalog: AiOperationsRuntimeCatalog | null;
    interactionGovernanceStartupPlan: InteractionGovernanceStartupPlan | null;
    interactionGovernanceRuntimeCatalog: InteractionGovernanceRuntimeCatalog | null;
    scaleOpsStartupPlan: ScaleOpsStartupPlan | null;
    scaleOpsRuntimeCatalog: ScaleOpsRuntimeCatalog | null;
}
export interface PlatformApplicationKernelSnapshot {
    generatedAt: string;
    layerCount: number;
    appCount: number;
    startupTargetCount: number;
    apps: PlatformAppManifest[];
    startupTargets: PlatformStartupTarget[];
}
export declare class PlatformApplicationKernel {
    listLayers(): readonly PlatformLayerManifest[];
    listApps(): readonly PlatformAppManifest[];
    listStartupTargets(): readonly PlatformStartupTarget[];
    getApp(kind: PlatformAppKind): PlatformAppManifest;
    buildStartupPlan(targetKind: PlatformStartupTargetKind): PlatformStartupPlan;
    buildSnapshot(): PlatformApplicationKernelSnapshot;
}
export declare function registerPlatformApplicationKernel(registry?: ServiceRegistry): PlatformApplicationKernel;
export declare function getPlatformApplicationKernel(registry?: ServiceRegistry): PlatformApplicationKernel;
