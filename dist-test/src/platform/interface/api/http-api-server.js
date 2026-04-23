import { createServer } from "node:http";
import { createGzip, createBrotliCompress } from "node:zlib";
import { parse as parseUrl } from "node:url";
import { ConfigRolloutService } from "../../control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../control-plane/tenant/index.js";
import { safeLoadDivisionRegistry } from "../../../domains/governance/safe-load-division-registry.js";
import { provideContext } from "../../shared/context/runtime-context.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { AppError } from "../../contracts/errors.js";
import { WebSocketBridge } from "../channel-gateway/websocket-bridge.js";
import { createNoOpIncidentFacadeService, } from "./facade-interfaces.js";
import { PackCatalogService } from "./pack-catalog-service.js";
import { CostReportService } from "./cost-report-service.js";
import { AdminConfigService } from "./admin-config-service.js";
import { HierarchicalPromptRegistryService } from "../../prompt-engine/registry/hierarchical-registry-service.js";
import { readRequestId } from "./http-server/utils.js";
import { MAX_BODY_BYTES, authenticateOptionalPrincipal, matchRoute, normalizeHeaders, readIncomingBody, } from "./http-server/request-helpers.js";
import { ApiError, normalizeError } from "./http-server/api-error.js";
import { createHealthRoutes, createMetricsRoutes, createAuthRoutes, createBillingRoutes, createDivisionRoutes, createDashboardRoutes, createGatewayRoutes, createTaskRoutes, createWebhookRoutes, createApprovalRoutes, createAdminRoutes, createConsoleRoutes, createPlaneRoutes, createIncidentRoutes, createPackRoutes, createCostRoutes, createPromptRoutes, } from "./http-server/index.js";
import { buildPreflightHeaders, decorateResponseHeaders, normalizeCorsConfig, parseAllowedOrigins, } from "./http-server/response-hardening.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class HttpApiServer {
    options;
    server;
    divisionRegistry;
    routeTable;
    corsConfig;
    webSocketBridge = null;
    rateLimiter;
    incidentService;
    packCatalogService;
    costReportService;
    configRolloutService;
    tenantRegistryService;
    adminConfigService;
    promptRegistryService;
    apiDefaultTimeoutMs;
    apiMaxTimeoutMs;
    constructor(options) {
        this.options = options;
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
        const corsConfigInput = {
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
    async start(options = {}) {
        const host = options.host ?? "127.0.0.1";
        const port = options.port ?? 0;
        await new Promise((resolve, reject) => {
            this.server.once("error", reject);
            this.server.listen(port, host, () => {
                this.server.off("error", reject);
                resolve();
            });
        });
        // Initialize WebSocket bridge if enabled and auth service is available
        if (this.options.enableWebSocket && this.options.authService) {
            this.webSocketBridge = new WebSocketBridge(this.server, this.options.authService);
            logger.info("WebSocket bridge initialized", { path: "/ws" });
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
    async stop() {
        if (!this.server.listening) {
            return;
        }
        // Close WebSocket bridge first
        if (this.webSocketBridge) {
            await this.webSocketBridge.close();
            this.webSocketBridge = null;
        }
        await new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    const nodeError = error;
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
    broadcastTaskEvent(taskId, event) {
        this.webSocketBridge?.broadcastToTask(taskId, event);
    }
    async inject(options) {
        const startedAt = Date.now();
        const headers = normalizeHeaders(options.headers);
        const method = options.method ?? "GET";
        const response = this.decoratePayload(method === "OPTIONS"
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
            }), headers.origin);
        this.recordPrometheusHttpMetric(method, options.url, response.statusCode, Date.now() - startedAt);
        return {
            ...response,
            json() {
                return JSON.parse(response.body);
            },
            text() {
                return response.body;
            },
        };
    }
    async handleRequest(request, response) {
        const startedAt = Date.now();
        const headers = normalizeHeaders(request.headers);
        const requestId = readRequestId({
            method: request.method,
            url: request.url,
            headers,
            body: null,
        });
        let payload;
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
                const endpoint = this.extractEndpointKey(request.url ?? "/");
                const result = await this.rateLimiter.checkAndConsume(`${clientIp}:${endpoint}`);
                if (!result.allowed) {
                    payload = this.buildJsonErrorResponse(requestId, 429, {
                        code: "api.rate_limit_exceeded",
                        message: "Too many requests. Please retry later.",
                    });
                    if (result.retryAfterMs != null) {
                        payload = {
                            ...payload,
                            headers: { ...payload.headers, "retry-after-ms": String(result.retryAfterMs) },
                        };
                    }
                }
                else {
                    payload = await this.routeRequest(requestId, request, headers);
                }
            }
            // 3. No rate limiter — normal routing
            else {
                payload = await this.routeRequest(requestId, request, headers);
            }
        }
        catch (error) {
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
    async routeRequest(requestId, request, headers) {
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
        });
    }
    /**
     * Extracts a normalized endpoint key from a URL path for use as a rate limit key.
     * Strips query strings and normalizes paths like /tasks/abc123 → /tasks/:id.
     */
    extractEndpointKey(url) {
        try {
            const pathname = parseUrl(url).pathname ?? "/";
            return pathname;
        }
        catch {
            return "/";
        }
    }
    async dispatchRequest(request) {
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
                const route = matchRoute(request);
                if (!route) {
                    return this.buildJsonErrorResponse(requestId, 404, {
                        code: "api.not_found",
                        message: "Route not found.",
                    });
                }
                const ctx = { request, route, requestId, principal };
                const resolved = await this.withRequestTimeout(request, this.resolveRouteResponse(route, request, ctx));
                if (resolved == null) {
                    return this.buildJsonErrorResponse(requestId, 404, {
                        code: "api.not_found",
                        message: "Route not found.",
                    });
                }
                return resolved;
            }
            catch (error) {
                return this.handleError(error, requestId, request);
            }
        });
    }
    async resolveRouteResponse(route, request, ctx) {
        const method = request.method ?? "GET";
        for (const def of this.routeTable) {
            if (def.method !== method) {
                continue;
            }
            if (def.pathname != null) {
                if (def.pathname === route.pathname) {
                    return def.handler(ctx);
                }
            }
            else if (def.segments) {
                const result = await def.handler(ctx);
                if (result !== null) {
                    return result;
                }
            }
        }
        return null;
    }
    async withRequestTimeout(request, operation) {
        const timeoutMs = this.resolveRequestTimeoutMs(request);
        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new ApiError(504, "api.request_timeout", `Request exceeded ${timeoutMs} ms timeout.`));
            }, timeoutMs);
            void operation.then((value) => {
                clearTimeout(timer);
                resolve(value);
            }, (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    resolveRequestTimeoutMs(request) {
        const requested = Number.parseInt(request.headers["x-aa-timeout-ms"] ?? "", 10);
        if (!Number.isFinite(requested) || requested <= 0) {
            return this.apiDefaultTimeoutMs;
        }
        return Math.min(Math.trunc(requested), this.apiMaxTimeoutMs);
    }
    handleError(error, requestId, request) {
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
    buildRouteTable() {
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
    buildJsonResponse(requestId, statusCode, payload) {
        return {
            statusCode,
            headers: {
                "content-type": "application/json; charset=utf-8",
                "x-request-id": requestId,
            },
            body: JSON.stringify({ requestId, data: payload }, null, 2),
        };
    }
    buildJsonErrorResponse(requestId, statusCode, error) {
        return {
            statusCode,
            headers: {
                "content-type": "application/json; charset=utf-8",
                "x-request-id": requestId,
            },
            body: JSON.stringify({ requestId, error }, null, 2),
        };
    }
    decoratePayload(payload, origin) {
        return decorateResponseHeaders(payload, origin, this.corsConfig);
    }
    sendPayload(response, payload, acceptEncoding) {
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
    recordPrometheusHttpMetric(method, url, statusCode, durationMs) {
        const exporter = this.options.prometheusMetricsExporter;
        if (exporter == null) {
            return;
        }
        const route = parseUrl(url ?? "/", true);
        exporter.recordHttpRequest(method, route.pathname ?? "/", statusCode, durationMs);
    }
}
function normalizeApiTimeout(value, fallback, max) {
    if (!Number.isFinite(value) || value == null || value <= 0) {
        return fallback;
    }
    return Math.min(Math.trunc(value), max);
}
//# sourceMappingURL=http-api-server.js.map