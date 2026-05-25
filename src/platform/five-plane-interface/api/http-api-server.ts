import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip, createBrotliCompress } from "node:zlib";
import { parse as parseUrl } from "node:url";

import { GatewayTargetDirectoryService } from "../channel-gateway/gateway-target-directory-service.js";
import { ChannelGatewayService } from "../channel-gateway/channel-gateway-service.js";
import type { ChannelGatewayDeliveryService } from "../channel-gateway/channel-gateway-delivery-service.js";
import type { ApprovalService } from "../../five-plane-control-plane/approval-center/approval-service.js";
import { ConfigRolloutService } from "../../five-plane-control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../five-plane-control-plane/tenant/index.js";
import { ApiAuthService } from "./api-auth-service.js";
import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
import { safeLoadDivisionRegistry } from "../../../domains/governance/safe-load-division-registry.js";
import { InspectService } from "../../shared/observability/inspect-service.js";
import { DistributedRateLimiter, type RateLimitCheckResult } from "../ingress/distributed-rate-limiter.js";
import { readRedisConnectionConfigFromEnv } from "../../shared/utils/redis-client-options.js";
import { provideContext } from "../../shared/context/runtime-context.js";
import { MissionControlService } from "./mission-control-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { PrometheusMetricsExporter } from "../../shared/observability/prometheus-metrics-exporter.js";
import { AppError } from "../../contracts/errors.js";
import { HTTP_STATUS_GATEWAY_TIMEOUT } from "../../contracts/constants/network.js";
import { BillingService } from "../../../scale-ecosystem/billing/billing-service.js";
import { DomainRegistryService } from "../../../domains/registry/domain-registry-service.js";
import { PluginSpiRegistry } from "../../../domains/registry/plugin-spi-registry.js";
import type { KnowledgePlaneService } from "../../five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import type { ArtifactPlaneService } from "../../five-plane-state-evidence/artifacts/artifact-plane-service.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { WebSocketBridge, type TaskWebSocketEvent } from "../channel-gateway/websocket-bridge.js";
import type { WebhookIngressService } from "../webhook/index.js";
import type { WebhookOutboxDispatchService } from "../webhook/webhook-outbox-dispatch-service.js";
import type { MissionRepository } from "../../five-plane-state-evidence/truth/mission-repository.js";
import type { IntakeAdmissionService } from "../../five-plane-orchestration/harness/runtime/intake-admission-service.js";
import { WorkerRegistryService } from "../../five-plane-execution/worker-pool/worker-registry-service.js";
import type { ApiRequestLike, ApiResponsePayload, RouteContext, RouteDefinition, RouteMatch } from "./http-server/types.js";
import {
  createNoOpIncidentFacadeService,
  type ApiDelegationService,
  type IncidentFacadeService,
} from "./facade-interfaces.js";
import { PackCatalogService } from "./pack-catalog-service.js";
import { CostReportService } from "./cost-report-service.js";
import { AdminConfigService } from "./admin-config-service.js";
import { AdminRuntimeDirectiveService } from "./admin-runtime-directive-service.js";
import { HierarchicalPromptRegistryService } from "../../prompt-engine/registry/hierarchical-registry-service.js";
import { readRequestId } from "./http-server/utils.js";
import { createDeduplicationMiddleware } from "./middleware/request-deduplication.js";
import { globalVersionRoutingMiddleware } from "./middleware/version-routing.js";
import {
  createIdempotencyKeyMiddleware,
  extractIdempotencyKey,
} from "./middleware/idempotency-key.js";
import {
  MAX_BODY_BYTES,
  authenticateOptionalPrincipal,
  matchRoute,
  normalizeHeaders,
  readIncomingBody,
} from "./http-server/request-helpers.js";
import { assertJsonRequestContentType } from "./middleware/input-validation.js";
import { buildRequestGuardPlan, planIncludesGuard } from "./middleware/request-guard-contract.js";
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
  createHarnessRunsRoutes,
  createReplaySessionRoutes,
  createMissionRoutes,
  createYonoRoutes,
} from "./http-server/index.js";
import {
  buildPreflightHeaders,
  decorateResponseHeaders,
  isOriginAllowed,
  normalizeCorsConfig,
  parseAllowedOrigins,
  type CorsConfig,
} from "./http-server/response-hardening.js";
import type {
  HttpApiServerOptions,
  InjectRequestOptions,
  InjectResponse,
  StartServerOptions,
  StartedServerAddress,
} from "./http-api-server-types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
const SERVER_HEADERS_TIMEOUT_MS = 60_000;
const SERVER_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const SERVER_REQUEST_TIMEOUT_MS = 30_000;
const SERVER_MAX_HEADERS_COUNT = 2_000;
const SERVER_MAX_REQUESTS_PER_SOCKET = 1_000;
const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;

