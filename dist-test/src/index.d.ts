import { buildPlatformArchitectureBootstrapSummary } from "./platform-architecture-bootstrap.js";
import type { PlatformAppKind, PlatformStartupTargetKind } from "./platform-architecture-types.js";
export * as apps from "./apps/index.js";
export * as domains from "./domains/index.js";
export * from "./domains-runtime-catalog.js";
export * from "./domains-runtime-orchestrator.js";
export * from "./domains-startup-plan.js";
export * as interaction from "./interaction/index.js";
export * from "./interaction-governance-runtime-catalog.js";
export * from "./interaction-governance-runtime-orchestrator.js";
export * from "./interaction-governance-startup-plan.js";
export * as opsMaturity from "./ops-maturity/index.js";
export * as orgGovernance from "./org-governance/index.js";
export * from "./platform-application-kernel.js";
export * from "./platform-architecture-bootstrap.js";
export * from "./platform-architecture-types.js";
export * as platform from "./platform/index.js";
export * as plugins from "./plugins/index.js";
export * as scaleEcosystem from "./scale-ecosystem/index.js";
export * from "./scale-ops-runtime-catalog.js";
export * from "./scale-ops-runtime-orchestrator.js";
export * from "./scale-ops-startup-plan.js";
export * as sdk from "./sdk/index.js";
export type PlatformRootEntryMode = "summary" | "demo" | PlatformAppKind;
export interface PlatformRootSummary {
    readonly architecture: ReturnType<typeof buildPlatformArchitectureBootstrapSummary>;
    readonly domains: {
        readonly startupOrder: readonly string[];
        readonly totalCapabilityCount: number;
        readonly capabilityCounts: {
            readonly phase9a: number;
            readonly phase9b: number;
            readonly phase9c: number;
            readonly phase9d: number;
            readonly phase9e: number;
            readonly phase9f: number;
        };
    };
    readonly planes: {
        readonly startupOrder: readonly string[];
        readonly totalCapabilityCount: number;
        readonly capabilityCounts: {
            readonly interface: number;
            readonly controlPlane: number;
            readonly orchestration: number;
            readonly execution: number;
            readonly stateEvidence: number;
        };
    };
    readonly aiOperations: {
        readonly startupOrder: readonly string[];
        readonly totalCapabilityCount: number;
        readonly capabilityCounts: {
            readonly modelGateway: number;
            readonly promptEngine: number;
            readonly compliance: number;
            readonly harness: number;
        };
    };
    readonly interactionGovernance: {
        readonly startupOrder: readonly string[];
        readonly totalCapabilityCount: number;
        readonly capabilityCounts: {
            readonly interaction: number;
            readonly governance: number;
        };
    };
    readonly scaleOps: {
        readonly startupOrder: readonly string[];
        readonly totalCapabilityCount: number;
        readonly capabilityCounts: {
            readonly scaleEcosystem: number;
            readonly opsMaturity: number;
        };
    };
}
export declare function runPlatformRootDemo(): Promise<void>;
export declare function runPlatformRootSummary(): Promise<void>;
export declare function buildPlatformRootSummary(): PlatformRootSummary;
export declare function runPlatformStartupPlan(targetKind: Extract<PlatformStartupTargetKind, PlatformAppKind>): Promise<void>;
export declare function main(): Promise<void>;
