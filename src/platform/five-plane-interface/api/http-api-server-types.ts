import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
import type { DomainRegistryService } from "../../../domains/registry/domain-registry-service.js";
import type { PluginSpiRegistry } from "../../../domains/registry/plugin-spi-registry.js";
import type { BillingService } from "../../../scale-ecosystem/billing/billing-service.js";
import type { ApprovalService } from "../../five-plane-control-plane/approval-center/approval-service.js";
import type { ConfigRolloutService } from "../../five-plane-control-plane/config-center/config-rollout-service.js";
import type { TenantBoundaryRegistryService } from "../../five-plane-control-plane/tenant/index.js";
import type { WorkerRegistryService } from "../../five-plane-execution/worker-pool/worker-registry-service.js";
import type { ArtifactPlaneService } from "../../five-plane-state-evidence/artifacts/artifact-plane-service.js";
import type { KnowledgePlaneService } from "../../five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import type { MissionRepository } from "../../five-plane-state-evidence/truth/mission-repository.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { InspectService } from "../../shared/observability/inspect-service.js";
import type { ChannelGatewayService } from "../channel-gateway/channel-gateway-service.js";
import type { ChannelGatewayDeliveryService } from "../channel-gateway/channel-gateway-delivery-service.js";
import type { GatewayTargetDirectoryService } from "../channel-gateway/gateway-target-directory-service.js";
import type { DistributedRateLimiter } from "../ingress/distributed-rate-limiter.js";
import type { IntakeAdmissionService } from "../../five-plane-orchestration/harness/runtime/intake-admission-service.js";
import type { ApiAuthService } from "./api-auth-service.js";
import type { AdminConfigService } from "./admin-config-service.js";
import type { AdminRuntimeDirectiveService } from "./admin-runtime-directive-service.js";
import type { ApiDelegationService, IncidentFacadeService } from "./facade-interfaces.js";
import type { CostReportService } from "./cost-report-service.js";
import type { MissionControlService } from "./mission-control-service.js";
import type { PackCatalogService } from "./pack-catalog-service.js";
import type { RouteContext, RouteDefinition } from "./http-server/types.js";
import type { CorsConfig } from "./http-server/response-hardening.js";
import type { PrometheusMetricsExporter } from "../../shared/observability/prometheus-metrics-exporter.js";
import type { HierarchicalPromptRegistryService } from "../../prompt-engine/registry/hierarchical-registry-service.js";
import type { WebhookIngressService } from "../webhook/index.js";
import type { WebhookOutboxDispatchService } from "../webhook/webhook-outbox-dispatch-service.js";

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
  webhookOutboxDispatchService?: WebhookOutboxDispatchService | null;
  webhookSecret?: string | null;
  coordinatorLoadBalancingService?: ApiDelegationService | null;
  prometheusMetricsExporter?: PrometheusMetricsExporter | null;
  billingService?: BillingService | null;
  incidentService?: IncidentFacadeService | null;
  packCatalogService?: PackCatalogService | null;
  costReportService?: CostReportService | null;
  configRolloutService?: ConfigRolloutService | null;
  tenantRegistryService?: TenantBoundaryRegistryService | null;
  adminConfigService?: AdminConfigService | null;
  adminRuntimeDirectiveService?: AdminRuntimeDirectiveService | null;
  promptRegistryService?: HierarchicalPromptRegistryService | null;
  missionRepository?: MissionRepository | null;
  knowledgePlaneService?: KnowledgePlaneService | null;
  artifactPlaneService?: ArtifactPlaneService | null;
  domainRegistryService?: DomainRegistryService | null;
  pluginRegistry?: PluginSpiRegistry | null;
  taskStore?: AuthoritativeTaskStore | null;
  intakeAdmissionService?: IntakeAdmissionService | null;
  rateLimiter?: DistributedRateLimiter | null;
  enableWebSocket?: boolean;
  cors?: Partial<CorsConfig> | null;
  apiDefaultTimeoutMs?: number;
  apiMaxTimeoutMs?: number;
  workerHeartbeatSweepIntervalMs?: number;
  workerHeartbeatTtlMs?: number;
  platformRoot?: string;
  gatewayWebhookSignatureToleranceSeconds?: number;
  gatewayWebhookNonceTtlSeconds?: number;
  env?: NodeJS.ProcessEnv;
  buildVersion?: string;
  contractVersion?: string;
  minimumSdkVersion?: string;
  recommendedSdkVersion?: string;
  openApiPublic?: boolean;
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

export interface HttpApiRouteDependencies {
  readonly divisionRegistry: DivisionRegistry | null;
  readonly incidentService: IncidentFacadeService;
  readonly packCatalogService: PackCatalogService;
  readonly costReportService: CostReportService;
  readonly configRolloutService: ConfigRolloutService;
  readonly tenantRegistryService: TenantBoundaryRegistryService;
  readonly adminConfigService: AdminConfigService;
  readonly adminRuntimeDirectiveService: AdminRuntimeDirectiveService;
  readonly promptRegistryService: HierarchicalPromptRegistryService;
  readonly routeTable: RouteDefinition[];
  readonly taskStore?: AuthoritativeTaskStore | null;
  readonly workerRegistryService?: WorkerRegistryService | null;
  readonly routeContext?: RouteContext;
}
