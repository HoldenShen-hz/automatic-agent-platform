import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createGzip, createBrotliCompress } from "node:zlib";
import { parse as parseUrl } from "node:url";

import { GatewayTargetDirectoryService } from "../channel-gateway/gateway-target-directory-service.js";
import { ChannelGatewayService } from "../channel-gateway/channel-gateway-service.js";
import type { ChannelGatewayDeliveryService } from "../channel-gateway/channel-gateway-delivery-service.js";
import type { ApprovalService } from "../../control-plane/approval-center/approval-service.js";
import { ConfigRolloutService } from "../../control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../control-plane/tenant/index.js";
import { ApiAuthService, type ApiPrincipal } from "./api-auth-service.js";
import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
import { safeLoadDivisionRegistry } from "../../../domains/governance/safe-load-division-registry.js";
import { InspectService } from "../../shared/observability/inspect-service.js";
import { DistributedRateLimiter, type RateLimitCheckResult } from "../ingress/distributed-rate-limiter.js";
import { provideContext } from "../../shared/context/runtime-context.js";
import { MissionControlService } from "./mission-control-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { PrometheusMetricsExporter } from "../../shared/observability/prometheus-metrics-exporter.js";
import { AppError } from "../../contracts/errors.js";
import { BillingService } from "../../../scale-ecosystem/billing/billing-service.js";
import { DomainRegistryService } from "../../../domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../domains/registry/plugin-spi-registry.js";
import type { KnowledgePlaneService } from "../../state-evidence/knowledge/knowledge-plane-service.js";
import type { ArtifactPlaneService } from "../../state-evidence/artifacts/artifact-plane-service.js";
import { WebSocketBridge, type TaskWebSocketEvent } from "../channel-gateway/websocket-bridge.js";
import type { WebhookIngressService } from "../webhook/index.js";
import type { WebhookOutboxDispatchService } from "../webhook/webhook-outbox-dispatch-service.js";
import type { ApiRequestLike, ApiResponsePayload, RouteContext, RouteDefinition, RouteMatch } from "./http-server/types.js";
import {
  createNoOpIncidentFacadeService,
  type ApiDelegationService,
  type IncidentFacadeService,
} from "./facade-interfaces.js";
import { PackCatalogService } from "./pack-catalog-service.js";
import { CostReportService } from "./cost-report-service.js";
import { AdminConfigService } from "./admin-config-service.js";
import { HierarchicalPromptRegistryService } from "../../prompt-engine/registry/hierarchical-registry-service.js";
import { readRequestId } from "./http-server/utils.js";
import {
  MAX_BODY_BYTES,
  authenticateOptionalPrincipal,
  matchRoute,
  normalizeHeaders,
  readIncomingBody,
} from "./http-server/request-helpers.js";
import { ApiError, normalizeError } from "./http-server/api-error.js";
import {
  createHealthRoutes,
  createMetricsRoutes,
  createAuthRoutes,
  createBillingRoutes,
  createDivisionRoutes,
  createDashboardRoutes,
  createGatewayRoutes,
  createTaskRoutes,
  createWebhookRoutes,
  createApprovalRoutes,
  createAdminRoutes,
  createConsoleRoutes,
  createPlaneRoutes,
  createIncidentRoutes,
  createPackRoutes,
  createCostRoutes,
  createPromptRoutes,
} from "./http-server/index.js";
import {
  buildPreflightHeaders,
  decorateResponseHeaders,
  normalizeCorsConfig,
  parseAllowedOrigins,
  type CorsConfig,
} from "./http-server/response-hardening.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

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
  /** Default synchronous API timeout in milliseconds */
  apiDefaultTimeoutMs?: number;
  /** Maximum allowed synchronous API timeout in milliseconds */
  apiMaxTimeoutMs?: number;
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

export class HttpApiServer {
  private readonly server: Server;
  private readonly divisionRegistry: DivisionRegistry | null;
  private readonly routeTable: RouteDefinition[];
  private readonly corsConfig: CorsConfig;
  private webSocketBridge: WebSocketBridge | null = null;
  private readonly rateLimiter: DistributedRateLimiter | null;
  private readonly incidentService: IncidentFacadeService;
  private readonly packCatalogService: PackCatalogService;
  private readonly costReportService: CostReportService;
  private readonly configRolloutService: ConfigRolloutService;
  private readonly tenantRegistryService: TenantBoundaryRegistryService;
  private readonly adminConfigService: AdminConfigService;
  private readonly promptRegistryService: HierarchicalPromptRegistryService;
  private readonly apiDefaultTimeoutMs: number;
  private readonly apiMaxTimeoutMs: number;

