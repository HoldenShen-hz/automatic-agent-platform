import { join } from "node:path";

import { ApiAuthService } from "../platform/five-plane-interface/api/api-auth-service.js";
import { ApprovalService } from "../platform/five-plane-control-plane/approval-center/approval-service.js";
import { HttpApiServer } from "../platform/five-plane-interface/api/http-api-server.js";
import { MissionControlService } from "../platform/five-plane-interface/api/mission-control-service.js";
import { GatewayTargetDirectoryService } from "../platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { HealthService } from "../platform/shared/observability/health-service.js";
import { InspectService } from "../platform/shared/observability/inspect-service.js";
import { MetricsService } from "../platform/shared/observability/metrics-service.js";
import { PrometheusMetricsExporter } from "../platform/shared/observability/prometheus-metrics-exporter.js";
import { configureAuditIntegrity } from "../platform/five-plane-control-plane/iam/audit-event-integrity.js";
import { BillingService } from "../scale-ecosystem/marketplace/billing-service.js";
import { PerceptionService } from "../scale-ecosystem/marketplace/perception-service.js";
import { runSingleTaskExecution } from "../platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { AuthoritativeTaskStore } from "../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../platform/five-plane-state-evidence/truth/sqlite-database.js";
import { ArtifactPlaneService } from "../platform/five-plane-state-evidence/artifacts/artifact-plane-service.js";
import { DomainRegistryService } from "../domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../domains/registry/plugin-spi-registry.js";
import type { RetrieverKnowledgeResult } from "../domains/registry/plugin-spi.js";
import { KnowledgePlaneService } from "../platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import { seedBillingDataset } from "./billing.js";
import { seedPerceptionDataset } from "./perception.js";

export interface SeededApiContext {
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  billingService: BillingService;
  approvalService: ApprovalService;
  authService: ApiAuthService;
  inspectService: InspectService;
  missionControlService: MissionControlService;
  gatewayTargetDirectoryService: GatewayTargetDirectoryService;
  knowledgePlaneService: KnowledgePlaneService;
  artifactPlaneService: ArtifactPlaneService;
  domainRegistryService: DomainRegistryService;
  pluginRegistry: PluginSpiRegistry;
  seededTaskId: string;
  approvalId: string;
  seededWorkerId: string;
  takeoverSessionId: string | null;
  createServer(): HttpApiServer;
}

export interface SeededApiContextOptions {
  tenantId?: string | null;
}

const TEST_AUDIT_INTEGRITY_HMAC_KEY = "testing-audit-integrity-key-012345";

