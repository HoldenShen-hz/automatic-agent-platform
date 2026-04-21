import type { MemoryLayer, MemorySourceTrustLevel, EnvironmentName } from "../../contracts/types/domain.js";
import { ValidationError } from "../../contracts/errors.js";
import type { StructuredMemoryContent } from "../../state-evidence/memory/memory-schema.js";
import type { ProviderHealthSummary } from "../../shared/observability/provider-health-tracker.js";
import type { ModelGovernanceSnapshot } from "../../prompt-engine/eval/prompt-model-policy-governance-service.js";
import type { ModelRouteClass, ModelRouteFallbackLease, ModelRouteRiskLevel } from "../../model-gateway/provider-registry/model-routing-service.js";
import { readTrimmedEnv } from "./runtime-env.js";

// Valid environment names
export const ENVIRONMENT_NAMES = ["dev", "test", "staging", "pre-prod", "prod"] as const;
// Valid tenant platform actions
export const TENANT_ACTIONS = [
  "create_workspace",
  "add_workspace_member",
  "create_organization",
  "add_organization_member",
  "create_tenant",
  "bind_deployment",
  "create_namespace",
  "topology",
] as const;
// Valid enterprise capability actions
export const ENTERPRISE_ACTIONS = ["register_readiness", "summary", "export", "list_readiness", "list_reports"] as const;
// Valid marketplace actions
export const MARKETPLACE_ACTIONS = [
  "register_package",
  "submit_review",
  "decide_review",
  "publish",
  "revoke",
  "summary",
  "export",
  "list_packages",
  "list_reviews",
  "list_publications",
  "list_reports",
] as const;
// Valid deployment execution actions
export const DEPLOYMENT_EXECUTION_ACTIONS = ["summary", "export", "build_report"] as const;
// Valid control plane actions
export const CONTROL_PLANE_ACTIONS = ["summary", "heartbeat", "select"] as const;
// Valid ops governance actions
export const OPS_GOVERNANCE_ACTIONS = ["summary", "export", "check", "report", "audit"] as const;
// Valid secret management actions
export const SECRET_ACTIONS = ["register", "resolve", "rotate", "issue", "revoke", "leases", "due", "request_due", "refresh", "summary"] as const;
// Valid worker register actions
export const WORKER_REGISTER_ACTIONS = ["issue", "complete"] as const;
export const GATEWAY_TARGET_ACTIONS = ["upsert", "list", "resolve"] as const;
export const INSPECT_KINDS = [
  "task",
  "execution",
  "approval",
  "tasks",
  "workflows",
  "decisions",
  "workers",
] as const;
export const SKILL_CREATOR_ACTIONS = ["create", "validate"] as const;
export const SHADOW_SNAPSHOT_ACTIONS = ["create", "list", "restore"] as const;
export const MEMORY_ACTIONS = [
  "initialize",
  "remember",
  "prefetch",
  "queue_prefetch",
  "system_prompt_block",
  "sync_turn",
  "shutdown",
  "list",
  "quality",
  "consolidate",
  "revoke",
] as const;
export const MODEL_ROUTE_CLASSES = ["default", "classification", "writing", "coding", "reasoning"] as const;
export const MODEL_ROUTE_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

/**
 * Configuration for tenant platform CLI operations.
 * Supports multi-tenant workspace, organization, and namespace management.
 */
export interface TenantPlatformCliEnvConfig {
  dbPath: string;
  action: typeof TENANT_ACTIONS[number];
  ownerId: string | null;
  displayName: string | null;
  planId: string | null;
  workspaceId: string | null;
  defaultPolicySet: string | null;
  organizationId: string | null;
  userId: string | null;
  role: string | null;
  billingAccountId: string | null;
  tenantId: string | null;
  storageScope: string | null;
  identityScope: string | null;
  policyScope: string | null;
  artifactScope: string | null;
  isolationMode: "shared_logical" | "shared_hard_scoped" | "dedicated_runtime" | "dedicated_environment" | null;
  deploymentMode: "cloud_shared" | "private_cloud" | "on_prem" | null;
  setAsOrganizationDefault: boolean;
  environmentId: string | null;
  region: string | null;
  networkBoundary: string | null;
  bindingId: string | null;
  plane: "transactional" | "artifact" | "analytics" | "memory_archive" | "replay" | null;
  namespaceId: string | null;
  retentionPolicy: string | null;
  encryptionPolicy: string | null;
  residencyPolicy: string | null;
}

