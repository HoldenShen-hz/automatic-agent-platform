import type { PlatformAppKind, PlatformAppManifest, PlatformArchitectureLayer, PlatformStartupTarget } from "./platform-architecture-types.js";
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
export declare const PLATFORM_LAYER_MANIFESTS: readonly PlatformLayerManifest[];
export declare function listPlatformLayerManifests(): readonly PlatformLayerManifest[];
export declare function listPlatformAppsByKind(kind: PlatformAppKind): readonly PlatformAppManifest[];
export declare function buildPlatformArchitectureBootstrapSummary(): PlatformArchitectureBootstrapSummary;
export declare function registerPlatformArchitectureServices(registry?: ServiceRegistry): PlatformArchitectureServices;
export declare function getPlatformArchitectureServices(registry?: ServiceRegistry): PlatformArchitectureServices;
