import type { EnvironmentName, EvolutionScopeType } from "../../contracts/types/domain.js";
import type { BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
declare const COMPLIANCE_PROGRAM_ACTIONS: readonly ["summary", "export"];
declare const HA_PROGRAM_ACTIONS: readonly ["summary", "export"];
declare const PMF_ACTIONS: readonly ["report", "run", "export", "history", "latest"];
declare const PERCEPTION_ACTIONS: readonly ["upsert_source", "ingest", "brief", "propose", "export", "sources", "briefs"];
declare const EVOLUTION_ACTIONS: readonly ["propose_budget", "propose_experience", "sync", "apply", "rollback", "list", "resolve_budget", "evaluate_budget"];
export interface ComplianceProgramCliEnvConfig {
    dbPath: string;
    action: typeof COMPLIANCE_PROGRAM_ACTIONS[number];
    artifactRoot: string | null;
}
export interface HaProgramCliEnvConfig {
    dbPath: string;
    environment: EnvironmentName;
    action: typeof HA_PROGRAM_ACTIONS[number];
    artifactRoot: string | null;
}
export interface PmfCliEnvConfig {
    dbPath: string;
    artifactRoot: string;
    action: typeof PMF_ACTIONS[number];
    profileName: string | null;
    divisionId: string | null;
    windowDays: number | null;
    evaluatedAt: string | null;
    limit: number | null;
}
export interface PerceptionCliEnvConfig {
    dbPath: string;
    artifactRoot: string;
    action: typeof PERCEPTION_ACTIONS[number];
    accountId: string | null;
    tenantId: string | null;
    sourceId: string | null;
    sourceType: string | null;
    sourceName: string | null;
    sourceEnabled: boolean;
    sourceSchedule: Record<string, unknown> | undefined;
    sourceFilters: Record<string, unknown> | undefined;
    sourcePriority: number | null;
    intelItems: Array<Record<string, unknown>> | undefined;
    sourceIds: string[] | undefined;
    briefGeneratedAt: string | null;
    briefLimit: number | null;
    briefSince: string | null;
    briefUntil: string | null;
    briefId: string | null;
    sourcesEnabledOnly: boolean;
    briefsLimit: number | null;
}
export interface EvolutionCliEnvConfig {
    dbPath: string;
    action: typeof EVOLUTION_ACTIONS[number];
    taskId: string | null;
    executionId: string | null;
    sourceAgentId: string | null;
    scopeType: EvolutionScopeType | null;
    scopeRef: string | null;
    currentPolicy: BudgetPolicy;
    observedAverageCostUsd: number | null;
    sampleSize: number | null;
    successRate: number | null;
    proposalReason: string | null;
    targetScope: string | null;
    taskContext: string | null;
    taskIntent: string | null;
    queryTools: string[];
    minQualityScore: number | null;
    proposalId: string | null;
    appliedBy: string | null;
    rolledBackBy: string | null;
    reasonCode: string | null;
    status: string | null;
    basePolicy: BudgetPolicy;
    currentTaskCostUsd: number | null;
    nextEstimatedCostUsd: number | null;
}
export declare function loadComplianceProgramCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): ComplianceProgramCliEnvConfig;
export declare function loadHaProgramCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): HaProgramCliEnvConfig;
export declare function loadPmfCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): PmfCliEnvConfig;
export declare function loadPerceptionCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): PerceptionCliEnvConfig;
export declare function loadEvolutionCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): EvolutionCliEnvConfig;
export {};