/**
 * Configuration for enterprise capability CLI operations.
 * Supports capability readiness registration and reporting.
 */
export interface EnterpriseCapabilityCliEnvConfig {
  dbPath: string;
  action: typeof ENTERPRISE_ACTIONS[number];
  artifactRoot: string | null;
  readinessId: string | null;
  environment: EnvironmentName | null;
  componentType:
    | "provider"
    | "gateway"
    | "sandbox"
    | "worker_fleet"
    | "artifact_store"
    | "notification_channel"
    | "external_service"
    | null;
  componentId: string | null;
  credentialReady: boolean;
  secondaryGates: Record<string, boolean> | undefined;
  owner: string | null;
  lastVerifiedAt: string | null;
  isActive: boolean;
  notes: string | null;
  accountId: string | null;
  workspaceId: string | null;
  tenantId: string | null;
  deploymentMode: "cloud_shared" | "private_cloud" | "on_prem" | null;
  generatedAt: string | null;
  limit: number | null;
}

/**
 * Configuration for marketplace CLI operations.
 * Supports package registration, review workflow, and publication management.
 */
export interface MarketplaceCliEnvConfig {
  dbPath: string;
  action: typeof MARKETPLACE_ACTIONS[number];
  tenantId: string | null;
  artifactRoot: string | null;
  packageId: string | null;
  extensionId: string | null;
  packageType: "tool" | "skill" | "plugin" | "mcp" | "template" | null;
  displayName: string | null;
  version: string | null;
  owner: string | null;
  trustLevel: "internal" | "verified" | "community" | "unknown" | null;
  sourceUri: string | null;
  capabilities: string[] | null;
  permissions: string[] | null;
  compatibility: { apiContract: string; permissionSurface: string; runtimeCapability: string } | null;
  signatureVerified: boolean;
  manifestChecksum: string | null;
  lifecycleState: "discovered" | "installed" | "enabled" | "disabled" | "reloaded" | "removed";
  reviewRequired: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  reviewId: string | null;
  findings: string[] | undefined;
  submitter: string | null;
  submittedAt: string | null;
  reviewStatus: "approved" | "rejected" | null;
  reviewer: string | null;
  reasonCode: string | null;
  decidedAt: string | null;
  publicationId: string | null;
  channel: string | null;
  publishedAt: string | null;
  revokedAt: string | null;
  generatedAt: string | null;
  limit: number | null;
}

/**
 * Configuration for deployment execution CLI operations.
 * Supports deployment runs with local or simulated runners.
 */
export interface DeploymentExecutionCliEnvConfig {
  action: typeof DEPLOYMENT_EXECUTION_ACTIONS[number];
  repoRootDir: string;
  dbPath: string;
  artifactRoot: string;
  runnerMode: "local" | "simulate";
  environment: EnvironmentName;
  version: string | null;
  commitSha: string | null;
  rolloutStrategy: "rolling" | "canary" | "blue_green" | null;
  generatedAt: string | null;
  taskId: string | null;
  execute: boolean;
}

/**
 * Configuration for control plane balancer CLI operations.
 * Supports coordinator heartbeat, dispatch selection, and queue management.
 */
export interface ControlPlaneBalancerCliEnvConfig {
  dbPath: string;
  action: typeof CONTROL_PLANE_ACTIONS[number];
  coordinatorId: string | null;
  coordinatorRegion: string | null;
  role: string | null;
  queueAffinity: string | null;
  status: "active" | "draining" | "offline" | null;
  maxConcurrentDispatches: number | null;
  activeDispatchCount: number | null;
  backlogCount: number | null;
  cpuPct: number | null;
  shards: string[] | null;
  queueName: string | null;
  preferredRegion: string | null;
  tenantId: string | null;
  requestKey: string | null;
}