  public constructor(private readonly options: HttpApiServerOptions) {
    this.divisionRegistry = options.divisionRegistry ?? safeLoadDivisionRegistry();
    this.rateLimiter = options.rateLimiter ?? null;
    this.incidentService = options.incidentService ?? createNoOpIncidentFacadeService();
    this.packCatalogService = options.packCatalogService ?? new PackCatalogService();
    this.costReportService = options.costReportService ?? new CostReportService();
    this.configRolloutService = options.configRolloutService ?? new ConfigRolloutService();
    this.tenantRegistryService = options.tenantRegistryService ?? new TenantBoundaryRegistryService();
    this.adminConfigService = options.adminConfigService ?? new AdminConfigService();
    this.promptRegistryService = options.promptRegistryService ?? new HierarchicalPromptRegistryService();
    this.apiDefaultTimeoutMs = normalizeApiTimeout(options.apiDefaultTimeoutMs, 5_000, 5_000);
    this.apiMaxTimeoutMs = normalizeApiTimeout(options.apiMaxTimeoutMs, 30_000, 30_000);
    const corsConfigInput: Partial<CorsConfig> = {
      allowedOrigins: options.cors?.allowedOrigins ?? parseAllowedOrigins(process.env["AA_API_ALLOWED_ORIGINS"]),
    };
    if (options.cors?.allowedMethods != null) {
      corsConfigInput.allowedMethods = options.cors.allowedMethods;
    }
    if (options.cors?.allowedHeaders != null) {
      corsConfigInput.allowedHeaders = options.cors.allowedHeaders;
    }
    if (options.cors?.exposedHeaders != null) {
      corsConfigInput.exposedHeaders = options.cors.exposedHeaders;
    }
    if (options.cors?.maxAgeSeconds != null) {
      corsConfigInput.maxAgeSeconds = options.cors.maxAgeSeconds;
    }
    if (options.cors?.credentials != null) {
      corsConfigInput.credentials = options.cors.credentials;
    }
    this.corsConfig = normalizeCorsConfig(corsConfigInput);
    this.routeTable = this.buildRouteTable();
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  public async start(options: StartServerOptions = {}): Promise<StartedServerAddress> {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 0;
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    // Initialize WebSocket bridge if enabled and auth service is available
    if (this.options.enableWebSocket && this.options.authService) {
      this.webSocketBridge = new WebSocketBridge(
        this.server,
        this.options.authService,
      );
      logger.info("WebSocket bridge initialized", { path: "/ws/v1/stream" });
    }

    const address = this.server.address();
    if (address == null || typeof address === "string") {
      throw new AppError("api.listen_failed", "Failed to get server listen address", {
        category: "runtime",
        source: "gateway",
        retryable: true,
      });
    }
    return {
      host: address.address,
      port: address.port,
      baseUrl: `http://${address.address}:${address.port}`,
    };
  }

  public async stop(): Promise<void> {
    if (!this.server.listening) {
      return;
    }

    // Close WebSocket bridge first
    if (this.webSocketBridge) {
      await this.webSocketBridge.close();
      this.webSocketBridge = null;
    }

    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code === "ERR_SERVER_NOT_RUNNING") {
            resolve();
            return;
          }
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  public broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
    this.webSocketBridge?.broadcastToTask(taskId, event);
  }

