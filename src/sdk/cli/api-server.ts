/**
 * API Server CLI
 *
 * This module provides the main HTTP API server entry point for the Automatic Agent system.
 * It initializes all core services (health, metrics, approvals, gateway, billing), starts the
 * HTTP server with optional authentication, and registers graceful shutdown handlers for clean
 * termination.
 *
 * Environment Variables (via loadApiServerEnv):
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *   - AA_API_HOST: Optional host to bind the server to
 *   - AA_API_PORT: Optional port to listen on
 *   - AA_LOG_FILE_PATH: Optional path for structured log output
 *   - AA_LOG_FILE_MAX_BYTES: Max size of each log file
 *   - AA_LOG_FILE_MAX_FILES: Number of rotated log files to retain
 *   - AA_WEBHOOK_SECRET: Secret for webhook signature verification
 *   - AA_API_JWT_SECRET: Secret for JWT authentication
 *   - AA_API_KEYS / AA_API_KEYS_JSON: API key auth configuration
 *
 * Usage: npm run api-server
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for system architecture
 * @see {@link docs_zh/contracts/observability_contract.md} for health and metrics
 */

import { join } from "node:path";

import { resolveCliDbPath, withPersistentCliStorageAsync } from "./authoritative-storage.js";
import { readCliProcessEnv } from "./cli-env.js";
import { isCliEntryPoint, runCliMain } from "./cli-exit.js";
import { summarizeCliError } from "./cli-file-guards.js";
import { ChannelGatewayService } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-service.js";
import { ChannelGatewayDeliveryService } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-delivery-service.js";
import { CHANNEL_DELIVERY_DDL } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";
import { ChannelGatewayRetryExecutor } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.js";
import { GatewayTargetDirectoryService } from "../../platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import { GatewayStorageAdapter } from "../../platform/five-plane-interface/channel-gateway/storage-adapter.js";
import { ApprovalService } from "../../platform/five-plane-control-plane/approval-center/approval-service.js";
import { ApiAuthService } from "../../platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer } from "../../platform/five-plane-interface/api/http-api-server.js";
import { MissionControlService } from "../../platform/five-plane-interface/api/mission-control-service.js";
import { TaskWebSocketStatusRelay } from "../../platform/five-plane-interface/api/task-websocket-status-relay.js";
import { loadApiServerEnv } from "../../platform/five-plane-control-plane/config-center/api-server-env.js";
import { resolveConfigWorkspaceRoot } from "../../platform/five-plane-control-plane/config-center/runtime-env.js";
import { requireValidStartupEnv } from "../../platform/five-plane-control-plane/config-center/startup-env-schema.js";
import { TypedEventBus } from "../../platform/five-plane-state-evidence/events/typed-event-bus.js";
import { TypedEventBusPublisher } from "../../platform/five-plane-state-evidence/events/typed-event-publisher.js";
import { DomainEventFeedbackConsumer } from "../../scale-ecosystem/feedback-loop/collector/domain-event-feedback-consumer.js";
import { InspectService } from "../../platform/shared/observability/inspect-service.js";
import { HealthService } from "../../platform/shared/observability/health-service.js";
import { configureStructuredLogTransports } from "../../platform/shared/observability/log-transport-bootstrap.js";
import { createMetricsServer } from "../../platform/shared/observability/metrics-server.js";
import { MetricsService } from "../../platform/shared/observability/metrics-service.js";
import { initOtel, shutdownOtel } from "../../platform/shared/observability/otel-bootstrap.js";
import { PrometheusMetricsExporter } from "../../platform/shared/observability/prometheus-metrics-exporter.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { CoordinatorLoadBalancingService } from "../../platform/five-plane-execution/ha/coordinator-load-balancing-service.js";
import { getGlobalGracefulShutdown } from "../../platform/five-plane-execution/startup/graceful-shutdown.js";
import { registerProcessErrorHandlers } from "../../platform/five-plane-execution/startup/process-error-handlers.js";
import { getModelCallProvider, resetModelCallProvider } from "../../platform/five-plane-execution/execution-engine/model-call-provider.js";
import { getProcessTracker, resetProcessTracker } from "../../platform/five-plane-execution/resource/process-tracker.js";
import { BillingService } from "../../scale-ecosystem/billing/billing-service.js";
import { ArtifactPublishLedger } from "../../platform/five-plane-state-evidence/artifacts/artifact-publish-ledger.js";
import { ArtifactPublishService } from "../../platform/five-plane-state-evidence/artifacts/artifact-publish-service.js";
import { ArtifactPlaneService } from "../../platform/five-plane-state-evidence/artifacts/artifact-plane-service.js";
import { bootstrapConfiguredRegistries } from "../../domains/registry/registry-bootstrap.js";
import { KnowledgeSnapshotStore } from "../../platform/five-plane-state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import { KnowledgePlaneService } from "../../platform/five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import { createSemanticVectorStoreFromEnvironment } from "../../platform/five-plane-state-evidence/knowledge/semantic-vector-store.js";