/**
 * Configuration for ops governance CLI operations.
 * Supports operational governance reporting and exports.
 */
export interface OpsGovernanceCliEnvConfig {
  dbPath: string;
  environment: EnvironmentName;
  action: typeof OPS_GOVERNANCE_ACTIONS[number];
  generatedAt: string | null;
  taskId: string | null;
  artifactRoot: string | null;
}

/**
 * Configuration for secret management CLI operations.
 * Supports secret registration, rotation, leasing, and revocation.
 */
export interface SecretManagementCliEnvConfig {
  dbPath: string;
  action: typeof SECRET_ACTIONS[number];
  secretRef: string | null;
  displayName: string | null;
  category: string | null;
  providerKind: string | null;
  scopeType: string | null;
  scopeRef: string | null;
  rotationCadenceDays: number | null;
  ttlMinutes: number | null;
  breakGlass: boolean;
  metadata: Record<string, unknown> | null;
  currentVersion: string | null;
  requestedBy: string | null;
  grantedTo: string | null;
  usagePurpose: string | null;
  taskId: string | null;
  executionId: string | null;
  expiresAt: string | null;
  usageMetadata: Record<string, unknown> | null;
  rotationMode: string | null;
  rotationStatus: string | null;
  rotationReasonCode: string | null;
  previousVersion: string | null;
  nextVersion: string | null;
  rotationMetadata: Record<string, unknown> | null;
  leaseTtlMinutes: number | null;
  leaseId: string | null;
  revocationReasonCode: string | null;
  revokedAt: string | null;
  asOf: string | null;
}

/**
 * Configuration for worker registration CLI operations.
 * Supports worker challenge issuance and completion handshake.
 */
export interface WorkerRegisterCliEnvConfig {
  dbPath: string;
  action: typeof WORKER_REGISTER_ACTIONS[number];
  configRoot: string | null;
  capabilities: string[];
  occurredAt: string | null;
  challengeTtlMs: number | null;
  workerId: string | null;
  challengeId: string | null;
  challengeToken: string | null;
  maxConcurrency: number | null;
  queueAffinity: string | null;
  isolationLevel: "standard" | "hardened" | "strict" | null;
  repoVersion: string | null;
  runtimeInstanceId: string | null;
  restartedFromRuntimeInstanceId: string | null;
  remoteSessionStatus: "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only" | null;
  lastAcknowledgedStreamOffset: string | null;
  sessionConsistencyCheckStatus: "unknown" | "passed" | "mismatch" | null;
  sessionConsistencyCheckedAt: string | null;
  workspaceSyncStatus: "unknown" | "aligned" | "conflict" | null;
  workspaceSyncCheckedAt: string | null;
}

export interface GatewayTargetsCliEnvConfig {
  dbPath: string | undefined;
  action: typeof GATEWAY_TARGET_ACTIONS[number];
  channel: string | undefined;
  targetKind: string | undefined;
  externalTargetId: string | undefined;
  displayName: string | undefined;
  aliases: string[] | undefined;
  metadata: Record<string, unknown> | undefined;
  query: string | undefined;
  limit: number | undefined;
}

export interface InspectCliEnvConfig {
  dbPath: string | undefined;
  kind: typeof INSPECT_KINDS[number];
  taskId: string | undefined;
  executionId: string | undefined;
  approvalId: string | undefined;
  limit: number | undefined;
  taskStatus: string | undefined;
  workflowStatus: string | undefined;
  workflowId: string | undefined;
  divisionId: string | undefined;
  hasPendingApproval: boolean | undefined;
  decisionType: string | undefined;
  decisionStatus: string | undefined;
  workerStatus: string | undefined;
  placement: string | undefined;
  remoteSessionStatus: string | undefined;
  queueAffinity: string | undefined;
}