  public async inject(options: InjectRequestOptions): Promise<InjectResponse> {
    const startedAt = Date.now();
    const headers = normalizeHeaders(options.headers);
    const method = options.method ?? "GET";
    // Authenticate for inject requests too so rate limiting can use principal context
    const principal = authenticateOptionalPrincipal(
      { method, url: options.url, headers, body: options.body ?? undefined },
      this.options.authService ?? null,
    );
    const response = this.decoratePayload(
      method === "OPTIONS"
        ? {
            statusCode: 204,
            headers: buildPreflightHeaders(headers.origin, this.corsConfig),
            body: "",
          }
        : await this.dispatchRequest({
            method,
            url: options.url,
            headers,
            body: options.body ?? null,
          }, principal, {}),
      headers.origin,
    );
    this.recordPrometheusHttpMetric(method, options.url, response.statusCode, Date.now() - startedAt);
    return {
      ...response,
      json<T>(): T {
        return JSON.parse(response.body) as T;
      },
      text(): string {
        return response.body;
      },
    };
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const startedAt = Date.now();
    const headers = normalizeHeaders(request.headers);
    const requestId = readRequestId({
      method: request.method,
      url: request.url,
      headers,
      body: null,
    });
    let payload: ApiResponsePayload;

    // Authenticate early so we can use principal/tenant for rate limiting
    const principal = authenticateOptionalPrincipal(
      { method: request.method, url: request.url, headers, body: undefined },
      this.options.authService ?? null,
    );

    try {
      // 1. Preflight (CORS OPTIONS) — no rate limit, no body
      if ((request.method ?? "GET") === "OPTIONS") {
        payload = {
          statusCode: 204,
          headers: buildPreflightHeaders(headers.origin, this.corsConfig),
          body: "",
        };
      }
      // 2. Rate limiting check (non-OPTIONS only)
      else if (this.rateLimiter != null) {
        const clientIp = request.socket?.remoteAddress ?? "unknown";
        const tenantId = principal?.tenantId ?? "anonymous";
        const principalId = principal?.actorId ?? "anonymous";
        // Use tenant + principal for rate limit key per §9.2
        const rateLimitKey = `${tenantId}:${principalId}:${clientIp}`;
        const result: RateLimitCheckResult = await this.rateLimiter.checkAndConsume(rateLimitKey);
        // Attach rate limit headers to response
        const rateLimitHeaders = this.buildRateLimitHeaders(result);
        if (!result.allowed) {
          payload = {
            statusCode: 429,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "x-request-id": requestId,
              ...rateLimitHeaders,
            },
            body: JSON.stringify({
              requestId,
              error: {
                code: "api.rate_limit_exceeded",
                message: "Too many requests. Please retry later.",
              },
            }, null, 2),
          };
        } else {
          payload = await this.routeRequest(requestId, request, headers, principal, rateLimitHeaders);
        }
      }
      // 3. No rate limiter — normal routing
      else {
        payload = await this.routeRequest(requestId, request, headers, principal, {});
      }
    } catch (error) {
      payload = this.handleError(error, requestId, {
        method: request.method,
        url: request.url,
        headers,
        body: null,
      });
    }

