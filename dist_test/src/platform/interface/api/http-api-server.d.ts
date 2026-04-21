import { GatewayTargetDirectoryService } from "../channel-gateway/gateway-target-directory-service.js";
import { ChannelGatewayService } from "../channel-gateway/channel-gateway-service.js";
import type { ChannelGatewayDeliveryService } from "../channel-gateway/channel-gateway-delivery-service.js";
import type { ApprovalService } from "../../control-plane/approval-center/approval-service.js";
import { ConfigRolloutService } from "../../control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../control-plane/tenant/index.js";
import { ApiAuthService } from "./api-auth-service.js";
import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
import { InspectService } from "../../shared/observability/inspect-service.js";
import { CoordinatorLoadBalancingService } from "../../execution/ha/coordinator-load-balancing-service.js";
import { DistributedRateLimiter } from "../ingress/distributed-rate-limiter.js";
import { MissionControlService } from "./mission-control-service.js";
import { PrometheusMetricsExporter } from "../../shared/observability/prometheus-metrics-exporter.js";
import { BillingService } from "../../../scale-ecosystem/marketplace/billing-service.js";
import { ArtifactPlaneService } from "../../state-evidence/artifacts/artifact-plane-service.js";
import { DomainRegistryService } from "../../../domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../domains/registry/plugin-spi-registry.js";
import { KnowledgePlaneService } from "../../state-evidence/knowledge/knowledge-plane-service.js";
import { type TaskWebSocketEvent } from "../channel-gateway/websocket-bridge.js";
import type { WebhookIngressService } from "../webhook/index.js";
import { IncidentCaseService } from "../../state-evidence/incident/index.js";
import { PackCatalogService } from "./pack-catalog-service.js";
import { CostReportService } from "./cost-report-service.js";
import { AdminConfigService } from "./admin-config-service.js";
import { HierarchicalPromptRegistryService } from "../../prompt-engine/registry/hierarchical-registry-service.js";
import { type CorsConfig } from "./http-server/response-hardening.js";
export interface HttpApiServerOptions {
    approvalService: ApprovalService;
    inspectService: InspectService;
    missionControlService: MissionControlService;
    gatewayTargetDirectoryService?: GatewayTargetDirectoryService | null;
    divisionRegistry?: DivisionRegistry | null;
    authService?: ApiAuthService | null;
    channelGatewayService?: ChannelGatewayService | null;
    channelGatewayDeliveryService?: ChannelGatewayDeliveryService | null;
    webhookIngressService?: WebhookIngressService | null;
    webhookSecret?: string | null;
    coordinatorLoadBalancingService?: CoordinatorLoadBalancingService | null;
    prometheusMetricsExporter?: PrometheusMetricsExporter | null;
    billingService?: BillingService | null;
    incidentService?: IncidentCaseService | null;
    packCatalogService?: PackCatalogService | null;
    costReportService?: CostReportService | null;
    configRolloutService?: ConfigRolloutService | null;
    tenantRegistryService?: TenantBoundaryRegistryService | null;
    adminConfigService?: AdminConfigService | null;
    promptRegistryService?: HierarchicalPromptRegistryService | null;
    knowledgePlaneService?: KnowledgePlaneService | null;
    artifactPlaneService?: ArtifactPlaneService | null;
    domainRegistryService?: DomainRegistryService | null;
    pluginRegistry?: PluginSpiRegistry | null;
    /** Distributed rate limiter for API endpoint protection */
    rateLimiter?: DistributedRateLimiter | null;
    /** Enable WebSocket support for real-time task updates */
    enableWebSocket?: boolean;
    /** CORS configuration for browser/API callers */
    cors?: Partial<CorsConfig> | null;
}
export interface StartServerOptions {
    host?: string;
    port?: number;
}
export interface StartedServerAddress {
    host: string;
    port: number;
    baseUrl: string;
}
export interface InjectRequestOptions {
    method?: string;
    url: string;
    headers?: Record<string, string | undefined>;
    body?: string | null;
}
export interface InjectResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    json<T>(): T;
    text(): string;
}
export declare class HttpApiServer {
    private readonly options;
    private readonly server;
    private readonly divisionRegistry;
    private readonly routeTable;
    private readonly corsConfig;
    private webSocketBridge;
    private readonly rateLimiter;
    private readonly incidentService;
    private readonly packCatalogService;
    private readonly costReportService;
    private readonly configRolloutService;
    private readonly tenantRegistryService;
    private readonly adminConfigService;
    private readonly promptRegistryService;
    constructor(options: HttpApiServerOptions);
    start(options?: StartServerOptions): Promise<StartedServerAddress>;
    stop(): Promise<void>;
    broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void;
    inject(options: InjectRequestOptions): Promise<InjectResponse>;
    private handleRequest;
    /**
     * Routes a request after passing rate limiting.
     * Validates body size and dispatches to the appropriate handler.
     */
    private routeRequest;
    /**
     * Extracts a normalized endpoint key from a URL path for use as a rate limit key.
     * Strips query strings and normalizes paths like /tasks/abc123 → /tasks/:id.
     */
    private extractEndpointKey;
    private dispatchRequest;
    private resolveRouteResponse;
    private handleError;
    private buildRouteTable;
    private buildJsonResponse;
    private buildJsonErrorResponse;
    private decoratePayload;
    private sendPayload;
    private recordPrometheusHttpMetric;
}