export interface SkillCreatorCliEnvConfig {
  action: typeof SKILL_CREATOR_ACTIONS[number];
  registerInRegistry: boolean;
  skillRoot: string | undefined;
  name: string | undefined;
  description: string | undefined;
  version: string | undefined;
  author: string | undefined;
  requiredTools: string[] | undefined;
  requiredPermissions: string[] | undefined;
  tags: string[] | undefined;
  applicableRoles: string[] | undefined;
  resourceDirectories: Array<Record<string, unknown>> | undefined;
  includeOpenAiAgent: boolean | undefined;
  overwriteAllowed: boolean | undefined;
  cacheable: boolean | undefined;
  cacheTtlSeconds: number | undefined;
  riskLevel: string | undefined;
  lifecycle: string | undefined;
  skillPath: string | undefined;
}

export interface ShadowSnapshotCliEnvConfig {
  workspaceRoot: string;
  shadowRoot: string;
  action: typeof SHADOW_SNAPSHOT_ACTIONS[number];
  maxEntryBytes: number | null;
  excludedPaths: string[] | null;
  snapshotId: string | null;
  label: string | null;
  reasonCode: string | null;
  actorId: string | null;
}

export interface MemoryCliEnvConfig {
  dbPath: string | undefined;
  action: typeof MEMORY_ACTIONS[number];
  scope: string | undefined;
  taskId: string | undefined;
  sessionId: string | undefined;
  agentId: string | undefined;
  executionId: string | undefined;
  memoryId: string | undefined;
  memoryText: string | undefined;
  contentJson: Record<string, unknown> | undefined;
  qualityScore: number | undefined;
  expiresAt: string | undefined;
  classification: string | undefined;
  memoryLayer: MemoryLayer | undefined;
  sourceTrustLevel: MemorySourceTrustLevel | undefined;
  createdAt: string | undefined;
  evaluatedAt: string | undefined;
  scopes: string[] | undefined;
  memoryLayers: MemoryLayer[] | undefined;
  classifications: string[] | undefined;
  sourceTrustLevels: MemorySourceTrustLevel[] | undefined;
  minQualityScore: number | undefined;
  limit: number | undefined;
  maxPromptMemories: number | undefined;
  maxFewShotExamples: number | undefined;
  queryText: string | undefined;
  taskIntent: string | undefined;
  toolNames: string[] | undefined;
  includeExperienceExamples: boolean | undefined;
  includeExpired: boolean;
  includeRevoked: boolean;
  prefetchAwait: boolean;
  revokeSourceMemories: boolean;
  targetMemoryLayer: Exclude<MemoryLayer, "layer_3"> | undefined;
  olderThanCreatedAt: string | undefined;
  minSourceMemories: number | undefined;
  maxSourceMemories: number | undefined;
  revocationReason: string | undefined;
  workContext: string | undefined;
  topOfMind: string[] | undefined;
  recentHistory: string[] | undefined;
  longTermBackground: string[] | undefined;
  facts: StructuredMemoryContent["facts"] | undefined;
  experienceTaskContext: string | undefined;
  experienceTaskIntent: string | undefined;
  experienceTools: Array<{
    toolName: string;
    callId: string;
    status: "succeeded" | "failed" | "blocked" | "cancelled";
    durationMs: number;
    errorCode?: string;
  }> | undefined;
  experienceOutcome: "succeeded" | "failed" | "partial" | undefined;
  experienceFinalErrorCode: string | undefined;
  experienceQualityScore: number | undefined;
}

export interface ModelRoutingCliEnvConfig {
  configRoot: string | undefined;
  dbPath: string | undefined;
  routeClass: ModelRouteClass | undefined;
  riskLevel: ModelRouteRiskLevel | undefined;
  preferredProfileName: string | undefined;
  pinnedProfileName: string | undefined;
  stickyProfileName: string | undefined;
  turnId: string | undefined;
  fallbackLease: ModelRouteFallbackLease | undefined;
  maxInputPer1kUsd: number | undefined;
  requiredCapabilities: string[] | undefined;
  allowStrongUpgrade: boolean;
  providerHealth: Record<string, ProviderHealthSummary>;
  governanceSnapshot: ModelGovernanceSnapshot | undefined;
  loadGovernanceSnapshot: boolean;
}

