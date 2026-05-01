import { join } from "node:path";

import type { EnvironmentName, EvolutionScopeType } from "../../contracts/types/domain.js";
import type { BudgetPolicy } from "../../model-gateway/cost-tracker/budget-guard.js";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";

export const COMPLIANCE_PROGRAM_ACTIONS = ["summary", "export"] as const;
const HA_PROGRAM_ACTIONS = ["summary", "export"] as const;
const PMF_ACTIONS = ["report", "run", "export", "history", "latest"] as const;
const PERCEPTION_ACTIONS = ["upsert_source", "ingest", "brief", "propose", "export", "sources", "briefs"] as const;
const EVOLUTION_ACTIONS = [
  "propose_budget",
  "propose_experience",
  "sync",
  "apply",
  "rollback",
  "list",
  "resolve_budget",
  "evaluate_budget",
] as const;
const ENVIRONMENT_NAMES = ["dev", "test", "staging", "pre-prod", "prod"] as const;
const EVOLUTION_SCOPE_TYPES = ["account", "division", "tenant", "workspace", "organization", "role"] as const;

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

function invalidEnv(name: string): never {
  throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}

function missingEnv(name: string): never {
  throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  return readTrimmedEnv(env, name) ?? missingEnv(name);
}

function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  if (Object.prototype.hasOwnProperty.call(env, name) && env[name] === "") {
    return null;
  }
  return readTrimmedEnv(env, name);
}

function requiredEnumValue<const T extends readonly string[]>(
  env: NodeJS.ProcessEnv,
  name: string,
  allowed: T,
): T[number] {
  const value = requiredEnv(env, name);
  if (!allowed.includes(value)) {
    return invalidEnv(name);
  }
  return value as T[number];
}

function optionalEnumValue<const T extends readonly string[]>(
  env: NodeJS.ProcessEnv,
  name: string,
  allowed: T,
): T[number] | null {
  const value = optionalEnv(env, name);
  if (value == null) {
    return null;
  }
  if (!allowed.includes(value)) {
    return invalidEnv(name);
  }
  return value as T[number];
}

function optionalIntegerEnv(env: NodeJS.ProcessEnv, name: string): number | null {
  const value = optionalEnv(env, name);
  if (value == null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return invalidEnv(name);
  }
  return parsed;
}

function optionalFloatEnv(env: NodeJS.ProcessEnv, name: string): number | null {
  const value = optionalEnv(env, name);
  if (value == null) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return invalidEnv(name);
  }
  return parsed;
}

function optionalBooleanEnv(env: NodeJS.ProcessEnv, name: string, defaultValue = false): boolean {
  const value = optionalEnv(env, name);
  if (value == null) {
    return defaultValue;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return invalidEnv(name);
}

function optionalJsonEnv<T>(env: NodeJS.ProcessEnv, name: string): T | undefined {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return invalidEnv(name);
  }
}

function optionalCsvEnv(env: NodeJS.ProcessEnv, name: string): string[] {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return [];
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function resolveDefaultDbPath(cwd: string): string {
  return join(cwd, "data", "sqlite", "authoritative-demo.db");
}

function resolveDefaultArtifactRoot(cwd: string): string {
  return join(cwd, "data", "artifacts");
}

function resolveDbPath(env: NodeJS.ProcessEnv, cwd: string): string {
  return optionalEnv(env, "AA_DB_PATH") ?? resolveDefaultDbPath(cwd);
}

function parseBudgetPolicyFromEnv(env: NodeJS.ProcessEnv, prefix: string): BudgetPolicy {
  return {
    maxTaskCostUsd: optionalFloatEnv(env, `${prefix}_MAX_TASK_COST_USD`) ?? 5,
    maxPackCostUsd: optionalFloatEnv(env, `${prefix}_MAX_PACK_COST_USD`) ?? 50,
    maxPlatformCostUsd: optionalFloatEnv(env, `${prefix}_MAX_PLATFORM_COST_USD`) ?? 5000,
    maxDailyCostUsd: optionalFloatEnv(env, `${prefix}_MAX_DAILY_COST_USD`) ?? 50,
    maxMonthlyCostUsd: optionalFloatEnv(env, `${prefix}_MAX_MONTHLY_COST_USD`) ?? 500,
    maxModelTokens: optionalFloatEnv(env, `${prefix}_MAX_MODEL_TOKENS`) ?? 50000,
    maxSteps: optionalFloatEnv(env, `${prefix}_MAX_STEPS`) ?? 50,
    maxDurationMs: optionalFloatEnv(env, `${prefix}_MAX_DURATION_MS`) ?? 300000,
    warnAtRatio: optionalFloatEnv(env, `${prefix}_WARN_AT_RATIO`) ?? 0.8,
    mode: (optionalEnv(env, `${prefix}_MODE`) as BudgetPolicy["mode"] | null) ?? "supervised",
  };
}

export function loadComplianceProgramCliEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): ComplianceProgramCliEnvConfig {
  return {
    dbPath: resolveDbPath(env, cwd),
    action: optionalEnumValue(env, "AA_COMPLIANCE_PROGRAM_ACTION", COMPLIANCE_PROGRAM_ACTIONS) ?? "summary",
    artifactRoot: optionalEnv(env, "AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT"),
  };
}

export function loadHaProgramCliEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): HaProgramCliEnvConfig {
  const environment = requiredEnumValue(env, "AA_ENVIRONMENT", ENVIRONMENT_NAMES);
  return {
    dbPath: resolveDbPath(env, cwd),
    environment,
    action: optionalEnumValue(env, "AA_HA_PROGRAM_ACTION", HA_PROGRAM_ACTIONS) ?? "summary",
    artifactRoot: optionalEnv(env, "AA_HA_PROGRAM_ARTIFACT_ROOT"),
  };
}

