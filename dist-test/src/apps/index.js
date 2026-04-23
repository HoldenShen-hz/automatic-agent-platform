export * from "./api/index.js";
export * from "./console/index.js";
export * from "./workers/index.js";
import { API_APP_MANIFEST } from "./api/index.js";
import { CONSOLE_APP_MANIFEST } from "./console/index.js";
import { WORKER_APP_MANIFEST } from "./workers/index.js";
const PLATFORM_APPS = Object.freeze([API_APP_MANIFEST, CONSOLE_APP_MANIFEST, WORKER_APP_MANIFEST]);
export function listPlatformApps() {
    return PLATFORM_APPS;
}
export function listPlatformAppKinds() {
    return PLATFORM_APPS.map((app) => app.kind);
}
export function getPlatformAppManifestByKind(kind) {
    const manifest = PLATFORM_APPS.find((app) => app.kind === kind);
    if (manifest == null) {
        throw new Error(`Unknown platform app kind: ${kind}`);
    }
    return manifest;
}
export function resolvePlatformAppManifest(selector) {
    return PLATFORM_APPS.find((app) => app.kind === selector || app.appId === selector) ?? null;
}
export function buildPlatformStartupTargets() {
    return [
        {
            targetKind: "summary",
            rootEntryModule: "src/index.ts",
            description: "Output system skeleton, seven-layer module, and application manifest summary.",
            requiredLayers: [],
            startupCommand: "npm run start",
            appManifest: null,
        },
        {
            targetKind: "demo",
            rootEntryModule: "src/index.ts",
            description: "Run single-task happy-path demo for minimal execution path validation.",
            requiredLayers: ["platform", "apps"],
            startupCommand: "npm run demo",
            appManifest: null,
        },
        ...PLATFORM_APPS.map((appManifest) => ({
            targetKind: appManifest.kind,
            rootEntryModule: "src/index.ts",
            description: `Start ${appManifest.kind} application surface per architecture target.`,
            requiredLayers: [...appManifest.requiredLayers],
            startupCommand: appManifest.startupCommand,
            appManifest,
        })),
    ];
}
export function resolvePlatformStartupTarget(targetKind) {
    const target = buildPlatformStartupTargets().find((item) => item.targetKind === targetKind);
    if (target == null) {
        throw new Error(`Unknown platform startup target: ${targetKind}`);
    }
    return target;
}
//# sourceMappingURL=index.js.map