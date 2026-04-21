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
 *   - AA_JWT_SECRET: Secret for JWT authentication
 *   - AA_API_KEYS: Comma-separated list of valid API keys
 *
 * Usage: npm run api-server
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for system architecture
 * @see {@link docs_zh/contracts/observability_contract.md} for health and metrics
 */
import { join } from "node:path";
import { resolveCliDbPath, withPersistentCliStorageAsync } from "./authoritative-storage.js";
import { ChannelGatewayService } from "../../platform/interface/channel-gateway/channel-gateway-service.js";
import { ChannelGatewayDeliveryService } from "../../platform/interface/channel-gateway/channel-gateway-delivery-service.js";
import { CHANNEL_DELIVERY_DDL } from "../../platform/interface/channel-gateway/channel-gateway-delivery-support.js";
import { ChannelGatewayRetryExecutor } from "../../platform/interface/channel-gateway/channel-gateway-retry-executor.js";
import { GatewayTargetDirectoryService } from "../../platform/interface/channel-gateway/gateway-target-directory-service.js";
import { GatewayStorageAdapter } from "../../platform/interface/channel-gateway/storage-adapter.js";
import { ApprovalService } from "../../platform/control-plane/approval-center/approval-service.js";
import { ApiAuthService } from "../../platform/interface/api/api-auth-service.js";
import { HttpApiServer } from "../../platform/interface/api/http-api-server.js";
import { MissionControlService } from "../../platform/interface/api/mission-control-service.js";
import { TaskWebSocketStatusRelay } from "../../platform/interface/api/task-websocket-status-relay.js";
import { loadApiServerEnv } from "../../platform/control-plane/config-center/api-server-env.js";
import { requireValidStartupEnv } from "../../platform/control-plane/config-center/startup-env-schema.js";
import { TypedEventBus } from "../../platform/state-evidence/events/typed-event-bus.js";
import { TypedEventBusPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import { DomainEventFeedbackConsumer } from "../../scale-ecosystem/feedback-loop/collector/domain-event-feedback-consumer.js";
import { InspectService } from "../../platform/shared/observability/inspect-service.js";
import { HealthService } from "../../platform/shared/observability/health-service.js";
import { configureStructuredLogTransports } from "../../platform/shared/observability/log-transport-bootstrap.js";
import { createMetricsServer } from "../../platform/shared/observability/metrics-server.js";
import { MetricsService } from "../../platform/shared/observability/metrics-service.js";
import { initOtel, shutdownOtel } from "../../platform/shared/observability/otel-bootstrap.js";
import { PrometheusMetricsExporter } from "../../platform/shared/observability/prometheus-metrics-exporter.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { CoordinatorLoadBalancingService } from "../../platform/execution/ha/coordinator-load-balancing-service.js";
import { getGlobalGracefulShutdown } from "../../platform/execution/startup/graceful-shutdown.js";
import { BillingService } from "../../scale-ecosystem/marketplace/billing-service.js";
import { ArtifactPublishLedger } from "../../platform/state-evidence/artifacts/artifact-publish-ledger.js";
import { ArtifactPublishService } from "../../platform/state-evidence/artifacts/artifact-publish-service.js";
import { ArtifactPlaneService } from "../../platform/state-evidence/artifacts/artifact-plane-service.js";
import { bootstrapConfiguredRegistries } from "../../domains/registry/registry-bootstrap.js";
import { KnowledgeSnapshotStore } from "../../platform/state-evidence/knowledge/archive/knowledge-snapshot-store.js";
import { KnowledgePlaneService } from "../../platform/state-evidence/knowledge/knowledge-plane-service.js";
import { createSemanticVectorStoreFromEnvironment } from "../../platform/state-evidence/knowledge/semantic-vector-store.js";
/**
 * Main entry point for the API server.
 *
 * Initializes the database, creates all required services (health, metrics, gateway, billing, etc.),
 * starts the HTTP server, and registers graceful shutdown handlers to ensure clean termination.
 */
async function main() {
    // GAP-V2-06: Validate startup environment variables before any other initialization.
    // process.exit(1) if critical env vars are invalid or missing.
    requireValidStartupEnv();
    const envConfig = loadApiServerEnv();
    await initOtel({
        enabled: envConfig.otelEnabled,
        endpoint: envConfig.otelEndpoint,
        serviceName: envConfig.otelServiceName,
        serviceVersion: envConfig.otelServiceVersion,
        instrumentHttp: true,
    });
    // Configure structured logging to file if path is provided
    StructuredLogger.configureGlobalFileSink(envConfig.logFilePath == null
        ? null
        : {
            filePath: envConfig.logFilePath,
            maxBytes: envConfig.logFileMaxBytes,
            maxFiles: envConfig.logFileMaxFiles,
        });
    const enabledLogTransports = configureStructuredLogTransports({
        stdout: envConfig.logStdout,
        fluentd: envConfig.logFluentd,
        datadog: envConfig.logDatadog,
    });
    await withPersistentCliStorageAsync(async (storage) => {
        const db = storage.sql;
        const store = storage.store;
        // Initialize core observability services
        const health = new HealthService(db, store);
        const metrics = new MetricsService(db, health);
        const prometheusMetricsExporter = new PrometheusMetricsExporter(db, metrics);
        const inspect = new InspectService(store);
        const typedEventBus = new TypedEventBus(db, store);
        const eventPublisher = new TypedEventBusPublisher(typedEventBus);
        const domainEventFeedbackConsumer = new DomainEventFeedbackConsumer();
        domainEventFeedbackConsumer.subscribe(typedEventBus);
        const registryBootstrap = bootstrapConfiguredRegistries({ eventPublisher });
        const pluginRegistry = registryBootstrap.pluginRegistry;
        const domainRegistry = registryBootstrap.domainRegistry;
        const semanticVectorStore = createSemanticVectorStoreFromEnvironment({
            env: process.env,
            storageDriver: storage.driver,
            database: storage.asyncSql,
        });
        const knowledgePlane = new KnowledgePlaneService({
            domainRegistry,
            pluginRegistry,
            eventPublisher,
            semanticVectorStore,
            snapshotStore: new KnowledgeSnapshotStore({
                snapshotPath: join(process.cwd(), "data", "knowledge", "knowledge-plane.snapshot.json"),
            }),
        });
        for (const namespace of registryBootstrap.knowledgeNamespaces) {
            domainRegistry.registerKnowledgeNamespace(namespace.path, namespace.ownerDomainId);
            knowledgePlane.registerNamespace(namespace);
        }
        await knowledgePlane.initialize();
        const artifactPlane = new ArtifactPlaneService(undefined, undefined, undefined, new ArtifactPublishService(new ArtifactPublishLedger({
            ledgerPath: join(process.cwd(), "data", "artifacts", "publish-ledger.jsonl"),
        })));
        const metricsServer = envConfig.metricsPort == null
            ? null
            : createMetricsServer(prometheusMetricsExporter);
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
        const webSocketStatusRelay = envConfig.enableWebSocket && authService != null
            ? new TaskWebSocketStatusRelay(server, store)
            : null;
        // Resolve host and port from environment or defaults
        const startOptions = {};
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
            await new Promise((resolve, reject) => {
                metricsServer.once("error", reject);
                metricsServer.listen(envConfig.metricsPort, envConfig.apiHost ?? "127.0.0.1", () => {
                    metricsServer.off("error", reject);
                    resolve();
                });
            });
        }
        webSocketStatusRelay?.start();
        process.stdout.write(`${JSON.stringify({
            host: address.host,
            port: address.port,
            baseUrl: address.baseUrl,
            ...(envConfig.metricsPort != null ? { metricsUrl: `http://${address.host}:${envConfig.metricsPort}/metrics` } : {}),
            webSocketEnabled: envConfig.enableWebSocket && authService != null,
            logTransports: enabledLogTransports,
        }, null, 2)}\n`);
        // Register graceful shutdown handlers for clean termination
        const shutdown = getGlobalGracefulShutdown();
        shutdown.addHandler({
            name: "otel_sdk",
            handler: async () => {
                await shutdownOtel();
            },
        });
        shutdown.addHandler({
            name: "metrics_server",
            handler: async () => {
                if (metricsServer == null || !metricsServer.listening) {
                    return;
                }
                await new Promise((resolve, reject) => {
                    metricsServer.close((error) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve();
                    });
                });
            },
        });
        shutdown.addHandler({
            name: "task_websocket_status_relay",
            handler: async () => {
                webSocketStatusRelay?.stop();
            },
        });
        shutdown.addHandler({
            name: "structured_logger_transports",
            handler: async () => {
                await StructuredLogger.flushTransports();
                await StructuredLogger.closeTransports();
            },
        });
        shutdown.addHandler({
            name: "channel_gateway_retry_executor",
            handler: async () => {
                channelGatewayRetryExecutor.stop();
            },
        });
        shutdown.addHandler({
            name: "http_api_server",
            handler: async () => {
                await server.stop();
            },
        });
    }, {
        dbPath: envConfig.dbPath ?? resolveCliDbPath(),
    });
}
void main();
//# sourceMappingURL=api-server.js.map