/**
 * Throws a missing environment variable error.
 */
export function missingEnv(name: string): never {
  throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}

/**
 * Throws an invalid environment variable error.
 */
export function invalidEnv(name: string): never {
  throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}

/**
 * Throws an invalid gate value error for secondary gates.
 */
export function invalidGateValue(name: string): never {
  throw new ValidationError(`invalid_gate_value:${name}`, `invalid_gate_value:${name}`);
}

/**
 * Reads a required environment variable, throwing if missing or empty.
 */
export function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  return readTrimmedEnv(env, name) ?? missingEnv(name);
}

/**
 * Reads an optional environment variable, returning null if missing or empty.
 */
export function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  return readTrimmedEnv(env, name) ?? null;
}

/**
 * Parses an optional number from environment, returning null if missing.
 * Throws if value exists but is not a valid finite number.
 */
export function optionalNumber(env: NodeJS.ProcessEnv, name: string): number | null {
  const value = optionalEnv(env, name);
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return invalidEnv(name);
  }
  return parsed;
}

/**
 * Parses a required number from environment, throwing if missing or invalid.
 */
export function requiredNumber(env: NodeJS.ProcessEnv, name: string): number {
  const parsed = optionalNumber(env, name);
  if (parsed == null) {
    return missingEnv(name);
  }
  return parsed;
}

/**
 * Reads an optional enum value from environment, returning null if missing.
 * Throws if value exists but is not in the allowed list.
 */
export function optionalEnumValue<const T extends readonly string[]>(
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

/**
 * Reads a required enum value from environment, throwing if missing or invalid.
 */
export function requiredEnumValue<const T extends readonly string[]>(
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

/**
 * Parses a JSON array of strings from environment variable.
 * @param required - If true, throws on missing; if false, returns null
 */
export function parseStringArrayJson(env: NodeJS.ProcessEnv, name: string, required: boolean): string[] | null {
  const raw = required ? requiredEnv(env, name) : optionalEnv(env, name);
  if (raw == null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return invalidEnv(name);
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    return invalidEnv(name);
  }
  return parsed;
}

/**
 * Parses a JSON object from environment variable, returning null if missing.
 */
export function parseObjectJson(env: NodeJS.ProcessEnv, name: string): Record<string, unknown> | null {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return invalidEnv(name);
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return invalidEnv(name);
  }
  return parsed as Record<string, unknown>;
}

export function parseJsonValue(env: NodeJS.ProcessEnv, name: string): unknown | null {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return invalidEnv(name);
  }
}

/**
 * Parses a JSON object with boolean values from environment variable.
 * Returns undefined if missing. Uses invalidGateValue for AA_SECONDARY_GATES_JSON.
 */
export function parseBooleanMapJson(env: NodeJS.ProcessEnv, name: string): Record<string, boolean> | undefined {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return undefined;
  }
  const parsed = parseObjectJson(env, name);
  if (parsed == null) {
    return undefined;
  }
  for (const entry of Object.values(parsed)) {
    if (typeof entry !== "boolean") {
      return name === "AA_SECONDARY_GATES_JSON" ? invalidGateValue(name) : invalidEnv(name);
    }
  }
  return parsed as Record<string, boolean>;
}

export function parseBoolean(env: NodeJS.ProcessEnv, name: string): boolean | undefined {
  const value = optionalEnv(env, name);
  if (value == null) {
    return undefined;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return invalidEnv(name);
}

export function parseInteger(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const value = optionalEnv(env, name);
  if (value == null) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return invalidEnv(name);
  }
  return parsed;
}

export function parseStringArrayFromCsv(env: NodeJS.ProcessEnv, name: string): string[] | null {
  const value = optionalEnv(env, name);
  if (value == null) {
    return null;
  }
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : [];
}