export function loadPmfCliEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): PmfCliEnvConfig {
  return {
    dbPath: resolveDbPath(env, cwd),
    artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT") ?? resolveDefaultArtifactRoot(cwd),
    action: requiredEnumValue(env, "AA_PMF_ACTION", PMF_ACTIONS),
    profileName: optionalEnv(env, "AA_PMF_PROFILE_NAME"),
    divisionId: optionalEnv(env, "AA_PMF_DIVISION_ID"),
    windowDays: optionalIntegerEnv(env, "AA_PMF_WINDOW_DAYS"),
    evaluatedAt: optionalEnv(env, "AA_PMF_EVALUATED_AT"),
    limit: optionalIntegerEnv(env, "AA_PMF_LIMIT"),
  };
}

export function loadPerceptionCliEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): PerceptionCliEnvConfig {
  return {
    dbPath: resolveDbPath(env, cwd),
    artifactRoot: optionalEnv(env, "AA_ARTIFACT_ROOT") ?? resolveDefaultArtifactRoot(cwd),
    action: requiredEnumValue(env, "AA_PERCEPTION_ACTION", PERCEPTION_ACTIONS),
    accountId: optionalEnv(env, "AA_PERCEPTION_ACCOUNT_ID"),
    tenantId: optionalEnv(env, "AA_TENANT_ID"),
    sourceId: optionalEnv(env, "AA_SOURCE_ID"),
    sourceType: optionalEnv(env, "AA_SOURCE_TYPE"),
    sourceName: optionalEnv(env, "AA_SOURCE_NAME"),
    sourceEnabled: optionalBooleanEnv(env, "AA_SOURCE_ENABLED", true),
    sourceSchedule: optionalJsonEnv<Record<string, unknown>>(env, "AA_SOURCE_SCHEDULE_JSON"),
    sourceFilters: optionalJsonEnv<Record<string, unknown>>(env, "AA_SOURCE_FILTERS_JSON"),
    sourcePriority: optionalIntegerEnv(env, "AA_SOURCE_PRIORITY"),
    intelItems: optionalJsonEnv<Array<Record<string, unknown>>>(env, "AA_INTEL_ITEMS_JSON"),
    sourceIds: optionalJsonEnv<string[]>(env, "AA_SOURCE_IDS_JSON"),
    briefGeneratedAt: optionalEnv(env, "AA_BRIEF_GENERATED_AT"),
    briefLimit: optionalIntegerEnv(env, "AA_BRIEF_LIMIT"),
    briefSince: optionalEnv(env, "AA_BRIEF_SINCE"),
    briefUntil: optionalEnv(env, "AA_BRIEF_UNTIL"),
    briefId: optionalEnv(env, "AA_BRIEF_ID"),
    sourcesEnabledOnly: optionalBooleanEnv(env, "AA_SOURCES_ENABLED_ONLY", false),
    briefsLimit: optionalIntegerEnv(env, "AA_BRIEFS_LIMIT"),
  };
}

export function loadEvolutionCliEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): EvolutionCliEnvConfig {
  return {
    dbPath: resolveDbPath(env, cwd),
    action: requiredEnumValue(env, "AA_EVOLUTION_ACTION", EVOLUTION_ACTIONS),
    taskId: optionalEnv(env, "AA_TASK_ID"),
    executionId: optionalEnv(env, "AA_EXECUTION_ID"),
    sourceAgentId: optionalEnv(env, "AA_SOURCE_AGENT_ID"),
    scopeType: optionalEnumValue(env, "AA_SCOPE_TYPE", EVOLUTION_SCOPE_TYPES) as EvolutionScopeType | null,
    scopeRef: optionalEnv(env, "AA_SCOPE_REF"),
    currentPolicy: parseBudgetPolicyFromEnv(env, "AA_CURRENT_POLICY"),
    observedAverageCostUsd: optionalFloatEnv(env, "AA_OBSERVED_AVERAGE_COST_USD"),
    sampleSize: optionalIntegerEnv(env, "AA_SAMPLE_SIZE"),
    successRate: optionalFloatEnv(env, "AA_SUCCESS_RATE"),
    proposalReason: optionalEnv(env, "AA_PROPOSAL_REASON"),
    targetScope: optionalEnv(env, "AA_TARGET_SCOPE"),
    taskContext: optionalEnv(env, "AA_TASK_CONTEXT"),
    taskIntent: optionalEnv(env, "AA_TASK_INTENT"),
    queryTools: optionalCsvEnv(env, "AA_QUERY_TOOLS"),
    minQualityScore: optionalFloatEnv(env, "AA_MIN_QUALITY_SCORE"),
    proposalId: optionalEnv(env, "AA_PROPOSAL_ID"),
    appliedBy: optionalEnv(env, "AA_APPLIED_BY"),
    rolledBackBy: optionalEnv(env, "AA_ROLLED_BACK_BY"),
    reasonCode: optionalEnv(env, "AA_REASON_CODE"),
    status: optionalEnv(env, "AA_STATUS"),
    basePolicy: parseBudgetPolicyFromEnv(env, "AA_BASE_POLICY"),
    currentTaskCostUsd: optionalFloatEnv(env, "AA_CURRENT_TASK_COST_USD"),
    nextEstimatedCostUsd: optionalFloatEnv(env, "AA_NEXT_ESTIMATED_COST_USD"),
  };
}
