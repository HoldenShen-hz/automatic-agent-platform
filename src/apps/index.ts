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

const PLATFORM_APPS = Object.freeze([API_APP_MANIFEST, CONSOLE_APP_MANIFEST, WORKER_APP_MANIFEST] satisfies PlatformAppManifest[]);

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
  return PLATFORM_APPS.find((app) => app.kind === selector || app.appId === selector) ?? null;
}

export function buildPlatformStartupTargets(): readonly PlatformStartupTarget[] {
  return [
    {
      targetKind: "summary",
      rootEntryModule: "src/index.ts",
      description: "输出系统骨架、七层模块与应用清单摘要。",
      requiredLayers: [],
      startupCommand: "npm run start",
      appManifest: null,
    },
    {
      targetKind: "demo",
      rootEntryModule: "src/index.ts",
      description: "运行单任务 happy-path demo，用于最小执行链路验证。",
      requiredLayers: ["platform", "apps"],
      startupCommand: "npm run demo",
      appManifest: null,
    },
    ...PLATFORM_APPS.map<PlatformStartupTarget>((appManifest) => ({
      targetKind: appManifest.kind,
      rootEntryModule: "src/index.ts",
      description: `按架构 target 启动 ${appManifest.kind} 应用面。`,
      requiredLayers: [...appManifest.requiredLayers],
      startupCommand: appManifest.startupCommand,
      appManifest,
    })),
  ];
}

export function resolvePlatformStartupTarget(targetKind: PlatformStartupTargetKind): PlatformStartupTarget {
  const target = buildPlatformStartupTargets().find((item) => item.targetKind === targetKind);
  if (target == null) {
    throw new Error(`Unknown platform startup target: ${targetKind}`);
  }
  return target;
}