/**
 * Main entry point for the API server.
 *
 * Initializes the database, creates all required services (health, metrics, gateway, billing, etc.),
 * starts the HTTP server, and registers graceful shutdown handlers to ensure clean termination.
 */
async function main(): Promise<void> {
  const env = readCliProcessEnv();
  // GAP-V2-06: Validate startup environment variables before any other initialization.
  // process.exit(1) if critical env vars are invalid or missing.
  requireValidStartupEnv(env);

  const envConfig = loadApiServerEnv(env);
  await initOtel({
    enabled: envConfig.otelEnabled,
    endpoint: envConfig.otelEndpoint,
    serviceName: envConfig.otelServiceName,
    serviceVersion: envConfig.otelServiceVersion,
    instrumentHttp: true,
  });

  // Configure structured logging to file if path is provided
  StructuredLogger.configureGlobalFileSink(
    envConfig.logFilePath == null
      ? null
      : {
        filePath: envConfig.logFilePath,
        maxBytes: envConfig.logFileMaxBytes,
        maxFiles: envConfig.logFileMaxFiles,
      },
  );
  const enabledLogTransports = configureStructuredLogTransports({
    stdout: envConfig.logStdout,
    fluentd: envConfig.logFluentd,
    datadog: envConfig.logDatadog,
  });
  const shutdown = getGlobalGracefulShutdown();
  shutdown.registerSignalHandlers();
  registerProcessErrorHandlers(shutdown);
  const startupCleanup: Array<() => Promise<void>> = [];
  let startupComplete = false;
  const registerManagedHandler = (name: string, handler: () => Promise<void>): void => {
    shutdown.addHandler({ name, handler });
    startupCleanup.push(handler);
  };

  registerManagedHandler("structured_logger_transports", async () => {
    await StructuredLogger.flushTransports();
    await StructuredLogger.closeTransports();
  });
  registerManagedHandler("otel_sdk", async () => {
    await shutdownOtel();
  });

  try {
    await withPersistentCliStorageAsync(async (storage) => {
    const db = storage.sql;
    const store = storage.store;
    const dataRoot = join(resolveConfigWorkspaceRoot(), "data");

    // Initialize core observability services
    const health = new HealthService(db, store);
    const metrics = new MetricsService(db, health);
    const prometheusMetricsExporter = new PrometheusMetricsExporter(db, metrics);
    const inspect = new InspectService(store);
    const typedEventBus = new TypedEventBus(db, store);
    registerManagedHandler("typed_event_bus", async () => {
      typedEventBus.dispose();
    });
    const eventPublisher = new TypedEventBusPublisher(typedEventBus);
    const domainEventFeedbackConsumer = new DomainEventFeedbackConsumer();
    domainEventFeedbackConsumer.subscribe(typedEventBus);
    const registryBootstrap = bootstrapConfiguredRegistries({ eventPublisher });
    const pluginRegistry = registryBootstrap.pluginRegistry;
    const domainRegistry = registryBootstrap.domainRegistry;
    const semanticVectorStore = createSemanticVectorStoreFromEnvironment({
      env,
      storageDriver: storage.driver,
      database: storage.asyncSql,
    });
    const knowledgePlane = new KnowledgePlaneService({
      domainRegistry,
      pluginRegistry,
      eventPublisher,
      semanticVectorStore,
      snapshotStore: new KnowledgeSnapshotStore({
        snapshotPath: join(dataRoot, "knowledge", "knowledge-plane.snapshot.json"),
      }),
    });
    for (const namespace of registryBootstrap.knowledgeNamespaces) {
      domainRegistry.registerKnowledgeNamespace(namespace.path, namespace.ownerDomainId);
      knowledgePlane.registerNamespace(namespace);
    }
    await knowledgePlane.initialize();
    const artifactPlane = new ArtifactPlaneService(
      undefined,
      undefined,
      undefined,
      new ArtifactPublishService(new ArtifactPublishLedger({
        ledgerPath: join(dataRoot, "artifacts", "publish-ledger.jsonl"),
      })),
    );
    const metricsServer = envConfig.metricsPort == null
      ? null
      : createMetricsServer(prometheusMetricsExporter);
    registerManagedHandler("metrics_server", async () => {
      if (metricsServer == null || !metricsServer.listening) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        metricsServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    });

    // Initialize approval and gateway services
    const approvals = new ApprovalService(db, store);
    const gatewayStorage = new GatewayStorageAdapter(store);
    const gatewayTargets = new GatewayTargetDirectoryService(gatewayStorage);

    // Initialize channel delivery DDL and services
    db.connection.exec(CHANNEL_DELIVERY_DDL);
    const channelGatewayDelivery = new ChannelGatewayDeliveryService(db);

    // Initialize billing service
    const billingService = new BillingService(db, store);

    // Initialize optional authentication service if keys and secret are provided
    const authService = (() => {
      if (envConfig.apiKeys.length === 0 || envConfig.jwtSecret == null) {
        return null;
      }
      return new ApiAuthService({
        apiKeys: envConfig.apiKeys,
        jwtSecret: envConfig.jwtSecret,
      });
    })();

    // Initialize the main channel gateway service with all dependencies
    const channelGateway = new ChannelGatewayService(gatewayStorage, gatewayTargets, {
      ...envConfig.gateway,
      deliveryService: channelGatewayDelivery,
    });

    // Start the retry executor for failed gateway deliveries
    const channelGatewayRetryExecutor = new ChannelGatewayRetryExecutor(channelGateway, {
      autoStart: true,
    });
    registerManagedHandler("channel_gateway_retry_executor", async () => {
      channelGatewayRetryExecutor.stop();
    });

    // Initialize coordinator load balancing for multi-coordinator setups
    const coordinatorLoadBalancing = new CoordinatorLoadBalancingService(db, store);

    // Initialize mission control for operational oversight
    const missionControl = new MissionControlService(store, health, metrics, inspect, {
      gatewayTargetDirectoryService: gatewayTargets,
    });

    // Create the HTTP API server with all services
    const server = new HttpApiServer({
      approvalService: approvals,
      inspectService: inspect,
      missionControlService: missionControl,
      gatewayTargetDirectoryService: gatewayTargets,
      ...(authService ? { authService } : {}),
      channelGatewayService: channelGateway,
      channelGatewayDeliveryService: channelGatewayDelivery,
      webhookSecret: envConfig.webhookSecret,
      coordinatorLoadBalancingService: coordinatorLoadBalancing,
      prometheusMetricsExporter,
      billingService,
      knowledgePlaneService: knowledgePlane,
      artifactPlaneService: artifactPlane,
      domainRegistryService: domainRegistry,
      pluginRegistry,
      enableWebSocket: envConfig.enableWebSocket,
    });
    const webSocketStatusRelay =
      envConfig.enableWebSocket
        ? new TaskWebSocketStatusRelay(server, store)
        : null;
    registerManagedHandler("task_websocket_status_relay", async () => {
      webSocketStatusRelay?.stop();
    });
    registerManagedHandler("model_call_provider", async () => {
      getModelCallProvider()?.dispose();
      resetModelCallProvider();
    });
    registerManagedHandler("process_tracker", async () => {
      const tracker = getProcessTracker();
      await tracker.killAll();
      resetProcessTracker();
    });
    registerManagedHandler("http_api_server", async () => {
      await server.stop();
    });

    // Resolve host and port from environment or defaults
    const startOptions: { host?: string; port?: number } = {};
    if (envConfig.apiHost) {
      startOptions.host = envConfig.apiHost;
    }
    if (envConfig.apiPort !== undefined) {
      startOptions.port = envConfig.apiPort;
    }

    // Start the HTTP server
    const address = await server.start({
      ...startOptions,
    });
    if (metricsServer != null) {
      await new Promise<void>((resolve, reject) => {
        metricsServer.once("error", reject);
        metricsServer.listen(envConfig.metricsPort, envConfig.metricsHost ?? "127.0.0.1", () => {
          metricsServer.off("error", reject);
          resolve();
        });
      });
    }
    webSocketStatusRelay?.start();

    process.stdout.write(
      `${JSON.stringify(
        {
          host: address.host,
          port: address.port,
          baseUrl: address.baseUrl,
          ...(envConfig.metricsPort != null ? { metricsUrl: `http://${address.host}:${envConfig.metricsPort}/metrics` } : {}),
          webSocketEnabled: envConfig.enableWebSocket,
          logTransports: enabledLogTransports,
        },
        null,
        2,
      )}\n`,
    );

    startupComplete = true;
  }, {
    dbPath: envConfig.dbPath ?? resolveCliDbPath(),
  });
  } catch (error) {
    if (!startupComplete) {
      for (const handler of startupCleanup.slice().reverse()) {
        await handler().catch((cleanupError) => {
          process.stderr.write(
            `startup_cleanup_failed:${summarizeCliError(cleanupError, "api_server.startup_cleanup_failed")}\n`,
          );
        });
      }
    }
    throw error;
  }
}

if (isCliEntryPoint(import.meta.url)) {
  void runCliMain(main, {
    onError: (error) => {
      process.stderr.write(`${summarizeCliError(error, "api_server.failed")}\n`);
    },
  });
}
