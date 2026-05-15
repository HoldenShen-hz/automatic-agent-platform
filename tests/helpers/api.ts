import { join } from "node:path";

import { ApiAuthService } from "../../src/platform/five-plane-interface/api/api-auth-service.js";
import { ApprovalService } from "../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { HttpApiServer } from "../../src/platform/five-plane-interface/api/http-api-server.js";
import { MissionControlService } from "../../src/platform/five-plane-interface/api/mission-control-service.js";
import { GatewayTargetDirectoryService } from "../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { MetricsService } from "../../src/platform/shared/observability/metrics-service.js";
import { PrometheusMetricsExporter } from "../../src/platform/shared/observability/prometheus-metrics-exporter.js";
import { HumanTakeoverService } from "../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import { BillingService } from "../../src/scale-ecosystem/marketplace/billing-service.js";
import { PerceptionService } from "../../src/scale-ecosystem/marketplace/perception-service.js";
import { PMF_EVALUATED_AT, seedPmfValidationDataset } from "./pmf.js";
import { PmfValidationService } from "../../src/scale-ecosystem/marketplace/pmf-validation-service.js";
import { runSingleTaskExecution } from "../../src/platform/five-plane-execution/execution-engine/single-task-execution.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { ArtifactPlaneService } from "../../src/platform/five-plane-state-evidence/artifacts/artifact-plane-service.js";
import { DomainRegistryService } from "../../src/domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../src/domains/registry/plugin-spi-registry.js";
import type { RetrieverKnowledgeResult } from "../../src/domains/registry/plugin-spi.js";
import { KnowledgePlaneService } from "../../src/platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";
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

export function createSeededApiContext(workspace: string, options: SeededApiContextOptions = {}): SeededApiContext {
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
  const pmf = new PmfValidationService(db, store);
  seedPmfValidationDataset(db, store);
  pmf.runValidation({
    profileName: "phase3_default",
    evaluatedAt: PMF_EVALUATED_AT,
    windowDays: 14,
  });

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
  if (executionId != null) {
    const takeover = new HumanTakeoverService(db, store);
    takeoverSessionId = takeover.openSession({
      taskId,
      operatorId: "operator-1",
      reasonCode: "api.seed_takeover",
    }).takeoverSessionId;
  }

  const healthService = new HealthService(db, store);
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

  let pluginKnowledgeRef: RetrieverKnowledgeResult = { knowledgeRef: "knowledge:missing", snippet: "Missing chunk", score: 0.5, namespace: "coding.repo", chunkId: "chunk:missing", documentId: "doc:missing", matchType: "keyword" };
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
        bundleId: "coding-default",
        tools: [
          { toolName: "repo_map", enabled: true, configOverrides: {} },
          { toolName: "apply_patch", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["bugfix"],
      requiredTools: ["repo_map"],
      optionalTools: ["apply_patch"],
      modelPreferences: { primary: "gpt-5.2" },
      budgetLimits: { maxTokensPerTask: 6000, maxCostPerTask: 4 },
      securityLevel: "standard",
    },
    status: "validated",
    externalAdapters: ["github"],
    pluginBindings: [
      {
        bindingId: "binding.retriever",
        domainId: "coding",
        pluginType: "retriever",
        pluginId: "plugin.coding.retriever",
        priority: 10,
        enabled: true,
        config: {},
      },
      {
        bindingId: "binding.presenter",
        domainId: "coding",
        pluginType: "tool",
        bindingRole: "presenter",
        pluginId: "plugin.coding.presenter",
        priority: 5,
        enabled: true,
        config: {},
      },
    ],
  });
  knowledgePlaneService.registerNamespace({
    namespaceId: "ns_coding_repo",
    path: "coding.repo",
    description: "Coding repo knowledge",
    ownerDomainId: "coding",
    accessPolicy: "domain_only",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    },
    trustLevel: "authoritative",
    maxDocuments: 100,
    maxTotalSizeBytes: 1000000,
  });
  knowledgePlaneService.ingest({
    title: "Build troubleshooting",
    body: "Retry the build after clearing stale caches.",
    namespace: "coding.repo",
    sourceType: "text",
    trustLevel: "authoritative",
  });
  const pluginRecord = knowledgePlaneService.ingest({
    title: "Plugin knowledge",
    body: "Plugin supplied snippet",
    namespace: "coding.repo",
    sourceType: "text",
    trustLevel: "authoritative",
  });
  pluginKnowledgeRef = { knowledgeRef: `knowledge:${pluginRecord.chunks[0]?.chunkId ?? "missing"}`, snippet: "Plugin supplied snippet", score: 0.9, namespace: "coding.repo", chunkId: pluginRecord.chunks[0]?.chunkId ?? "chunk:missing", documentId: "doc:plugin", matchType: "semantic" as const };

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
    createServer() {
      return new HttpApiServer({
        approvalService: approvals,
        authService,
        inspectService,
        missionControlService,
        gatewayTargetDirectoryService: gatewayTargets,
        prometheusMetricsExporter,
        billingService: billing,
        knowledgePlaneService,
        artifactPlaneService,
        domainRegistryService,
        pluginRegistry,
      });
    },
  };
}