export function createSeededApiContext(workspace: string, options: SeededApiContextOptions = {}): SeededApiContext {
  configureAuditIntegrity({
    hmacKey: TEST_AUDIT_INTEGRITY_HMAC_KEY,
    isProduction: true,
  });
  const dbPath = join(workspace, "api.db");
  runSingleTaskExecution({
    dbPath,
    title: "API seeded task",
    request: "Seed the minimal productized API baseline.",
    ...(options.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
  });

  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  seedBillingDataset(db, store);
  const perception = new PerceptionService(db, store);
  seedPerceptionDataset(db, store);

  const billing = new BillingService(db, store);
  billing.evaluateEntitlement({
    accountId: "acct-pro-1",
    featureKey: "phase3.web_console",
    metricType: "premium_feature_activation",
    requestedQuantity: 1,
    evaluatedAt: "2026-04-08T12:10:00.000Z",
  });

  const approvals = new ApprovalService(db, store);
  const gatewayTargets = new GatewayTargetDirectoryService(store);
  const seededTask = store
    .listTasks(200)
    .find(
      (task) =>
        task.title === "API seeded task"
        && (options.tenantId === undefined || (task.tenantId ?? null) === (options.tenantId ?? null)),
    )
    ?? store.listTasks(1)[0];
  const taskId = seededTask?.id;
  if (!taskId) {
    throw new Error("api.seed_task_missing");
  }
  const executionId = store.listExecutionsByTask(taskId)[0]?.id ?? null;
  const nowIso = new Date().toISOString();
  const seededWorkerId = "worker-api-1";

  const approval = approvals.createRequest({
    taskId,
    executionId,
    sourceAgentId: "operator_gate",
    reason: "Need explicit confirmation before productized API action.",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: {
      surface: "api",
      feature: "phase3.web_console",
      perceptionSourceCount: perception.listSources().length,
    },
    timeoutPolicy: "reject",
  });

  store.upsertWorkerSnapshot({
    workerId: seededWorkerId,
    version: 0,
    status: "busy",
    placement: "local",
    isolationLevel: "standard",
    capabilitiesJson: JSON.stringify(["bash", "write"]),
    runningExecutionsJson: JSON.stringify(executionId ? [executionId] : []),
    maxConcurrency: 1,
    queueAffinity: "default",
    runtimeInstanceId: "runtime-api-1",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 32,
    memoryMb: 128,
    toolBacklogCount: 1,
    currentStepId: "respond",
    lastProgressAt: nowIso,
    lastHeartbeatAt: nowIso,
    updatedAt: nowIso,
  });

  let takeoverSessionId: string | null = null;

  const healthService = new HealthService(db, store, {
    tier1AckDegradedThreshold: 100,
  });
  const metricsService = new MetricsService(db, healthService);
  const prometheusMetricsExporter = new PrometheusMetricsExporter(db, metricsService);
  const inspectService = new InspectService(store);
  const pluginRegistry = new PluginSpiRegistry();
  const domainRegistryService = new DomainRegistryService({ pluginRegistry });
  const knowledgePlaneService = new KnowledgePlaneService({
    domainRegistry: domainRegistryService,
    pluginRegistry,
  });
  const artifactPlaneService = new ArtifactPlaneService();
  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "test-api-key",
        actorId: "operator-1",
        roles: ["viewer", "operator", "admin"],
      },
    ],
    jwtSecret: "test-jwt-secret-for-integration-tests",
  });
  gatewayTargets.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "finance-team",
    displayName: "Finance Team",
    aliases: ["finance", "fin-team"],
  });
  const missionControlService = new MissionControlService(store, healthService, metricsService, inspectService, {
    gatewayTargetDirectoryService: gatewayTargets,
  });

  let pluginKnowledgeRef: RetrieverKnowledgeResult = {
    knowledgeRef: "knowledge:missing",
    snippet: "Missing chunk",
    score: 0.5,
    namespace: "coding.repo",
    chunkId: "chunk:missing",
    documentId: "doc:missing",
    matchType: "keyword",
  };
  pluginRegistry.register({
    pluginId: "plugin.coding.retriever",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [pluginKnowledgeRef];
    },
  }, {
    pluginId: "plugin.coding.retriever",
    name: "coding retriever",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: ["knowledge.retrieve"],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    outputDataClass: "internal",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: ["coding.repo"],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  });
  pluginRegistry.register({
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    spiType: "presenter",
    async formatOutput() {
      return { summary: "ok", sections: [], citations: [] };
    },
  }, {
    pluginId: "plugin.coding.presenter",
    name: "coding presenter",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: ["present.output"],
    spiTypes: ["presenter"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    outputDataClass: "internal",
    publicSdkSurface: "tests/mock",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 1000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  });
  domainRegistryService.register({
    domainId: "coding",
    name: "Coding",
    description: "Coding workflows",
    version: 1,
    workflows: [
      {
        workflowId: "wf_build",
        name: "Build",
        triggerConditions: {},
        steps: [],
      },
    ],
    toolBundles: [
      {
        bundleId: "bundle.build",
        tools: [],
      },
    ],
    knowledgeNamespaces: [
      {
        namespaceId: "ns_coding_repo",
        ownerDomainId: "coding",
        path: "coding.repo",
        description: "Repository knowledge",
      },
    ],
  } as any);
  knowledgePlaneService.registerNamespace({
    namespaceId: "ns_coding_repo",
    ownerDomainId: "coding",
    path: "coding.repo",
    description: "Repository knowledge",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "trusted",
    accessPolicy: {
      visibility: "internal",
      allowedTenants: [],
      allowedRoles: [],
    },
    maxDocuments: 100,
    maxTotalSizeBytes: 10 * 1024 * 1024,
  } as any);

  pluginKnowledgeRef = {
    knowledgeRef: "knowledge:coding:repo:1",
    snippet: "Build with npm run build",
    score: 0.91,
    namespace: "coding.repo",
    chunkId: "chunk:coding:1",
    documentId: "doc:coding:1",
    matchType: "semantic",
  };

  const createServer = () => new HttpApiServer({
    approvalService: approvals,
    gatewayTargetDirectoryService: gatewayTargets,
    authService,
    inspectService,
    missionControlService,
    prometheusMetricsExporter,
    billingService: billing,
    knowledgePlaneService,
    artifactPlaneService,
    domainRegistryService,
    pluginRegistry,
    taskStore: store,
  });

  return {
    db,
    store,
    billingService: billing,
    approvalService: approvals,
    authService,
    inspectService,
    missionControlService,
    gatewayTargetDirectoryService: gatewayTargets,
    knowledgePlaneService,
    artifactPlaneService,
    domainRegistryService,
    pluginRegistry,
    seededTaskId: taskId,
    approvalId: approval.approvalId,
    seededWorkerId,
    takeoverSessionId,
    createServer,
  };
}
