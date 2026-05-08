export type PlatformArchitectureLayer =
  | "platform"
  | "domains"
  | "interaction"
  | "org-governance"
  | "scale-ecosystem"
  | "ops-maturity"
  | "plugins"
  | "sdk"
  | "apps";

export type PlatformPlane = "P1" | "P2" | "P3" | "P4" | "P5" | "X1";

export type PlatformAppKind = "api" | "console" | "worker";

export interface PlatformAppManifest {
  appId: string;
  kind: PlatformAppKind;
  entryModule: string;
  defaultPort: number | null;
  healthEndpoint: string | null;
  capabilities: string[];
  requiredLayers: PlatformArchitectureLayer[];
  startupCommand: string;
  startupMode: "daemon" | "job";
}

export type PlatformStartupTargetKind = "summary" | "demo" | PlatformAppKind;

export interface PlatformStartupTarget {
  targetKind: PlatformStartupTargetKind;
  rootEntryModule: string;
  description: string;
  requiredLayers: PlatformArchitectureLayer[];
  startupCommand: string | null;
  appManifest: PlatformAppManifest | null;
}

export type {
  HarnessRun,
  HarnessRunStatus,
  NodeRun,
  NodeRunStatus,
  PlanGraphBundle,
} from "./platform/contracts/executable-contracts/index.js";