    const finalizedPayload = this.decoratePayload(payload, headers.origin);
    this.recordPrometheusHttpMetric(request.method ?? "GET", request.url, payload.statusCode, Date.now() - startedAt);
    this.sendPayload(response, finalizedPayload, headers["accept-encoding"]);
  }

  /**
   * Routes a request after passing rate limiting.
   * Validates body size and dispatches to the appropriate handler.
   */
  private async routeRequest(
    requestId: string,
    request: IncomingMessage,
    headers: Record<string, string | undefined>,
    principal: ApiPrincipal | null,
    rateLimitHeaders: Record<string, string>,
  ): Promise<ApiResponsePayload> {
    const contentLength = Number.parseInt(headers["content-length"] ?? "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return this.buildJsonErrorResponse(requestId, 413, {
        code: "api.payload_too_large",
        message: `Request body exceeds ${MAX_BODY_BYTES} bytes.`,
      });
    }
    const body = await readIncomingBody(request);
    return this.dispatchRequest({
      method: request.method,
      url: request.url,
      headers,
      body,
    }, principal, rateLimitHeaders);
  }

  /**
   * Extracts a normalized endpoint key from a URL path for use as a rate limit key.
   * Strips query strings and normalizes paths like /tasks/abc123 → /tasks/:id.
   */
  private extractEndpointKey(url: string): string {
    try {
      const pathname = parseUrl(url).pathname ?? "/";
      return pathname;
    } catch {
      return "/";
    }
  }

  private async dispatchRequest(
    request: ApiRequestLike,
    principal: ApiPrincipal | null,
    rateLimitHeaders: Record<string, string>,
  ): Promise<ApiResponsePayload> {
    const requestId = readRequestId(request);

    return provideContext({
      traceId: requestId,
      taskId: requestId,
      requestId,
      tenantId: principal?.tenantId ?? null,
    }, async () => {
      try {
        const bodyBytes = typeof request.body === "string" ? Buffer.byteLength(request.body, "utf8") : 0;
        if (bodyBytes > MAX_BODY_BYTES) {
          throw new ApiError(413, "api.payload_too_large", "Request body exceeds 1 MB limit.");
        }
        const route = matchRoute(request);
        if (!route) {
          return this.buildJsonErrorResponse(requestId, 404, {
            code: "api.not_found",
            message: "Route not found.",
          });
        }

        const ctx: RouteContext = { request, route, requestId, principal };
        const resolved = await this.withRequestTimeout(
          request,
          this.resolveRouteResponse(route, request, ctx),
        );
        if (resolved == null) {
          return this.buildJsonErrorResponse(requestId, 404, {
            code: "api.not_found",
            message: "Route not found.",
          });
        }
        // Attach rate limit headers to successful responses
        return this.addRateLimitHeaders(resolved, rateLimitHeaders);
      } catch (error) {
        return this.handleError(error, requestId, request);
      }
    });
  }

  private async resolveRouteResponse(
    route: RouteMatch,
    request: ApiRequestLike,
    ctx: RouteContext,
  ): Promise<ApiResponsePayload | null> {
    const method = request.method ?? "GET";
    for (const def of this.routeTable) {
      if (def.method !== method) {
        continue;
      }
      if (def.pathname != null) {
        if (def.pathname === route.pathname) {
          return def.handler(ctx);
        }
      } else if (def.segments) {
        const result = await def.handler(ctx);
        if (result !== null) {
          return result;
        }
      }
    }
    return null;
  }

  private async withRequestTimeout<T>(
    request: ApiRequestLike,
    operation: Promise<T>,
  ): Promise<T> {
    const timeoutMs = this.resolveRequestTimeoutMs(request);
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ApiError(504, "api.request_timeout", `Request exceeded ${timeoutMs} ms timeout.`));
      }, timeoutMs);
      void operation.then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  private resolveRequestTimeoutMs(request: ApiRequestLike): number {
    const requested = Number.parseInt(request.headers["x-aa-timeout-ms"] ?? "", 10);
    if (!Number.isFinite(requested) || requested <= 0) {
      return this.apiDefaultTimeoutMs;
    }
    return Math.min(Math.trunc(requested), this.apiMaxTimeoutMs);
  }

  private handleError(error: unknown, requestId: string, request: ApiRequestLike): ApiResponsePayload {
    const normalized = normalizeError(error);
    if (!(error instanceof AppError)) {
      logger.error("Unhandled API error", {
        requestId,
        method: request.method ?? "GET",
        url: request.url ?? "/",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return this.buildJsonErrorResponse(requestId, normalized.statusCode, {
      code: normalized.code,
      message: normalized.message,
    });
  }

  private buildRouteTable(): RouteDefinition[] {
    return [
      ...createHealthRoutes({
        missionControlService: this.options.missionControlService,
      }),
      ...createMetricsRoutes({
        prometheusMetricsExporter: this.options.prometheusMetricsExporter ?? null,
      }),
      ...createAuthRoutes({
        authService: this.options.authService ?? null,
      }),
      ...createBillingRoutes({
        billingService: this.options.billingService ?? null,
        webhookSecret: this.options.webhookSecret ?? null,
      }),
      ...createDivisionRoutes({
        divisionRegistry: this.divisionRegistry,
        missionControlService: this.options.missionControlService,
      }),
      ...createDashboardRoutes({
        authService: this.options.authService ?? null,
        missionControlService: this.options.missionControlService,
      }),
      ...createGatewayRoutes({
        authService: this.options.authService ?? null,
        gatewayTargetDirectoryService: this.options.gatewayTargetDirectoryService ?? null,
        channelGatewayService: this.options.channelGatewayService ?? null,
        channelGatewayDeliveryService: this.options.channelGatewayDeliveryService ?? null,
        webhookSecret: this.options.webhookSecret ?? null,
      }),
      ...createTaskRoutes({
        authService: this.options.authService ?? null,
        inspectService: this.options.inspectService,
        missionControlService: this.options.missionControlService,
        intakeAdmissionService: this.options.intakeAdmissionService ?? null,
      }),
      ...(this.options.webhookIngressService != null
        ? createWebhookRoutes({
            authService: this.options.authService ?? null,
            webhookIngressService: this.options.webhookIngressService,
            webhookOutboxDispatchService: this.options.webhookOutboxDispatchService ?? null,
          })
        : []),
      ...createApprovalRoutes({
        authService: this.options.authService ?? null,
        approvalService: this.options.approvalService,
        inspectService: this.options.inspectService,
      }),
      ...createAdminRoutes({
        authService: this.options.authService ?? null,
        missionControlService: this.options.missionControlService,
        coordinatorLoadBalancingService: this.options.coordinatorLoadBalancingService ?? null,
        configRolloutService: this.configRolloutService,
        tenantRegistryService: this.tenantRegistryService,
        costReportService: this.costReportService,
        adminConfigService: this.adminConfigService,
      }),
      ...createConsoleRoutes({
        authService: this.options.authService ?? null,
        missionControlService: this.options.missionControlService,
        gatewayTargetDirectoryService: this.options.gatewayTargetDirectoryService ?? null,
      }),
      ...createPlaneRoutes({
        authService: this.options.authService ?? null,
        knowledgePlaneService: this.options.knowledgePlaneService ?? null,
        artifactPlaneService: this.options.artifactPlaneService ?? null,
        domainRegistryService: this.options.domainRegistryService ?? null,
        pluginRegistry: this.options.pluginRegistry ?? null,
      }),
      ...createIncidentRoutes({
        authService: this.options.authService ?? null,
        incidentService: this.incidentService,
      }),
      ...createPackRoutes({
        authService: this.options.authService ?? null,
        packCatalogService: this.packCatalogService,
      }),
      ...createCostRoutes({
        authService: this.options.authService ?? null,
        costReportService: this.costReportService,
      }),
      ...createPromptRoutes({
        authService: this.options.authService ?? null,
        promptRegistryService: this.promptRegistryService,
      }),
    ];
  }

  private buildJsonResponse(requestId: string, statusCode: number, payload: unknown): ApiResponsePayload {
    return {
      statusCode,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ requestId, data: payload }, null, 2),
    };
  }

  private buildJsonErrorResponse(
    requestId: string,
    statusCode: number,
    error: {
      code: string;
      message: string;
    },
  ): ApiResponsePayload {
    return {
      statusCode,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ requestId, error }, null, 2),
    };
  }

  private decoratePayload(payload: ApiResponsePayload, origin: string | undefined): ApiResponsePayload {
    return decorateResponseHeaders(payload, origin, this.corsConfig);
  }

  /**
   * Builds rate limit headers from a rate limit check result.
   * Returns headers conforming to IETF Rate Limit draft spec.
   */
  private buildRateLimitHeaders(result: RateLimitCheckResult): Record<string, string> {
    return {
      "x-ratelimit-limit": String(this.rateLimiter?.["maxCalls"] ?? 100),
      "x-ratelimit-remaining": String(result.remaining),
      "x-ratelimit-reset": String(Date.now() + (result.retryAfterMs ?? 60_000)),
      ...(result.retryAfterMs != null ? { "retry-after": String(Math.ceil(result.retryAfterMs / 1000)) } : {}),
    };
  }

  /**
   * Adds rate limit headers to a response payload.
   */
  private addRateLimitHeaders(
    payload: ApiResponsePayload,
    rateLimitHeaders: Record<string, string>,
  ): ApiResponsePayload {
    return {
      ...payload,
      headers: { ...payload.headers, ...rateLimitHeaders },
    };
  }

  private sendPayload(
    response: ServerResponse,
    payload: ApiResponsePayload,
    acceptEncoding: string | undefined,
  ): void {
    response.statusCode = payload.statusCode;
    for (const [name, value] of Object.entries(payload.headers)) {
      response.setHeader(name, value);
    }

    const normalizedAcceptEncoding = (acceptEncoding ?? "").toLowerCase();
    const body = payload.body;
    const useCompression = body.length >= 1024;

    if (useCompression && normalizedAcceptEncoding.includes("br")) {
      response.removeHeader("content-length");
      response.setHeader("content-encoding", "br");
      response.setHeader("transfer-encoding", "chunked");
      const compress = createBrotliCompress();
      compress.pipe(response);
      compress.end(body);
      return;
    }

    if (useCompression && normalizedAcceptEncoding.includes("gzip")) {
      response.removeHeader("content-length");
      response.setHeader("content-encoding", "gzip");
      response.setHeader("transfer-encoding", "chunked");
      const compress = createGzip();
      compress.pipe(response);
      compress.end(body);
      return;
    }

    response.end(body);
  }

  private recordPrometheusHttpMetric(method: string, url: string | undefined, statusCode: number, durationMs: number | null): void {
    const exporter = this.options.prometheusMetricsExporter;
    if (exporter == null) {
      return;
    }
    const route = parseUrl(url ?? "/", true);
    exporter.recordHttpRequest(method, route.pathname ?? "/", statusCode, durationMs);
  }
}

function normalizeApiTimeout(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value) || value == null || value <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(value), max);
}
