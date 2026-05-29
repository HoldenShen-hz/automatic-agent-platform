export * from "./api/index.js";
export * from "./console/index.js";
export * from "./workers/index.js";
export type { PlatformAppManifest } from "../platform-architecture-types.js";

import { API_APP_MANIFEST } from "./api/index.js";
import { CONSOLE_APP_MANIFEST } from "./console/index.js";
import { WORKER_APP_MANIFEST } from "./workers/index.js";
import type {
  PlatformAppKind,
  PlatformAppManifest,
  PlatformStartupTarget,
  PlatformStartupTargetKind,
} from "../platform-architecture-types.js";

function freezeStringArray<T extends string>(values: readonly T[]): T[] {
  return Object.freeze([...values]) as T[];
}

function freezePlatformAppManifest(manifest: PlatformAppManifest): PlatformAppManifest {
  return Object.freeze({
    ...manifest,
    capabilities: freezeStringArray(manifest.capabilities),
    requiredLayers: freezeStringArray(manifest.requiredLayers),
  }) as PlatformAppManifest;
}

function freezePlatformStartupTarget(target: PlatformStartupTarget): PlatformStartupTarget {
  return Object.freeze({
    ...target,
    requiredLayers: freezeStringArray(target.requiredLayers),
  }) as PlatformStartupTarget;
}

const PLATFORM_APPS = Object.freeze([
  freezePlatformAppManifest(API_APP_MANIFEST),
  freezePlatformAppManifest(CONSOLE_APP_MANIFEST),
  freezePlatformAppManifest(WORKER_APP_MANIFEST),
] satisfies PlatformAppManifest[]);

const PLATFORM_STARTUP_TARGETS = Object.freeze([
  freezePlatformStartupTarget({
    targetKind: "summary",
    rootEntryModule: "src/index.ts",
    description: "Output system skeleton, seven-layer module, and application manifest summary.",
    requiredLayers: [],
    startupCommand: "npm run start",
    appManifest: null,
  }),
  freezePlatformStartupTarget({
    targetKind: "demo",
    rootEntryModule: "src/index.ts",
    description: "Run single-task happy-path demo for minimal execution path validation.",
    requiredLayers: ["platform", "apps"],
    startupCommand: "npm run demo",
    appManifest: null,
  }),
  ...PLATFORM_APPS.map<PlatformStartupTarget>((appManifest) => freezePlatformStartupTarget({
    targetKind: appManifest.kind,
    rootEntryModule: "src/index.ts",
    description: `Start ${appManifest.kind} application surface per architecture target.`,
    requiredLayers: appManifest.requiredLayers,
    startupCommand: appManifest.startupCommand,
    appManifest,
  })),
]);

export function listPlatformApps(): readonly PlatformAppManifest[] {
  return PLATFORM_APPS;
}

export function listPlatformAppKinds(): readonly PlatformAppKind[] {
  return PLATFORM_APPS.map((app) => app.kind);
}

export function getPlatformAppManifestByKind(kind: PlatformAppKind): PlatformAppManifest {
  const manifest = PLATFORM_APPS.find((app) => app.kind === kind);
  if (manifest == null) {
    throw new Error(`Unknown platform app kind: ${kind}`);
  }
  return manifest;
}

export function resolvePlatformAppManifest(selector: PlatformAppKind | string): PlatformAppManifest | null {
  const normalizedSelector = selector.trim();
  if (normalizedSelector.length === 0) {
    return null;
  }
  if (normalizedSelector === "summary" || normalizedSelector === "demo") {
    throw new Error(`Platform startup target '${normalizedSelector}' is not an app selector. Use resolvePlatformStartupTarget() instead.`);
  }
  return PLATFORM_APPS.find((app) => app.kind === normalizedSelector || app.appId === normalizedSelector) ?? null;
}

export function buildPlatformStartupTargets(): readonly PlatformStartupTarget[] {
  return PLATFORM_STARTUP_TARGETS;
}

export function resolvePlatformStartupTarget(targetKind: PlatformStartupTargetKind): PlatformStartupTarget {
  const target = PLATFORM_STARTUP_TARGETS.find((item) => item.targetKind === targetKind);
  if (target == null) {
    throw new Error(`Unknown platform startup target: ${targetKind}`);
  }
  return target;
}
