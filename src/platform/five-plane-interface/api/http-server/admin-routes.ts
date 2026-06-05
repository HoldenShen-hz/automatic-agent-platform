/**
 * @fileoverview Admin Routes - Stability, admin task takeover, control-plane, workers, config, rollouts, tenants, and budgets.
 *
 * Routes:
 * - GET /v1/stability
 * - GET /v1/admin/tasks/:id
 * - GET /v1/admin/control-plane/load-balancing
 * - POST /v1/admin/control-plane/load-balancing/select
 * - GET /v1/admin/workers
 * - POST /v1/admin/config
 * - PUT /v1/admin/config
 * - GET /v1/replay-sessions
 * - GET /v1/replay-sessions/:id
 * - POST /v1/admin/panic-directives
 * - POST /v1/admin/resume-directives
 * - GET /v1/admin/rollouts
 * - GET /v1/admin/tenants
 * - GET /v1/admin/budgets
 * - GET /v1/admin/chargeback/reports
 *
 * Part of §6 API Endpoints - Missing endpoints implementation
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseControlPlaneLoadBalancingSelectionPayload } from "./schemas.js";
import {
  buildJsonResponse,
  requirePrincipal,
  assertGlobalTenantScopeSupported,
  resolveTenantScope,
  validateTaskId,
  readLimit,
  readStoredJsonValue,
} from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { ApiDelegationService } from "../facade-interfaces.js";
import type { ConfigRolloutService } from "../../../five-plane-control-plane/config-center/config-rollout-service.js";
import type { TenantBoundaryRegistryService } from "../../../five-plane-control-plane/tenant/index.js";
import type { CostReportService } from "../cost-report-service.js";
import type { AdminConfigService } from "../admin-config-service.js";
import type { AdminRuntimeDirectiveService } from "../admin-runtime-directive-service.js";
import type { DomainRegistryService } from "../../../../domains/registry/domain-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { ChargebackService } from "../../../model-gateway/cost-tracker/chargeback-service.js";
import { BenchmarkInventoryService } from "../../../shared/stability/benchmark-inventory-service.js";
import { DeploymentInventoryService } from "../../../shared/stability/deployment-inventory-service.js";
import { LeadershipClaimsGovernanceService } from "../../../shared/stability/leadership-claims-governance-service.js";
import { ProjectionInventoryService } from "../../../five-plane-state-evidence/events/projection-inventory-service.js";
import { SchemaInventoryService } from "../../../five-plane-state-evidence/truth/schema-inventory-service.js";
import { JudgeProviderRegistryService } from "../../../prompt-engine/eval/judge-provider-registry-service.js";
import { ComplianceProgramTemplateService } from "../../../compliance/compliance-program-template-service.js";
import { DEFAULT_COMPLIANCE_FRAMEWORKS } from "../../../../org-governance/compliance-engine/framework-catalog.js";
import type { WebhookIngressService } from "../../webhook/index.js";
import { AppError, isAppError } from "../../../contracts/errors.js";
import type { ResumePlan } from "../api-external-support.js";
import { z } from "zod";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const nonEmptyStringSchema = z.string().trim().min(1);

const adminConfigUpdateSchema = z.object({
  key: nonEmptyStringSchema,
  value: z.unknown(),
  tenantId: nonEmptyStringSchema.optional(),
}).strict();

const panicFreezeModeSchema = z.enum(["deploy", "approval", "write", "automation"]);
const panicSeveritySchema = z.enum(["full", "partial"]);
const resumeApprovalRoleSchema = z.enum(["platform_admin", "security_team", "break_glass"]);

const panicDirectiveSchema = z.object({
  scope: nonEmptyStringSchema,
  reasonCode: nonEmptyStringSchema,
  activeIncidents: z.number().int().min(0).default(0),
  freezeModes: z.array(panicFreezeModeSchema).min(1).optional(),
  requiredApprovers: z.array(nonEmptyStringSchema).min(2).optional(),
  allowList: z.array(nonEmptyStringSchema).optional(),
  targetScopes: z.array(nonEmptyStringSchema).min(1).optional(),
  forensicArtifactIds: z.array(nonEmptyStringSchema).optional(),
  severity: panicSeveritySchema.optional(),
  triggerSignals: z.array(nonEmptyStringSchema).optional(),
}).strict();

const resumeDirectiveSchema = z.object({
  planId: nonEmptyStringSchema.optional(),
  scope: nonEmptyStringSchema,
  scopeRef: nonEmptyStringSchema.optional(),
  approvedBy: z.array(nonEmptyStringSchema).min(2),
  approvedRoles: z.array(resumeApprovalRoleSchema).min(2),
  approvalCount: z.number().optional(),
  compatibilityCheckRef: nonEmptyStringSchema.optional(),
  mode: z.enum(["standard", "dry_run", "break_glass"]).optional(),
  checkpointsVerified: z.boolean(),
  forensicSnapshotReviewed: z.boolean(),
  rollbackPlanReady: z.boolean(),
  validationRunPassed: z.boolean(),
  createdAt: z.string().optional(),
}).strict();

const leadershipClaimLevelSchema = z.enum([
  "designed",
  "pilot_ready",
  "local_leader",
  "industry_comparable",
  "industry_leading",
]);

const leadershipClaimSurfaceSchema = z.enum([
  "docs",
  "ui",
  "release_note",
  "sales_material",
]);

const leadershipClaimReviewRequestSchema = z.object({
  familyId: nonEmptyStringSchema,
  divisionId: nonEmptyStringSchema.optional(),
  scenarioId: nonEmptyStringSchema.optional(),
  requestedClaimLevel: leadershipClaimLevelSchema,
  requestedSurfaces: z.array(leadershipClaimSurfaceSchema).min(1),
  evidenceRefs: z.array(nonEmptyStringSchema).min(1).max(16),
  rationale: nonEmptyStringSchema,
}).strict();

const leadershipClaimReviewDecisionSchema = z.object({
  reasonCode: nonEmptyStringSchema,
  comment: z.string().trim().optional(),
}).strict();

const leadershipClaimRevokeSchema = z.object({
  reasonCode: nonEmptyStringSchema,
  comment: z.string().trim().optional(),
  replacementRequired: z.boolean(),
}).strict();
const compliancePolicyPatchSchema = z.record(z.unknown());
const complianceExceptionCreateSchema = z.object({
  reason: nonEmptyStringSchema,
  policyId: nonEmptyStringSchema,
}).strict();
const complianceExceptionApproveSchema = z.object({
  action: z.literal("approve").optional(),
}).strict();
const complianceExceptionRejectSchema = z.object({
  rationale: nonEmptyStringSchema,
}).strict();

export interface AdminConfigUpdatePayload {
  key: string;
  value: unknown;
  tenantId?: string;
}

interface UserPreferenceState {
  locale: string;
  theme: "light" | "dark" | "high-contrast";
  defaultDashboardLayout: string[];
}

const DEFAULT_USER_PREFERENCE_STATE: UserPreferenceState = {
  locale: "zh-CN",
  theme: "dark",
  defaultDashboardLayout: ["overview", "tasks", "approvals"],
};
const userPreferenceState = new Map<string, UserPreferenceState>();
const MAX_DIVISION_INVENTORY_SNAPSHOT_BYTES = 1024 * 1024;
const MAX_AUDIT_LOG_RECORDS = 200;

interface CompliancePolicyRecord {
  readonly id: string;
  readonly name: string;
  readonly severity: string;
}

interface ComplianceExceptionRecord {
  readonly id: string;
  readonly reason: string;
  readonly policyId: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly createdAt: string;
  readonly requestedBy: string;
  readonly reviewedAt?: string;
  readonly reviewedBy?: string;
  readonly rationale?: string;
}

interface AuditLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly outcome: string;
  readonly metadata?: Record<string, unknown>;
}

interface RawAuditRecord {
  readonly auditId?: unknown;
  readonly sequence?: unknown;
  readonly actorId?: unknown;
  readonly action?: unknown;
  readonly resourceRef?: unknown;
  readonly createdAt?: unknown;
  readonly metadata?: unknown;
  readonly integrityHash?: unknown;
}

interface ComplianceRuntimePaths {
  readonly policyOverridesPath: string;
  readonly exceptionsPath: string;
  readonly auditTrailPath: string;
}

function resolvePlatformRoot(deps: AdminRouteDeps): string {
  return deps.platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

function resolveComplianceRuntimePaths(deps: AdminRouteDeps): ComplianceRuntimePaths {
  const root = resolvePlatformRoot(deps);
  return {
    policyOverridesPath: join(root, "data", "runtime", "compliance-policies-overrides.json"),
    exceptionsPath: join(root, "data", "runtime", "compliance-exceptions.json"),
    auditTrailPath: join(root, "data", "runtime", "audit-trail.json"),
  };
}

async function readRuntimeJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf8");
    return readStoredJsonValue(raw, {
      maxBytes: MAX_DIVISION_INVENTORY_SNAPSHOT_BYTES,
      fallback,
    }) as T;
  } catch {
    return fallback;
  }
}

async function writeRuntimeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function deriveCompliancePolicySeverity(frameworkId: string): string {
  switch (frameworkId) {
    case "hipaa":
    case "pci_dss":
    case "sox":
      return "critical";
    case "soc2":
    case "gdpr":
    case "pipl":
      return "high";
    default:
      return "medium";
  }
}

function buildDefaultCompliancePolicies(): CompliancePolicyRecord[] {
  return DEFAULT_COMPLIANCE_FRAMEWORKS.map((framework) => ({
    id: framework.frameworkId,
    name: framework.displayName,
    severity: deriveCompliancePolicySeverity(framework.frameworkId),
  }));
}

async function readCompliancePolicyOverrides(deps: AdminRouteDeps): Promise<Record<string, Record<string, unknown>>> {
  return readRuntimeJson<Record<string, Record<string, unknown>>>(
    resolveComplianceRuntimePaths(deps).policyOverridesPath,
    {},
  );
}

async function listCompliancePoliciesSnapshot(deps: AdminRouteDeps): Promise<CompliancePolicyRecord[]> {
  const overrides = await readCompliancePolicyOverrides(deps);
  return buildDefaultCompliancePolicies().map((policy) => {
    const override = overrides[policy.id] ?? {};
    return {
      id: policy.id,
      name: typeof override.name === "string" && override.name.trim().length > 0 ? override.name : policy.name,
      severity: typeof override.severity === "string" && override.severity.trim().length > 0 ? override.severity : policy.severity,
    };
  });
}

async function readComplianceExceptions(deps: AdminRouteDeps): Promise<ComplianceExceptionRecord[]> {
  return readRuntimeJson<ComplianceExceptionRecord[]>(resolveComplianceRuntimePaths(deps).exceptionsPath, []);
}

function normalizeAuditLogEntry(record: RawAuditRecord): AuditLogEntry {
  const metadata = record.metadata != null && typeof record.metadata === "object"
    ? record.metadata as Record<string, unknown>
    : undefined;
  return {
    id: typeof record.auditId === "string" ? record.auditId : `audit_${randomUUID()}`,
    timestamp: typeof record.createdAt === "string" ? record.createdAt : new Date(0).toISOString(),
    actor: typeof record.actorId === "string" ? record.actorId : "system",
    action: typeof record.action === "string" ? record.action : "audit.recorded",
    resource: typeof record.resourceRef === "string" ? record.resourceRef : "runtime/unknown",
    outcome: typeof metadata?.outcome === "string" ? metadata.outcome : "recorded",
    ...(metadata == null ? {} : { metadata }),
  };
}

async function readAuditLogSnapshot(deps: AdminRouteDeps): Promise<AuditLogEntry[]> {
  const rawRecords = await readRuntimeJson<RawAuditRecord[]>(
    resolveComplianceRuntimePaths(deps).auditTrailPath,
    [],
  );
  return rawRecords
    .map(normalizeAuditLogEntry)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, MAX_AUDIT_LOG_RECORDS);
}

async function appendAuditTrailRecord(
  deps: AdminRouteDeps,
  input: {
    readonly actorId: string;
    readonly action: string;
    readonly resourceRef: string;
    readonly outcome: string;
    readonly metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const paths = resolveComplianceRuntimePaths(deps);
  const current = await readRuntimeJson<Array<RawAuditRecord & { readonly integrityHash?: string }>>(paths.auditTrailPath, []);
  const previousHash = typeof current.at(-1)?.integrityHash === "string" ? current.at(-1)?.integrityHash ?? null : null;
  const createdAt = new Date().toISOString();
  const material = JSON.stringify({
    actorId: input.actorId,
    action: input.action,
    resourceRef: input.resourceRef,
    outcome: input.outcome,
    createdAt,
    previousHash,
  });
  const integrityHash = createHash("sha256").update(material).digest("hex");
  const record = {
    auditId: `audit_${randomUUID()}`,
    sequence: current.length + 1,
    actorType: "user",
    actorId: input.actorId,
    tenantId: null,
    taskId: null,
    executionId: null,
    action: input.action,
    resourceRef: input.resourceRef,
    decisionRef: null,
    versionRef: "v1",
    createdAt,
    metadata: {
      outcome: input.outcome,
      ...(input.metadata ?? {}),
    },
    prevHash: previousHash,
    integrityHash,
    integritySignature: createHash("sha256").update(`${integrityHash}:signature`).digest("hex"),
  };
  await writeRuntimeJson(paths.auditTrailPath, [...current, record]);
}

async function updateCompliancePolicyRecord(
  deps: AdminRouteDeps,
  principal: { actorId: string },
  policyId: string,
  patch: Record<string, unknown>,
): Promise<CompliancePolicyRecord> {
  const policies = await listCompliancePoliciesSnapshot(deps);
  const existing = policies.find((policy) => policy.id === policyId);
  if (existing == null) {
    throw new ApiError(404, "api.compliance_policy_not_found", "Compliance policy was not found.");
  }
  const overrides = await readCompliancePolicyOverrides(deps);
  const nextOverride: Record<string, unknown> = {
    ...(overrides[policyId] ?? {}),
    ...patch,
    reviewedAt: new Date().toISOString(),
    reviewedBy: principal.actorId,
  };
  await writeRuntimeJson(resolveComplianceRuntimePaths(deps).policyOverridesPath, {
    ...overrides,
    [policyId]: nextOverride,
  });
  await appendAuditTrailRecord(deps, {
    actorId: principal.actorId,
    action: "compliance.policy.updated",
    resourceRef: `compliance-policy:${policyId}`,
    outcome: "updated",
    metadata: { patch: nextOverride },
  });
  return {
    id: existing.id,
    name: typeof nextOverride.name === "string" && nextOverride.name.trim().length > 0 ? nextOverride.name : existing.name,
    severity: typeof nextOverride.severity === "string" && nextOverride.severity.trim().length > 0 ? nextOverride.severity : existing.severity,
  };
}

async function createComplianceExceptionRecord(
  deps: AdminRouteDeps,
  principal: { actorId: string },
  payload: { reason: string; policyId: string },
): Promise<ComplianceExceptionRecord> {
  const policies = await listCompliancePoliciesSnapshot(deps);
  if (!policies.some((policy) => policy.id === payload.policyId)) {
    throw new ApiError(404, "api.compliance_policy_not_found", "Compliance policy was not found.");
  }
  const record: ComplianceExceptionRecord = {
    id: `exception_${randomUUID()}`,
    reason: payload.reason,
    policyId: payload.policyId,
    status: "pending",
    createdAt: new Date().toISOString(),
    requestedBy: principal.actorId,
  };
  const current = await readComplianceExceptions(deps);
  await writeRuntimeJson(resolveComplianceRuntimePaths(deps).exceptionsPath, [record, ...current]);
  await appendAuditTrailRecord(deps, {
    actorId: principal.actorId,
    action: "compliance.exception.submitted",
    resourceRef: `compliance-exception:${record.id}`,
    outcome: "pending",
    metadata: { policyId: record.policyId, reason: record.reason },
  });
  return record;
}

async function updateComplianceExceptionRecord(
  deps: AdminRouteDeps,
  principal: { actorId: string },
  exceptionId: string,
  status: "approved" | "rejected",
  rationale?: string,
): Promise<ComplianceExceptionRecord> {
  const current = await readComplianceExceptions(deps);
  const existing = current.find((item) => item.id === exceptionId);
  if (existing == null) {
    throw new ApiError(404, "api.compliance_exception_not_found", "Compliance exception was not found.");
  }
  const updated: ComplianceExceptionRecord = {
    ...existing,
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: principal.actorId,
    ...(rationale == null ? {} : { rationale }),
  };
  await writeRuntimeJson(
    resolveComplianceRuntimePaths(deps).exceptionsPath,
    current.map((item) => item.id === exceptionId ? updated : item),
  );
  await appendAuditTrailRecord(deps, {
    actorId: principal.actorId,
    action: `compliance.exception.${status}`,
    resourceRef: `compliance-exception:${exceptionId}`,
    outcome: status,
    metadata: {
      policyId: updated.policyId,
      ...(rationale == null ? {} : { rationale }),
    },
  });
  return updated;
}

async function readDivisionInventorySnapshot(deps: AdminRouteDeps): Promise<unknown> {
  const snapshotPath = join(resolvePlatformRoot(deps), "config", "division-coverage", "inventory", "division-inventory.generated.json");
  try {
    await access(snapshotPath);
  } catch {
    return {
      generatedAt: new Date(0).toISOString(),
      records: [],
      summary: {
        totalDivisions: 0,
        p0Divisions: 0,
        blockedDivisions: 0,
        orphanSourceModules: 0,
      },
    };
  }
  return readStoredJsonValue(await readFile(snapshotPath, "utf8"), {
    maxBytes: MAX_DIVISION_INVENTORY_SNAPSHOT_BYTES,
    fallback: {
      generatedAt: new Date(0).toISOString(),
      records: [],
      summary: {
        totalDivisions: 0,
        p0Divisions: 0,
        blockedDivisions: 0,
        orphanSourceModules: 0,
      },
    },
  });
}

function buildUserPreferenceStateKey(principal: { actorId: string; tenantId: string | null }): string {
  return `${principal.tenantId ?? "global"}:${principal.actorId}`;
}

function readUserPreferenceState(principal: { actorId: string; tenantId: string | null }): UserPreferenceState {
  return userPreferenceState.get(buildUserPreferenceStateKey(principal)) ?? DEFAULT_USER_PREFERENCE_STATE;
}

function parseEnvCsv(value: string | undefined): string[] {
  if (value == null || value.trim().length === 0) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function listAdminRoles() {
  return [
    { id: "viewer", name: "Viewer", scope: "platform" as const, permissionCount: 1, userCount: 0 },
    { id: "operator", name: "Operator", scope: "platform" as const, permissionCount: 2, userCount: 0 },
    { id: "admin", name: "Admin", scope: "platform" as const, permissionCount: 3, userCount: 0 },
  ];
}

function listFeatureFlags() {
  return parseEnvCsv(process.env.AA_FEATURE_FLAGS).map((flagId) => ({
    id: flagId,
    enabled: true,
    rolloutPercentage: 100,
    target: "global",
  }));
}

function readSystemConfig() {
  const environment = process.env.NODE_ENV === "production"
    ? "prod"
    : process.env.NODE_ENV === "staging"
      ? "staging"
      : "dev";
  return {
    environment,
    cspMode: environment === "prod" ? "enforced" as const : "report-only" as const,
    csrfEnabled: true,
    telemetryEndpoint: process.env.AA_OTEL_ENDPOINT?.trim() ?? "",
  };
}

async function readModelConfigs(deps: AdminRouteDeps) {
  const path = join(resolvePlatformRoot(deps), "config", "providers", "models.json");
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const parsed = readStoredJsonValue(raw, {
    maxBytes: MAX_DIVISION_INVENTORY_SNAPSHOT_BYTES,
    fallback: { profiles: {} },
  }) as {
    profiles?: Record<string, {
      provider?: unknown;
      modelId?: unknown;
      pricing?: { inputPer1kUsd?: unknown; outputPer1kUsd?: unknown } | null;
    }>;
  };
  const boundDomains = deps.domainRegistryService?.list().map((domain) => domain.domainId) ?? [];
  return Object.entries(parsed.profiles ?? {}).map(([profileId, profile]) => ({
    id: profileId,
    provider: typeof profile.provider === "string" ? profile.provider : "unknown",
    model: typeof profile.modelId === "string" ? profile.modelId : profileId,
    boundDomains,
    budgetUsd:
      typeof profile.pricing?.inputPer1kUsd === "number" && typeof profile.pricing?.outputPer1kUsd === "number"
        ? Math.round((profile.pricing.inputPer1kUsd + profile.pricing.outputPer1kUsd) * 1000)
        : 0,
  }));
}

function listDomainConfigs(deps: AdminRouteDeps) {
  return (deps.domainRegistryService?.list() ?? []).map((domain) => ({
    id: domain.domainId,
    displayName: domain.name,
    owner: domain.capabilities.securityLevel ?? "unassigned",
    defaultDrillDepth: 3 as const,
    featureVisibilityCount: domain.toolBundles.length + domain.workflows.length + domain.pluginBindings.length,
  }));
}

function listWebhookSummaries(
  webhookIngressService: WebhookIngressService | null | undefined,
) {
  if (webhookIngressService == null) {
    return [];
  }
  const acceptedEnvelopes = webhookIngressService.listAcceptedEnvelopes();
  return webhookIngressService.listEndpoints().map((endpoint) => ({
    id: endpoint.endpointId,
    targetUrl: endpoint.dispatchTargetRef ?? endpoint.source,
    eventCount: acceptedEnvelopes.filter((envelope) => envelope.endpointId === endpoint.endpointId).length,
    enabled: endpoint.enabled,
  }));
}

function buildAdminQueueSnapshot(panel: ReturnType<MissionControlService["getStabilityPanel"]>) {
  const queueMap = new Map<string, { ready: number; inFlight: number; retries: number; dlq: number }>();
  for (const worker of panel.workers) {
    const queue = worker.queueAffinity ?? "default";
    const entry = queueMap.get(queue) ?? { ready: 0, inFlight: 0, retries: 0, dlq: 0 };
    entry.inFlight += worker.runningExecutionCount;
    queueMap.set(queue, entry);
  }
  for (const task of panel.queuedTasks) {
    const queue = task.divisionId ?? "default";
    const entry = queueMap.get(queue) ?? { ready: 0, inFlight: 0, retries: 0, dlq: 0 };
    entry.ready += 1;
    queueMap.set(queue, entry);
  }
  if (queueMap.size === 0) {
    queueMap.set("default", { ready: panel.queuedTaskCount, inFlight: 0, retries: 0, dlq: 0 });
  }
  for (const workflow of panel.workflows) {
    const queue = workflow.divisionId ?? "default";
    const entry = queueMap.get(queue) ?? { ready: 0, inFlight: 0, retries: 0, dlq: 0 };
    entry.retries += Math.max(0, workflow.retryCount);
    queueMap.set(queue, entry);
  }
  for (const [queue, dlq] of Object.entries(panel.deadLetterCountsByDivision)) {
    const entry = queueMap.get(queue) ?? { ready: 0, inFlight: 0, retries: 0, dlq: 0 };
    entry.dlq += Math.max(0, dlq);
    queueMap.set(queue, entry);
  }
  return [...queueMap.entries()].map(([id, entry]) => ({
    id,
    ready: entry.ready,
    inFlight: entry.inFlight,
    retries: entry.retries,
    dlq: entry.dlq,
  }));
}

function requireTaskStore(deps: AdminRouteDeps): AuthoritativeTaskStore {
  if (deps.taskStore == null) {
    throw new ApiError(503, "api.task_store_unavailable", "Task store is not configured.");
  }
  return deps.taskStore;
}

function drainBusyWorkers(store: AuthoritativeTaskStore): { drainedWorkerIds: string[]; totalWorkers: number } {
  const workers = store.worker.listWorkerSnapshots();
  const now = new Date().toISOString();
  const drainedWorkerIds: string[] = [];
  for (const worker of workers) {
    if (worker.status !== "busy") {
      continue;
    }
    store.worker.upsertWorkerSnapshot({
      ...worker,
      status: "draining",
      updatedAt: now,
    });
    drainedWorkerIds.push(worker.workerId);
  }
  return {
    drainedWorkerIds,
    totalWorkers: workers.length,
  };
}

function cleanupRetryQueue(
  store: AuthoritativeTaskStore,
): { cleanedTaskIds: string[]; invalidatedTicketIds: string[] } {
  const now = new Date().toISOString();
  const cleanedTaskIds: string[] = [];
  for (const workflow of store.workflow.listWorkflowStates()) {
    if (workflow.retryCount <= 0) {
      continue;
    }
    const task = store.task.getTask(workflow.taskId);
    if (task == null || (task.status !== "queued" && task.status !== "pending")) {
      continue;
    }
    store.task.updateTaskStatus(workflow.taskId, "failed", now, "admin.retry_queue_cleared", now);
    store.workflow.updateWorkflowRecoveryState({
      taskId: workflow.taskId,
      status: "failed",
      currentStepIndex: workflow.currentStepIndex,
      outputsJson: workflow.outputsJson,
      updatedAt: now,
      resumableFromStep: null,
      retryCount: 0,
      lastErrorCode: "admin.retry_queue_cleared",
    });
    cleanedTaskIds.push(workflow.taskId);
  }
  const cleanedTaskIdSet = new Set(cleanedTaskIds);
  const invalidatedTicketIds: string[] = [];
  for (const ticket of store.worker.listPendingExecutionTickets()) {
    if (!cleanedTaskIdSet.has(ticket.taskId)) {
      continue;
    }
    store.worker.invalidateExecutionTicket({
      ticketId: ticket.id,
      status: "cancelled",
      invalidatedAt: now,
    });
    invalidatedTicketIds.push(ticket.id);
  }
  return { cleanedTaskIds, invalidatedTicketIds };
}

// ─── Route Deps ─────────────────────────────────────────────────────────────

export interface AdminRouteDeps {
  authService: ApiAuthService | null;
  missionControlService: MissionControlService;
  coordinatorLoadBalancingService: ApiDelegationService | null;
  configRolloutService?: ConfigRolloutService | null;
  tenantRegistryService?: TenantBoundaryRegistryService | null;
  costReportService?: CostReportService | null;
  adminConfigService?: AdminConfigService | null;
  adminRuntimeDirectiveService?: AdminRuntimeDirectiveService | null;
  domainRegistryService?: DomainRegistryService | null;
  webhookIngressService?: WebhookIngressService | null;
  taskStore?: AuthoritativeTaskStore | null;
  platformRoot?: string;
}

function matchesHarnessRunRoute(segments: string[], expectedTailLength: number): boolean {
  const normalized = segments[0] === "api" ? segments.slice(1) : segments;
  return (
    normalized[0] === "v1"
    && normalized[1] === "harness-runs"
    && normalized.length === expectedTailLength + 1
  );
}

function matchesReplaySessionRoute(segments: string[], expectedTailLength: number): boolean {
  const normalized = segments[0] === "api" ? segments.slice(1) : segments;
  return (
    normalized[0] === "v1"
    && normalized[1] === "replay-sessions"
    && normalized.length === expectedTailLength + 1
  );
}

function applyAdminConfigUpdate(ctx: Parameters<NonNullable<RouteDefinition["handler"]>>[0], deps: AdminRouteDeps) {
  const principal = requirePrincipal(ctx.request, deps.authService, "admin");
  assertGlobalTenantScopeSupported(principal, "admin config update");
  const payload = readValidatedJsonBody(ctx.request.body, adminConfigUpdateSchema.parse);

  const tenantId = resolveTenantScope(principal, payload.tenantId);
  const record = deps.adminConfigService?.applyUpdate({
    key: payload.key,
    value: payload.value,
    ...(tenantId !== undefined ? { tenantId } : {}),
    updatedBy: principal.actorId,
  }) ?? {
    success: true,
    key: payload.key,
    value: payload.value,
    tenantId: tenantId ?? null,
    updatedAt: new Date().toISOString(),
    updatedBy: principal.actorId,
  };

  return buildJsonResponse(ctx.requestId, 200, {
    success: true,
    record,
  });
}

function resolveWorkflowLookupId(missionControlService: MissionControlService, workflowOrTaskId: string): string {
  try {
    missionControlService.getWorkflowCockpit(workflowOrTaskId);
    return workflowOrTaskId;
  } catch (error) {
    if (!isAppError(error) || error.code !== "workflow.not_found") {
      throw error;
    }
    const fallback = missionControlService
      .listWorkflowCockpits(200)
      .find((workflow) => workflow.workflowId === workflowOrTaskId || workflow.taskId === workflowOrTaskId);
    if (fallback?.taskId != null) {
      return fallback.taskId;
    }
    return workflowOrTaskId;
  }
}

export function createAdminRoutes(deps: AdminRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/stability",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "stability panels");
        const limit = readLimit(ctx.request, 25);
        return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getStabilityPanel(limit));
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "admin"
          || segments[2] !== "tasks"
          || segments.length !== 4
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin takeover consoles");
        const taskId = validateTaskId(segments[3], "Admin route");
        return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getAdminTakeoverConsole(taskId));
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesHarnessRunRoute(segments, 1)) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 50);
        const workflows = deps.missionControlService.listWorkflowCockpits(limit);
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRuns: workflows.map((workflow) => ({
            harnessRunId: workflow.workflowId ?? workflow.taskId ?? "unknown-harness-run",
            taskId: workflow.taskId,
            workflowId: workflow.workflowId,
            workflowStatus: workflow.workflowStatus,
            pendingApprovalCount: workflow.pendingApprovalCount ?? 0,
            retryCount: workflow.retryCount ?? 0,
          })),
          total: workflows.length,
          limit,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesHarnessRunRoute(segments, 2)) {
          return null;
        }
        if ((segments[segments.length - 1] ?? "").length === 0) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const harnessRunId = validateTaskId(segments[segments.length - 1], "Harness runs route");
        const workflow = deps.missionControlService.getWorkflowCockpit(
          resolveWorkflowLookupId(deps.missionControlService, harnessRunId),
        );
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRunId,
          workflow: workflow.summary,
          inspect: workflow.inspect,
          timeline: workflow.timeline,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesHarnessRunRoute(segments, 3) || segments[segments.length - 1] !== "events") {
          return null;
        }
        if ((segments[segments.length - 2] ?? "").length === 0) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const harnessRunId = validateTaskId(segments[segments.length - 2], "Harness run events route");
        const workflow = deps.missionControlService.getWorkflowCockpit(
          resolveWorkflowLookupId(deps.missionControlService, harnessRunId),
        );
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRunId,
          events: workflow.timeline?.entries ?? [],
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesReplaySessionRoute(segments, 1)) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 50);
        const workflows = deps.missionControlService.listWorkflowCockpits(limit);
        return buildJsonResponse(ctx.requestId, 200, {
          replaySessions: workflows.map((workflow) => ({
            replaySessionId: workflow.workflowId ?? workflow.taskId ?? "unknown-replay-session",
            taskId: workflow.taskId,
            workflowId: workflow.workflowId,
            workflowStatus: workflow.workflowStatus,
            generatedAt: workflow.generatedAt,
          })),
          total: workflows.length,
          limit,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesReplaySessionRoute(segments, 2)) {
          return null;
        }
        if ((segments[2] ?? "").length === 0) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const replaySessionId = validateTaskId(segments[2], "Replay sessions route");
        const workflow = deps.missionControlService.getWorkflowCockpit(
          resolveWorkflowLookupId(deps.missionControlService, replaySessionId),
        );
        return buildJsonResponse(ctx.requestId, 200, {
          replaySessionId,
          workflow: workflow.summary,
          inspect: workflow.inspect,
          timeline: workflow.timeline,
          events: workflow.timeline?.entries ?? [],
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/control-plane/load-balancing",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "global control-plane load balancing");
        const svc = deps.coordinatorLoadBalancingService;
        if (svc == null) {
          throw new ApiError(503, "api.control_plane_unavailable", "Control-plane load balancing is not configured.");
        }
        return buildJsonResponse(ctx.requestId, 200, svc.buildSummary());
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/control-plane/load-balancing/select",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "global control-plane load balancing");
        const payload = readValidatedJsonBody(
          ctx.request.body,
          parseControlPlaneLoadBalancingSelectionPayload,
        );
        const svc = deps.coordinatorLoadBalancingService;
        if (svc == null) {
          throw new ApiError(503, "api.control_plane_unavailable", "Control-plane load balancing is not configured.");
        }
        const tenantId = resolveTenantScope(principal, payload.tenantId);
        return buildJsonResponse(ctx.requestId, 200, svc.selectCoordinator({
          ...(payload.queueName != null ? { queueName: payload.queueName } : {}),
          ...(payload.preferredRegion != null ? { preferredRegion: payload.preferredRegion } : {}),
          ...(tenantId !== undefined ? { tenantId } : {}),
          ...(payload.requestKey != null ? { requestKey: payload.requestKey } : {}),
        }));
      },
    },
    // GET /v1/admin/workers - List workers
    {
      method: "GET",
      pathname: "/v1/admin/workers",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin workers list");
        const limit = readLimit(ctx.request, 50);

        // Return stability panel workers data
        const panel = deps.missionControlService.getStabilityPanel(limit);
        return buildJsonResponse(ctx.requestId, 200, {
          workers: panel.workers,
          total: panel.workers.length,
        });
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/workers/drain",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin worker drain");
        const result = drainBusyWorkers(requireTaskStore(deps));
        const panel = deps.missionControlService.getStabilityPanel(readLimit(ctx.request, 50));
        return buildJsonResponse(ctx.requestId, 200, {
          drainedWorkerIds: result.drainedWorkerIds,
          drainedCount: result.drainedWorkerIds.length,
          totalWorkers: result.totalWorkers,
          workers: panel.workers,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/queues",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin queues list");
        const panel = deps.missionControlService.getStabilityPanel(readLimit(ctx.request, 50));
        const queues = buildAdminQueueSnapshot(panel);
        return buildJsonResponse(ctx.requestId, 200, {
          queues,
          total: queues.length,
        });
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/queues/retry-cleanup",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin retry queue cleanup");
        const result = cleanupRetryQueue(requireTaskStore(deps));
        const panel = deps.missionControlService.getStabilityPanel(readLimit(ctx.request, 50));
        const queues = buildAdminQueueSnapshot(panel);
        return buildJsonResponse(ctx.requestId, 200, {
          cleanedTaskIds: result.cleanedTaskIds,
          invalidatedTicketIds: result.invalidatedTicketIds,
          cleanedCount: result.cleanedTaskIds.length,
          queues,
          total: queues.length,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/preferences",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, readUserPreferenceState(principal));
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/roles",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const roles = listAdminRoles();
        return buildJsonResponse(ctx.requestId, 200, {
          roles,
          total: roles.length,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/feature-flags",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const featureFlags = listFeatureFlags();
        return buildJsonResponse(ctx.requestId, 200, {
          featureFlags,
          total: featureFlags.length,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/system-config",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        return buildJsonResponse(ctx.requestId, 200, readSystemConfig());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/models",
      handler: async (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const models = await readModelConfigs(deps);
        return buildJsonResponse(ctx.requestId, 200, {
          models,
          total: models.length,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/domains",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const domains = listDomainConfigs(deps);
        return buildJsonResponse(ctx.requestId, 200, {
          domains,
          total: domains.length,
        });
      },
    },
    {
      method: "PUT",
      pathname: "/v1/preferences",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, (input) =>
          input != null && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {},
        );
        const currentState = readUserPreferenceState(principal);

        const nextState: UserPreferenceState = {
          locale: typeof payload.locale === "string" && payload.locale.trim().length > 0
            ? payload.locale
            : currentState.locale,
          theme:
            payload.theme === "light" || payload.theme === "dark" || payload.theme === "high-contrast"
              ? payload.theme
              : currentState.theme,
          defaultDashboardLayout: Array.isArray(payload.defaultDashboardLayout)
            ? payload.defaultDashboardLayout.filter((item): item is string => typeof item === "string" && item.length > 0)
            : currentState.defaultDashboardLayout,
        };
        userPreferenceState.set(buildUserPreferenceStateKey(principal), nextState);

        return buildJsonResponse(ctx.requestId, 200, nextState);
      },
    },
    // POST /v1/admin/config - Update configuration
    {
      method: "POST",
      pathname: "/v1/admin/config",
      handler: (ctx) => applyAdminConfigUpdate(ctx, deps),
    },
    {
      method: "PUT",
      pathname: "/v1/admin/config",
      handler: (ctx) => applyAdminConfigUpdate(ctx, deps),
    },
    {
      method: "DELETE",
      pathname: "/v1/admin/config",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin config delete");
        const payload = readValidatedJsonBody(ctx.request.body, adminConfigUpdateSchema.parse);
        const tenantId = resolveTenantScope(principal, payload.tenantId);
        const record = deps.adminConfigService?.deleteConfig({
          key: payload.key,
          ...(tenantId !== undefined ? { tenantId } : {}),
          deletedBy: principal.actorId,
        }) ?? {
          success: true,
          key: payload.key,
          tenantId: tenantId ?? null,
          deletedAt: new Date().toISOString(),
          deletedBy: principal.actorId,
        };
        return buildJsonResponse(ctx.requestId, 200, { success: true, record });
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/panic-directives",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "panic directives");
        const payload = readValidatedJsonBody(ctx.request.body, panicDirectiveSchema.parse);
        const service = deps.adminRuntimeDirectiveService;
        if (service == null) {
          throw new ApiError(503, "api.panic_directives_unavailable", "Panic directive service is not configured.");
        }
        try {
          const activation = service.issuePanicDirective({
            scope: payload.scope,
            reasonCode: payload.reasonCode,
            activeIncidents: payload.activeIncidents,
            issuedBy: principal.actorId,
            ...(payload.freezeModes != null ? { freezeModes: payload.freezeModes } : {}),
            ...(payload.requiredApprovers != null ? { requiredApprovers: payload.requiredApprovers } : {}),
            ...(payload.allowList != null ? { allowList: payload.allowList } : {}),
            ...(payload.targetScopes != null ? { targetScopes: payload.targetScopes } : {}),
            ...(payload.forensicArtifactIds != null ? { forensicArtifactIds: payload.forensicArtifactIds } : {}),
            ...(payload.severity != null ? { severity: payload.severity } : {}),
            ...(payload.triggerSignals != null ? { triggerSignals: payload.triggerSignals } : {}),
          });
          return buildJsonResponse(ctx.requestId, 200, {
            success: true,
            directive: activation.directive,
            propagationRecords: activation.propagationRecords,
            acknowledgments: activation.acknowledgments,
            forensicSnapshot: activation.forensicSnapshot,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "panic.directive_failed";
          if (message.includes("directive_rejected")) {
            throw new ApiError(409, "api.panic_directive_rejected", "Panic directive prerequisites were not satisfied.");
          }
          if (message.includes("required_approvers") || message.includes("invalid_scope_level")) {
            throw new ApiError(400, "api.panic_directive_invalid", message);
          }
          throw error;
        }
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/resume-directives",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "admin");
        const payload = readValidatedJsonBody(ctx.request.body, resumeDirectiveSchema.parse);
        const service = deps.adminRuntimeDirectiveService;
        if (service == null) {
          throw new ApiError(503, "api.resume_directives_unavailable", "Resume directive service is not configured.");
        }
        const receipt = service.submitResumeDirective(payload as ResumePlan);
        if (!receipt.resumed) {
          if (receipt.directiveId == null) {
            throw new ApiError(404, "api.resume_directive_not_found", "No active panic directive matched the requested scope.");
          }
          throw new ApiError(409, "api.resume_directive_rejected", "Resume directive prerequisites were not satisfied.");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          success: true,
          receipt,
        });
      },
    },
    // GET /v1/admin/rollouts - List rollout configurations
    {
      method: "GET",
      pathname: "/v1/admin/rollouts",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const rollouts = deps.configRolloutService?.getActiveRollouts() ?? [];
        return buildJsonResponse(ctx.requestId, 200, {
          rollouts,
          total: rollouts.length,
        });
      },
    },
    // GET /v1/admin/tenants - List tenants
    {
      method: "GET",
      pathname: "/v1/admin/tenants",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin tenants list");
        const limit = readLimit(ctx.request, 50);
        const tenants = deps.tenantRegistryService?.listTenants(limit) ?? [];
        return buildJsonResponse(ctx.requestId, 200, {
          tenants,
          total: tenants.length,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/webhooks",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const webhooks = listWebhookSummaries(deps.webhookIngressService);
        return buildJsonResponse(ctx.requestId, 200, {
          webhooks,
          total: webhooks.length,
        });
      },
    },
    // GET /v1/admin/budgets - List budgets
    {
      method: "GET",
      pathname: "/v1/admin/budgets",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const tenantId = resolveTenantScope(principal, undefined);
        const budgets = deps.costReportService?.listBudgetSummaries(50, tenantId) ?? [];
        return buildJsonResponse(ctx.requestId, 200, {
          budgets,
          total: budgets.length,
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/chargeback/reports",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const tenantId = resolveTenantScope(principal, undefined);
        const limit = readLimit(ctx.request, 500);
        if (deps.costReportService == null) {
          throw new ApiError(503, "api.cost_reports_unavailable", "Cost reporting is not configured.");
        }
        const report = new ChargebackService(deps.costReportService).buildReport({
          limit,
          ...(tenantId !== undefined ? { tenantId } : {}),
        });
        return buildJsonResponse(ctx.requestId, 200, report);
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/benchmarks",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "benchmark inventories");
        return buildJsonResponse(ctx.requestId, 200, new BenchmarkInventoryService().listBenchmarks());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/projections",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "projection inventories");
        return buildJsonResponse(ctx.requestId, 200, new ProjectionInventoryService().listProjectionInventory());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/deployments",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "deployment inventories");
        return buildJsonResponse(ctx.requestId, 200, new DeploymentInventoryService().listDeployments());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/schema",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "schema inventories");
        const service = new SchemaInventoryService();
        return buildJsonResponse(ctx.requestId, 200, {
          summary: service.buildSummary(),
          tables: service.listTables(),
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/judges",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "judge inventories");
        const registry = new JudgeProviderRegistryService();
        registry.registerDefaults();
        return buildJsonResponse(ctx.requestId, 200, registry.listDescriptors());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/compliance/program-templates",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "compliance program templates");
        return buildJsonResponse(ctx.requestId, 200, new ComplianceProgramTemplateService().listTemplates());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/compliance/policies",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "compliance policies");
        return buildJsonResponse(ctx.requestId, 200, await listCompliancePoliciesSnapshot(deps));
      },
    },
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "admin"
          || segments[2] !== "compliance"
          || segments[3] !== "policies"
          || segments.length !== 5
        ) {
          return null;
        }
        return (async () => {
          const principal = requirePrincipal(ctx.request, deps.authService, "admin");
          assertGlobalTenantScopeSupported(principal, "compliance policy update");
          const payload = readValidatedJsonBody(ctx.request.body, compliancePolicyPatchSchema.parse);
          const policy = await updateCompliancePolicyRecord(deps, principal, segments[4] ?? "", payload);
          return buildJsonResponse(ctx.requestId, 200, {
            ok: true,
            body: policy,
          });
        })();
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/audit-logs",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "audit logs");
        return buildJsonResponse(ctx.requestId, 200, await readAuditLogSnapshot(deps));
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/compliance/exceptions",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "compliance exceptions");
        const payload = readValidatedJsonBody(ctx.request.body, complianceExceptionCreateSchema.parse);
        const record = await createComplianceExceptionRecord(deps, principal, payload);
        return buildJsonResponse(ctx.requestId, 201, { id: record.id });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/compliance/exceptions",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "compliance exceptions");
        return buildJsonResponse(ctx.requestId, 200, await readComplianceExceptions(deps));
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "admin"
          || segments[2] !== "compliance"
          || segments[3] !== "exceptions"
          || segments.length !== 6
          || !["approve", "reject"].includes(segments[5] ?? "")
        ) {
          return null;
        }
        return (async () => {
          const principal = requirePrincipal(ctx.request, deps.authService, "admin");
          assertGlobalTenantScopeSupported(principal, "compliance exceptions");
          const exceptionId = segments[4] ?? "";
          if (segments[5] === "approve") {
            readValidatedJsonBody(ctx.request.body, complianceExceptionApproveSchema.parse);
            const record = await updateComplianceExceptionRecord(deps, principal, exceptionId, "approved");
            return buildJsonResponse(ctx.requestId, 200, {
              ok: true,
              body: record,
            });
          }
          const payload = readValidatedJsonBody(ctx.request.body, complianceExceptionRejectSchema.parse);
          const record = await updateComplianceExceptionRecord(deps, principal, exceptionId, "rejected", payload.rationale);
          return buildJsonResponse(ctx.requestId, 200, {
            ok: true,
            body: record,
          });
        })();
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/governance/division-inventory",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "division inventory governance");
        return buildJsonResponse(ctx.requestId, 200, await readDivisionInventorySnapshot(deps));
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/governance/leadership-claims",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "leadership claims governance");
        const service = new LeadershipClaimsGovernanceService();
        return buildJsonResponse(ctx.requestId, 200, service.buildConsoleSnapshot());
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/governance/leadership-claims/review-requests",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "leadership claims governance");
        const payload = readValidatedJsonBody(ctx.request.body, leadershipClaimReviewRequestSchema.parse);
        const service = new LeadershipClaimsGovernanceService();
        const reviewRequest = service.submitReviewRequest({
          familyId: payload.familyId,
          ...(payload.divisionId != null ? { divisionId: payload.divisionId } : {}),
          ...(payload.scenarioId != null ? { scenarioId: payload.scenarioId } : {}),
          requestedClaimLevel: payload.requestedClaimLevel,
          requestedSurfaces: payload.requestedSurfaces,
          evidenceRefs: payload.evidenceRefs,
          requestedBy: principal.actorId,
          rationale: payload.rationale,
        });
        await appendAuditTrailRecord(deps, {
          actorId: principal.actorId,
          action: "leadership_claim.review_requested",
          resourceRef: `leadership-claim-review-request:${reviewRequest.requestId}`,
          outcome: "pending",
          metadata: {
            familyId: reviewRequest.familyId,
            ...(reviewRequest.divisionId == null ? {} : { divisionId: reviewRequest.divisionId }),
            ...(reviewRequest.scenarioId == null ? {} : { scenarioId: reviewRequest.scenarioId }),
            requestedClaimLevel: reviewRequest.requestedClaimLevel,
            requestedSurfaces: [...reviewRequest.requestedSurfaces],
            evidenceRefs: [...reviewRequest.evidenceRefs],
          },
        });
        return buildJsonResponse(ctx.requestId, 201, { reviewRequest });
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "admin"
          || segments[2] !== "governance"
          || segments[3] !== "leadership-claims"
          || segments[4] !== "review-requests"
          || segments.length !== 7
          || !["approve", "reject"].includes(segments[6] ?? "")
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "leadership claims governance");
        const payload = readValidatedJsonBody(ctx.request.body, leadershipClaimReviewDecisionSchema.parse);
        const service = new LeadershipClaimsGovernanceService();
        return (async () => {
          try {
            const reviewRequest = segments[6] === "approve"
              ? service.approveReviewRequest({
                requestId: segments[5] ?? "",
                reviewedBy: principal.actorId,
                reasonCode: payload.reasonCode,
                ...(payload.comment != null ? { comment: payload.comment } : {}),
              })
              : service.rejectReviewRequest({
                requestId: segments[5] ?? "",
                reviewedBy: principal.actorId,
                reasonCode: payload.reasonCode,
                ...(payload.comment != null ? { comment: payload.comment } : {}),
              });
            await appendAuditTrailRecord(deps, {
              actorId: principal.actorId,
              action: `leadership_claim.review_${reviewRequest.status}`,
              resourceRef: `leadership-claim-review-request:${reviewRequest.requestId}`,
              outcome: reviewRequest.status,
              metadata: {
                familyId: reviewRequest.familyId,
                requestedClaimLevel: reviewRequest.requestedClaimLevel,
                reasonCode: reviewRequest.decisionReasonCode,
                ...(reviewRequest.decisionComment == null ? {} : { comment: reviewRequest.decisionComment }),
              },
            });
            return buildJsonResponse(ctx.requestId, 200, { reviewRequest });
          } catch (error) {
            const message = error instanceof Error ? error.message : "leadership_claim.review_request_failed";
            if (message.includes("review_request_not_found")) {
              throw new ApiError(404, "api.leadership_claim_review_not_found", "Leadership claim review request was not found.");
            }
            if (message.includes("review_request_not_pending")) {
              throw new ApiError(409, "api.leadership_claim_review_not_pending", "Leadership claim review request is no longer pending.");
            }
            throw error;
          }
        })();
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "admin"
          || segments[2] !== "governance"
          || segments[3] !== "leadership-claims"
          || segments.length !== 6
          || segments[5] !== "revoke"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "leadership claims governance");
        const payload = readValidatedJsonBody(ctx.request.body, leadershipClaimRevokeSchema.parse);
        const service = new LeadershipClaimsGovernanceService();
        return (async () => {
          try {
            const statusOverride = service.revokeClaim({
              claimId: segments[4] ?? "",
              reasonCode: payload.reasonCode,
              replacementRequired: payload.replacementRequired,
              revokedBy: principal.actorId,
              ...(payload.comment != null ? { comment: payload.comment } : {}),
            });
            await appendAuditTrailRecord(deps, {
              actorId: principal.actorId,
              action: "leadership_claim.revoked",
              resourceRef: `leadership-claim:${statusOverride.claimId}`,
              outcome: statusOverride.status,
              metadata: {
                reasonCode: statusOverride.reasonCode,
                replacementRequired: statusOverride.replacementRequired,
                ...(statusOverride.comment == null ? {} : { comment: statusOverride.comment }),
              },
            });
            return buildJsonResponse(ctx.requestId, 200, { statusOverride });
          } catch (error) {
            const message = error instanceof Error ? error.message : "leadership_claim.revoke_failed";
            if (message.includes("claim_not_found")) {
              throw new ApiError(404, "api.leadership_claim_not_found", "Leadership claim was not found.");
            }
            throw error;
          }
        })();
      },
    },
  ];
}