export type {
  HttpApiServerOptions,
  InjectRequestOptions,
  InjectResponse,
  StartServerOptions,
  StartedServerAddress,
} from "./http-api-server-types.js";

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
  private readonly adminRuntimeDirectiveService: AdminRuntimeDirectiveService;
  private readonly promptRegistryService: HierarchicalPromptRegistryService;
  private readonly apiDefaultTimeoutMs: number;
  private readonly apiMaxTimeoutMs: number;
  private readonly requestDeduplication = createDeduplicationMiddleware({ allowInMemoryInProduction: true });
  private readonly idempotencyMiddleware = createIdempotencyKeyMiddleware();
  private workerHeartbeatSweepTimer: NodeJS.Timeout | null = null;
  private readonly staleWorkerIncidentIds = new Set<string>();
  private readonly activeSockets = new Set<Socket>();
  private activeRequestCount = 0;
  private isShuttingDown = false;
  private readonly activeRequestDrainResolvers = new Set<() => void>();

  public constructor(private readonly options: HttpApiServerOptions) {
    this.divisionRegistry = options.divisionRegistry ?? safeLoadDivisionRegistry();
    this.rateLimiter = options.rateLimiter === undefined
      ? createDefaultApiRateLimiter(process.env)
      : options.rateLimiter;
    this.incidentService = options.incidentService ?? createNoOpIncidentFacadeService();
    this.packCatalogService = options.packCatalogService ?? new PackCatalogService();
    this.costReportService = options.costReportService ?? new CostReportService();
    this.configRolloutService = options.configRolloutService ?? new ConfigRolloutService();
    this.tenantRegistryService = options.tenantRegistryService ?? new TenantBoundaryRegistryService();
    this.adminConfigService = options.adminConfigService ?? new AdminConfigService();
    this.adminRuntimeDirectiveService = options.adminRuntimeDirectiveService ?? new AdminRuntimeDirectiveService();
    this.promptRegistryService = options.promptRegistryService ?? new HierarchicalPromptRegistryService();
    this.apiDefaultTimeoutMs = normalizeApiTimeout(options.apiDefaultTimeoutMs, 5_000, 5_000);
    this.apiMaxTimeoutMs = normalizeApiTimeout(options.apiMaxTimeoutMs, 30_000, 30_000);
    const envOrigins = process.env["AA_API_ALLOWED_ORIGINS"] != null
      ? parseAllowedOrigins(process.env["AA_API_ALLOWED_ORIGINS"])
      : [];
    const allowedOrigins = (options.cors?.allowedOrigins ?? envOrigins);
    const hasOrigins = allowedOrigins.length > 0;
    const corsConfigInput: Partial<CorsConfig> = {};
    if (hasOrigins) {
      corsConfigInput.allowedOrigins = allowedOrigins;
    }
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
      void this.handleRequest(request, response).catch((error: unknown) => {
        const normalized = normalizeError(error);
        if (response.headersSent) {
          response.end();
          return;
        }
        response.writeHead(normalized.statusCode, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          error: normalized.code,
          message: normalized.message,
          requestId: readRequestId({
            method: request.method,
            url: request.url,
            headers: normalizeHeaders(request.headers),
            body: null,
          }),
        }));
      });
    });
    this.server.setTimeout(SERVER_REQUEST_TIMEOUT_MS);
    this.server.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;
    this.server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;
    this.server.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
    this.server.maxHeadersCount = SERVER_MAX_HEADERS_COUNT;
    this.server.maxRequestsPerSocket = SERVER_MAX_REQUESTS_PER_SOCKET;
    this.server.on("connection", (socket) => {
      this.activeSockets.add(socket);
      socket.on("close", () => {
        this.activeSockets.delete(socket);
      });
    });
  }

  public async start(options: StartServerOptions = {}): Promise<StartedServerAddress> {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 0;
    this.isShuttingDown = false;

    if (this.options.enableWebSocket && this.options.authService && this.webSocketBridge == null) {
      this.webSocketBridge = new WebSocketBridge(
        this.server,
        this.options.authService,
      );
      logger.info("WebSocket bridge initialized", { path: "/ws/v1/stream" });
    }

    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });
    this.startWorkerHeartbeatSweep();

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
    this.isShuttingDown = true;
    this.staleWorkerIncidentIds.clear();
    if (this.workerHeartbeatSweepTimer != null) {
      clearInterval(this.workerHeartbeatSweepTimer);
      this.workerHeartbeatSweepTimer = null;
    }
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
    await this.waitForActiveRequestsToDrain();
  }

  public broadcastTaskEvent(taskId: string, event: TaskWebSocketEvent): void {
    this.webSocketBridge?.broadcastToTask(taskId, event);
  }

  public getConnectedClientCount(): number {
    return this.webSocketBridge?.getClientCount() ?? 0;
  }

  public async inject(options: InjectRequestOptions): Promise<InjectResponse> {
    const startedAt = Date.now();
    const headers = normalizeHeaders(options.headers);
    if ((options.body ?? null) !== null && headers["content-type"] == null) {
      headers["content-type"] = "application/json";
    }
    const method = options.method ?? "GET";
    const requestId = readRequestId({
      method,
      url: options.url,
      headers,
      body: options.body ?? null,
    });
    const versionDecision = globalVersionRoutingMiddleware.selectVersion(
      globalVersionRoutingMiddleware.parseAcceptVersion(headers["accept-version"] ?? null),
    );
    let payload: ApiResponsePayload;
    if (!versionDecision.acceptable) {
      payload = this.buildJsonErrorResponse(requestId, versionDecision.statusCode, {
        code: versionDecision.reasonCode,
        message: "Requested API version is not supported.",
        details: {
          warnings: versionDecision.warnings,
        },
      });
      payload.headers["x-api-version"] = versionDecision.version;
    } else if (method === "OPTIONS") {
      const endpoint = this.extractEndpointKey(options.url);
      payload = await this.handlePreflightRequest(
        requestId,
        headers.origin,
        this.buildRateLimitBucket({ method, url: options.url, headers, body: options.body ?? null }, endpoint),
      );
    } else if (this.rateLimiter != null) {
      const endpoint = this.extractEndpointKey(options.url);
      const result: RateLimitCheckResult = await this.rateLimiter.checkAndConsume(
        this.buildRateLimitBucket({ method, url: options.url, headers, body: options.body ?? null }, endpoint),
      );
      payload = !result.allowed
        ? this.attachRateLimitHeaders(this.buildJsonErrorResponse(requestId, 429, {
          code: "api.rate_limit_exceeded",
          message: "Too many requests. Please retry later.",
        }), result)
        : this.attachRateLimitHeaders(await this.dispatchRequest({
          method,
          url: options.url,
          headers,
          body: options.body ?? null,
        }), result);
    } else {
      payload = await this.dispatchRequest({
        method,
        url: options.url,
        headers,
        body: options.body ?? null,
      });
    }
    payload.headers["x-api-version"] ??= versionDecision.version;
    if (versionDecision.warnings.length > 0) {
      payload.headers["warning"] = versionDecision.warnings.join(", ");
    }
    const response = this.decoratePayload(
      this.attachResponseTracing(payload, requestId, {
        method,
        url: options.url,
        headers,
        body: options.body ?? null,
      }),
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
    this.trackActiveRequest(response);
    const headers = normalizeHeaders(request.headers);
    const requestId = readRequestId({
      method: request.method,
      url: request.url,
      headers,
      body: null,
    });
    let payload: ApiResponsePayload;

    try {
      if (this.isShuttingDown) {
        payload = this.buildJsonErrorResponse(requestId, 503, {
          code: "api.server_shutting_down",
          message: "Server is shutting down and is not accepting new requests.",
        });
        const finalizedPayload = this.decoratePayload(payload, headers.origin);
        this.recordPrometheusHttpMetric(request.method ?? "GET", request.url, finalizedPayload.statusCode, Date.now() - startedAt);
        this.sendPayload(response, finalizedPayload, headers["accept-encoding"]);
        return;
      }
      const versionDecision = globalVersionRoutingMiddleware.selectVersion(
        globalVersionRoutingMiddleware.parseAcceptVersion(headers["accept-version"] ?? null),
      );
      if (!versionDecision.acceptable) {
        payload = this.buildJsonErrorResponse(requestId, versionDecision.statusCode, {
          code: versionDecision.reasonCode,
          message: "Requested API version is not supported.",
          details: {
            warnings: versionDecision.warnings,
          },
        });
        payload.headers["x-api-version"] = versionDecision.version;
      }
      // 1. Preflight (CORS OPTIONS) — no rate limit, no body
      else if ((request.method ?? "GET") === "OPTIONS") {
        const endpoint = this.extractEndpointKey(request.url ?? "/");
        payload = await this.handlePreflightRequest(
          requestId,
          headers.origin,
          this.buildRateLimitBucket({
            method: request.method ?? "GET",
            url: request.url ?? "/",
            headers,
            body: null,
          }, endpoint, request.socket?.remoteAddress),
        );
      }
      // 2. Rate limiting check (non-OPTIONS only)
      else if (this.rateLimiter != null) {
        const endpoint = this.extractEndpointKey(request.url ?? "/");
        const result: RateLimitCheckResult = await this.rateLimiter.checkAndConsume(
          this.buildRateLimitBucket({
            method: request.method ?? "GET",
            url: request.url ?? "/",
            headers,
            body: null,
          }, endpoint, request.socket?.remoteAddress),
        );
        if (!result.allowed) {
          payload = this.buildJsonErrorResponse(requestId, 429, {
            code: "api.rate_limit_exceeded",
            message: "Too many requests. Please retry later.",
          });
          payload = this.attachRateLimitHeaders(payload, result);
        } else {
          payload = this.attachRateLimitHeaders(await this.routeRequest(requestId, request, headers), result);
        }
      }
      // 3. No rate limiter — normal routing
      else {
        payload = await this.routeRequest(requestId, request, headers);
      }
      payload.headers["x-api-version"] ??= versionDecision.version;
      if (versionDecision.warnings.length > 0) {
        payload.headers["warning"] = versionDecision.warnings.join(", ");
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
  private async routeRequest(requestId: string, request: IncomingMessage, headers: Record<string, string | undefined>): Promise<ApiResponsePayload> {
    const contentLength = Number.parseInt(headers["content-length"] ?? "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return this.buildJsonErrorResponse(requestId, 413, {
        code: "api.payload_too_large",
        message: `Request body exceeds ${MAX_BODY_BYTES} bytes.`,
      });
    }
    return this.withRequestTimeout(
      {
        method: request.method,
        url: request.url,
        headers,
        body: null,
      },
      (async () => {
        const body = await readIncomingBody(request);
        return this.dispatchRequest({
          method: request.method,
          url: request.url,
          headers,
          body,
        }, {
          skipRouteTimeout: true,
        });
      })(),
    );
  }

  /**
   * Extracts a normalized endpoint key from a URL path for use as a rate limit key.
   * Strips query strings and normalizes paths like /tasks/abc123 → /tasks/:id.
   */
  private extractEndpointKey(url: string): string {
    try {
      const pathname = parseUrl(url).pathname ?? "/";
      return this.normalizeRateLimitPath(pathname);
    } catch {
      return "/";
    }
  }

  private normalizeRateLimitPath(pathname: string): string {
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      return "/";
    }
    const prefixLength = segments[0] === "api" && segments[1] === "v1"
      ? 2
      : segments[0] === "v1"
        ? 1
        : 0;
    if (prefixLength > 0) {
      for (let index = prefixLength; index < segments.length; index++) {
        const segment = segments[index];
        if (segment != null && isLikelyPathIdentifier(segment)) {
          segments[index] = ":id";
        }
      }
    }
    return `/${segments.join("/")}`;
  }

  private buildRateLimitBucket(
    request: ApiRequestLike,
    endpoint: string,
    fallbackClientIp?: string | null,
  ): string {
    const principal = authenticateOptionalPrincipal(request, this.options.authService ?? null);
    if (principal?.tenantId != null) {
      return `tenant:${principal.tenantId}:endpoint:${endpoint}`;
    }
    const clientIp = this.resolveClientIp(request.headers, fallbackClientIp);
    return `ip:${clientIp}:endpoint:${endpoint}`;
  }

  private resolveClientIp(headers: Record<string, string | undefined>, fallback: string | undefined | null): string {
    return fallback?.trim() || "unknown";
  }

  private async handlePreflightRequest(
    requestId: string,
    origin: string | undefined,
    rateLimitKey: string,
  ): Promise<ApiResponsePayload> {
    if (this.rateLimiter != null) {
      const result = await this.rateLimiter.checkAndConsume(rateLimitKey);
      if (!result.allowed) {
        return this.attachRateLimitHeaders(this.buildJsonErrorResponse(requestId, 429, {
          code: "api.rate_limit_exceeded",
          message: "Too many requests. Please retry later.",
        }), result);
      }
      return this.attachRateLimitHeaders(this.buildCorsPreflightResponse(requestId, origin), result);
    }
    return this.buildCorsPreflightResponse(requestId, origin);
  }

  private buildCorsPreflightResponse(requestId: string, origin: string | undefined): ApiResponsePayload {
    const headers = buildPreflightHeaders(origin, this.corsConfig);
    if (origin != null && origin.trim().length > 0 && Object.keys(headers).length === 0) {
      return this.buildJsonErrorResponse(requestId, 403, {
        code: "api.origin_forbidden",
        message: "Request origin is not allowed.",
      });
    }
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  private assertMutatingOriginAllowed(request: ApiRequestLike): void {
    const method = (request.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return;
    }
    const origin = request.headers.origin;
    if (origin == null || origin.trim().length === 0) {
      return;
    }
    if (!isOriginAllowed(origin, this.corsConfig)) {
      throw new ApiError(403, "api.origin_forbidden", "Request origin is not allowed.");
    }
  }

  private async dispatchRequest(
    request: ApiRequestLike,
    options: {
      skipRouteTimeout?: boolean;
    } = {},
  ): Promise<ApiResponsePayload> {
    const requestId = readRequestId(request);
    const principal = authenticateOptionalPrincipal(request, this.options.authService ?? null);

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
        this.assertMutatingOriginAllowed(request);
        assertJsonRequestContentType(request, request.body);
        const route = matchRoute(request);
        if (!route) {
          return this.attachResponseTracing(this.buildJsonErrorResponse(requestId, 404, {
            code: "api.not_found",
            message: "Route not found.",
          }), requestId, request);
        }

        const tenantId = principal?.tenantId ?? null;
        const method = request.method ?? "GET";
        const idempotencyKey = extractIdempotencyKey(request.headers, "Idempotency-Key", request.body);
        const guardPlan = buildRequestGuardPlan({
          method,
          path: route.pathname,
          idempotencyKey,
        });

        if (planIncludesGuard(guardPlan.beforeDispatch, "request-deduplication")) {
          const deduplicationKey = this.requestDeduplication.generateKey(tenantId != null ? { tenantId } : {});
          const fingerprint = this.requestDeduplication.generateFingerprint({
            method,
            path: route.pathname,
            ...(typeof request.body === "string" ? { body: request.body } : {}),
            ...(tenantId != null ? { tenantId } : {}),
          });
          const deduplicationDecision = this.requestDeduplication.check(deduplicationKey, fingerprint);
          if (!deduplicationDecision.allowed) {
            return this.attachResponseTracing({
              ...this.buildJsonErrorResponse(requestId, 409, {
                code: "api.duplicate_request",
                message: "Duplicate request rejected within deduplication window.",
              }),
              headers: {
                "content-type": "application/json; charset=utf-8",
                "x-request-id": requestId,
                ...(deduplicationDecision.originalRequestId != null
                  ? { "x-original-request-id": deduplicationDecision.originalRequestId }
                  : {}),
                ...(deduplicationDecision.retryAfterMs != null
                  ? { "retry-after-ms": String(deduplicationDecision.retryAfterMs) }
                  : {}),
              },
            }, requestId, request);
          }
        }

        const idempotencyDecision = await this.idempotencyMiddleware.check({
          method,
          path: route.pathname,
          ...(idempotencyKey != null ? { idempotencyKey } : {}),
          tenantId,
          ...(typeof request.body === "string" ? { body: request.body } : {}),
        });
        if (idempotencyDecision.error != null) {
          return this.attachResponseTracing(this.buildJsonErrorResponse(
            requestId,
            idempotencyDecision.error.statusCode,
            {
              code: idempotencyDecision.error.code,
              message: idempotencyDecision.error.message,
            },
          ), requestId, request);
        }
        if (idempotencyDecision.cachedResponse != null) {
          const body = typeof idempotencyDecision.cachedResponse.body === "string"
            ? idempotencyDecision.cachedResponse.body
            : JSON.stringify(idempotencyDecision.cachedResponse.body, null, 2);
          return this.attachResponseTracing({
            statusCode: idempotencyDecision.cachedResponse.statusCode,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "x-request-id": requestId,
              "x-idempotent-replay": "true",
            },
            body,
          }, requestId, request);
        }

        const ctx: RouteContext = { request, route, requestId, principal };
        const resolved = options.skipRouteTimeout
          ? await this.resolveRouteResponse(route, request, ctx)
          : await this.withRequestTimeout(
            request,
            this.resolveRouteResponse(route, request, ctx),
          );
        if (resolved == null) {
          return this.attachResponseTracing(this.buildJsonErrorResponse(requestId, 404, {
            code: "api.not_found",
            message: "Route not found.",
          }), requestId, request);
        }
        if (idempotencyKey != null && this.idempotencyMiddleware.isWriteOperation(method)) {
          await this.idempotencyMiddleware.record({
            method,
            idempotencyKey,
            tenantId,
            statusCode: resolved.statusCode,
            responseBody: resolved.body,
          });
        }
        return this.attachResponseTracing(resolved, requestId, request);
      } catch (error) {
        return this.attachResponseTracing(this.handleError(error, requestId, request), requestId, request);
      }
    });
  }

  private attachResponseTracing(
    payload: ApiResponsePayload,
    requestId: string,
    request: ApiRequestLike,
  ): ApiResponsePayload {
    const traceId = request.headers["x-correlation-id"] ?? payload.headers["x-trace-id"] ?? requestId;
    return {
      ...payload,
      headers: {
        ...payload.headers,
        "x-request-id": payload.headers["x-request-id"] ?? requestId,
        "x-trace-id": traceId,
      },
    };
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
        reject(new ApiError(HTTP_STATUS_GATEWAY_TIMEOUT, "api.request_timeout", `Request exceeded ${timeoutMs} ms timeout.`));
      }, timeoutMs);
      timer.unref?.();
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
    const traceId = normalized.traceId ?? request.headers["x-correlation-id"] ?? requestId;
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
      ...(normalized.details != null ? { details: normalized.details } : {}),
      traceId,
    });
  }

  private buildRouteTable(): RouteDefinition[] {
    return [
      ...createHealthRoutes({
        missionControlService: this.options.missionControlService,
        isShuttingDown: () => this.isShuttingDown,
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
        authService: this.options.authService ?? null,
      }),
      ...createDivisionRoutes({
        divisionRegistry: this.divisionRegistry,
        missionControlService: this.options.missionControlService,
      }),
      ...createDashboardRoutes({
        authService: this.options.authService ?? null,
        missionControlService: this.options.missionControlService,
      }),
      ...createMissionRoutes({
        authService: this.options.authService ?? null,
        missionRepository: this.options.missionRepository ?? null,
      }),
      ...createYonoRoutes({
        authService: this.options.authService ?? null,
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
        ...(this.options.taskStore != null ? { taskStore: this.options.taskStore } : {}),
        missionRepository: this.options.missionRepository ?? null,
        ...(this.options.intakeAdmissionService != null ? { intakeAdmissionService: this.options.intakeAdmissionService } : {}),
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
      ...createHarnessRunsRoutes({
        authService: this.options.authService ?? null,
      }),
      ...createAdminRoutes({
        authService: this.options.authService ?? null,
        missionControlService: this.options.missionControlService,
        coordinatorLoadBalancingService: this.options.coordinatorLoadBalancingService ?? null,
        configRolloutService: this.configRolloutService,
        tenantRegistryService: this.tenantRegistryService,
        costReportService: this.costReportService,
        adminConfigService: this.adminConfigService,
        adminRuntimeDirectiveService: this.adminRuntimeDirectiveService,
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
      ...createReplaySessionRoutes({
        authService: this.options.authService ?? null,
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
      details?: Record<string, unknown> | null;
      traceId?: string | null;
    },
  ): ApiResponsePayload {
    const traceId = error.traceId ?? requestId;
    return {
      statusCode,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        requestId,
        traceId,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details != null ? { details: error.details } : {}),
        },
      }, null, 2),
    };
  }

  private startWorkerHeartbeatSweep(): void {
    if (this.workerHeartbeatSweepTimer != null) {
      return;
    }
    if (this.options.taskStore == null) {
      return;
    }
    const intervalMs = Math.max(1, Math.trunc(this.options.workerHeartbeatSweepIntervalMs ?? 0));
    if (intervalMs <= 0) {
      return;
    }
    this.workerHeartbeatSweepTimer = setInterval(() => {
      this.sweepStaleWorkerHeartbeats();
    }, intervalMs);
    this.workerHeartbeatSweepTimer.unref?.();
  }

  private sweepStaleWorkerHeartbeats(): void {
    if (this.options.taskStore == null) {
      return;
    }
    const now = new Date().toISOString();
    const ttlMs = Math.max(1, Math.trunc(this.options.workerHeartbeatTtlMs ?? 5 * 60 * 1000));
    const registry = new WorkerRegistryService(this.options.taskStore);
    for (const worker of registry.listStaleWorkers(now, ttlMs)) {
      const existing = this.options.taskStore.worker.getWorkerSnapshot(worker.workerId);
      if (existing == null || existing.status === "offline") {
        continue;
      }
      this.options.taskStore.worker.upsertWorkerSnapshot({
        ...existing,
        status: "offline",
        updatedAt: now,
      });
      if (!this.staleWorkerIncidentIds.has(worker.workerId)) {
        this.incidentService.openIncident({
          severity: "high",
          title: `Worker ${worker.workerId} heartbeat became stale and was marked offline`,
          linkedEvidenceRefs: [worker.workerId],
        });
        this.staleWorkerIncidentIds.add(worker.workerId);
      }
    }
  }

  private trackActiveRequest(response: ServerResponse): void {
    this.activeRequestCount += 1;
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
      if (this.activeRequestCount === 0) {
        for (const resolve of this.activeRequestDrainResolvers) {
          resolve();
        }
        this.activeRequestDrainResolvers.clear();
      }
    };
    response.once("finish", finish);
    response.once("close", finish);
  }

  private async waitForActiveRequestsToDrain(): Promise<void> {
    if (this.activeRequestCount === 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      const onDrained = () => {
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(() => {
        this.activeRequestDrainResolvers.delete(onDrained);
        for (const socket of this.activeSockets) {
          socket.destroy();
        }
        resolve();
      }, SHUTDOWN_DRAIN_TIMEOUT_MS);
      timeout.unref?.();
      this.activeRequestDrainResolvers.add(onDrained);
    });
  }

  private attachRateLimitHeaders(payload: ApiResponsePayload, result: RateLimitCheckResult): ApiResponsePayload {
    const headers: Record<string, string> = {
      ...payload.headers,
      "x-ratelimit-remaining": String(result.remaining),
    };
    if (result.retryAfterMs != null) {
      headers["retry-after-ms"] = String(result.retryAfterMs);
      headers["retry-after"] = String(Math.ceil(result.retryAfterMs / 1000));
    }
    return {
      ...payload,
      headers,
    };
  }

  private decoratePayload(payload: ApiResponsePayload, origin: string | undefined): ApiResponsePayload {
    return decorateResponseHeaders(payload, origin, this.corsConfig);
  }

  private shouldCompressPayload(payload: ApiResponsePayload, acceptEncoding: string | undefined): "br" | "gzip" | null {
    if (payload.body.length < 1024) {
      return null;
    }
    if (payload.headers["content-encoding"] != null || payload.headers["transfer-encoding"] != null) {
      return null;
    }
    const contentType = payload.headers["content-type"]?.toLowerCase() ?? "";
    if (contentType.startsWith("text/event-stream") || contentType.includes("application/x-ndjson")) {
      return null;
    }
    const normalizedAcceptEncoding = (acceptEncoding ?? "").toLowerCase();
    if (normalizedAcceptEncoding.includes("br")) {
      return "br";
    }
    if (normalizedAcceptEncoding.includes("gzip")) {
      return "gzip";
    }
    return null;
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

    const compression = this.shouldCompressPayload(payload, acceptEncoding);
    if (compression != null) {
      response.removeHeader("content-length");
      response.removeHeader("transfer-encoding");
      response.setHeader("content-encoding", compression);
      response.setHeader("transfer-encoding", "chunked");
      const compress = compression === "br" ? createBrotliCompress() : createGzip();
      void pipeline(
        Readable.from([payload.body]),
        compress,
        response,
      ).catch((error: unknown) => {
        logger.warn("http.compression_pipeline_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        response.destroy();
      });
      return;
    }

    response.end(payload.body);
  }

  private recordPrometheusHttpMetric(method: string, url: string | undefined, statusCode: number, durationMs: number | null): void {
    const exporter = this.options.prometheusMetricsExporter;
    if (exporter == null) {
      return;
    }
    const route = parseUrl(url ?? "/", true);
    exporter.recordHttpRequest(method, this.normalizeRateLimitPath(route.pathname ?? "/"), statusCode, durationMs);
  }
}

function isLikelyPathIdentifier(segment: string): boolean {
  if (segment.length >= 12 && /^[A-Za-z0-9_-]+$/.test(segment)) {
    return true;
  }
  if (/^[0-9]+$/.test(segment)) {
    return true;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment);
}

function normalizeApiTimeout(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value) || value == null || value <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(value), max);
}

function createDefaultApiRateLimiter(env: NodeJS.ProcessEnv): DistributedRateLimiter | null {
  if (env["AA_API_RATE_LIMIT_DISABLED"] === "1") {
    return null;
  }
  const maxCalls = parsePositiveIntegerEnv(env["AA_API_RATE_LIMIT_MAX_CALLS"]) ?? 100;
  const windowMs = parsePositiveIntegerEnv(env["AA_API_RATE_LIMIT_WINDOW_MS"]) ?? 1000;
  const redis = readRedisConnectionConfigFromEnv("AA_API_RATE_LIMIT_REDIS", env);
  return new DistributedRateLimiter({
    maxCalls,
    windowMs,
    allowLocalFallbackInProduction: true,
    ...(redis != null ? { redis } : {}),
  });
}

function parsePositiveIntegerEnv(raw: string | undefined): number | null {
  if (raw == null || raw.trim().length === 0) {
    return null;
  }
  const parsed = Number(raw.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