/**
 * Parses marketplace compatibility JSON with apiContract, permissionSurface, and runtimeCapability fields.
 */
export function parseCompatibilityJson(env: NodeJS.ProcessEnv, name: string): MarketplaceCliEnvConfig["compatibility"] {
  const parsed = parseObjectJson(env, name);
  if (parsed == null) {
    return null;
  }
  if (
    typeof parsed.apiContract !== "string"
    || typeof parsed.permissionSurface !== "string"
    || typeof parsed.runtimeCapability !== "string"
  ) {
    return invalidEnv(name);
  }
  return {
    apiContract: parsed.apiContract,
    permissionSurface: parsed.permissionSurface,
    runtimeCapability: parsed.runtimeCapability,
  };
}

export function parseTypedJson<T>(env: NodeJS.ProcessEnv, name: string): T | undefined {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new ValidationError(
      `invalid_json:${name}:${error instanceof Error ? error.message : String(error)}`,
      `invalid_json:${name}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function parseProviderHealthJson(
  env: NodeJS.ProcessEnv,
  name: string,
): Record<string, ProviderHealthSummary> {
  const parsed = parseTypedJson<Record<string, unknown>>(env, name);
  if (parsed == null) {
    return {};
  }

  const summaries: Record<string, ProviderHealthSummary> = {};
  for (const [provider, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      if (value !== "healthy" && value !== "degraded" && value !== "failed") {
        return invalidEnv(name);
      }
      summaries[provider] = {
        status: value,
        successRate: value === "healthy" ? 1 : value === "degraded" ? 0.75 : 0.25,
        totalCalls: 0,
        failedCalls: 0,
        fallbackCount: 0,
        latestFailureCodes: [],
      };
      continue;
    }

    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return invalidEnv(name);
    }

    const candidate = value as Partial<ProviderHealthSummary>;
    if (candidate.status !== "healthy" && candidate.status !== "degraded" && candidate.status !== "failed") {
      return invalidEnv(name);
    }

    summaries[provider] = {
      status: candidate.status,
      successRate: typeof candidate.successRate === "number" ? candidate.successRate : 1,
      totalCalls: typeof candidate.totalCalls === "number" ? candidate.totalCalls : 0,
      failedCalls: typeof candidate.failedCalls === "number" ? candidate.failedCalls : 0,
      fallbackCount: typeof candidate.fallbackCount === "number" ? candidate.fallbackCount : 0,
      latestFailureCodes: Array.isArray(candidate.latestFailureCodes)
        ? candidate.latestFailureCodes.filter((item): item is string => typeof item === "string")
        : [],
    };
  }

  return summaries;
}

export function buildStructuredMemoryContent(env: NodeJS.ProcessEnv): StructuredMemoryContent | undefined {
  const workContext = optionalEnv(env, "AA_MEMORY_WORK_CONTEXT") ?? undefined;
  const topOfMind = parseStringArrayFromCsv(env, "AA_MEMORY_TOP_OF_MIND") ?? undefined;
  const recentHistory = parseStringArrayFromCsv(env, "AA_MEMORY_RECENT_HISTORY") ?? undefined;
  const longTermBackground = parseStringArrayFromCsv(env, "AA_MEMORY_LONG_TERM_BACKGROUND") ?? undefined;
  const facts = parseTypedJson<StructuredMemoryContent["facts"]>(env, "AA_MEMORY_FACTS_JSON");
  if (
    workContext == null
    && topOfMind == null
    && recentHistory == null
    && longTermBackground == null
    && facts == null
  ) {
    return undefined;
  }
  return {
    schemaVersion: "memory.v2",
    workContext: workContext ?? null,
    topOfMind: topOfMind ?? [],
    recentHistory: recentHistory ?? [],
    longTermBackground: longTermBackground ?? [],
    facts: facts ?? [],
  };
}

/**
 * Loads tenant platform CLI configuration from environment variables.
 * Supports workspace, organization, and tenant management operations.
 */
