import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
export type PlatformSurfaceId = "contracts" | "interface" | "control-plane" | "orchestration" | "execution" | "state-evidence" | "model-gateway" | "prompt-engine" | "shared" | "compliance";
export interface PlatformSurfaceManifest {
    surfaceId: PlatformSurfaceId;
    entryModule: string;
    description: string;
    architectureSections: string[];
    canonicalSubdomains: string[];
}
export declare const PLATFORM_SURFACE_MANIFESTS: readonly PlatformSurfaceManifest[];
export declare function listPlatformSurfaceManifests(): readonly PlatformSurfaceManifest[];
export declare function resolvePlatformSurfaceManifest(surfaceId: PlatformSurfaceId): PlatformSurfaceManifest;
export declare function registerPlatformSurfaceCatalog(registry?: ServiceRegistry): readonly PlatformSurfaceManifest[];
