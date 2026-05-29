import { defaultMockApiShape } from "./mock-data.js";
import { generateStableId } from "./runtime-support.js";
export const DEFAULT_ACCEPT_VERSION_HEADER = "2026-04-01,2026-01-01";
export class RestHttpError extends Error {
    status;
    uiAction;
    retryAfterMs;
    category;
    statusCode;
    isRetryable;
    code;
    constructor(status, retryAfterMs = null, details = {}) {
        super(details.message ?? `rest.http_error:${status}`);
        this.status = status;
        this.statusCode = status;
        this.retryAfterMs = retryAfterMs;
        this.category = classifyRestHttpError(status);
        this.isRetryable = status === 429 || status >= 500;
        this.code = details.code ?? null;
        this.uiAction = status === 401
            ? "redirect_to_login"
            : status === 403
                ? "access_denied"
                : status === 406
                    ? "version_not_supported"
                    : status === 429
                        ? "backoff_and_retry"
                        : "none";
    }
}
export class MockTransport {
    data;
    constructor(data = defaultMockApiShape) {
        this.data = data;
    }
    async send(request) {
        const payload = this.resolve(request.path, request.body);
        return {
            status: this.resolveStatus(request.method),
            data: payload,
        };
    }
    resolveStatus(method) {
        if (method === "POST") {
            return 201;
        }
        if (method === "DELETE") {
            return 204;
        }
        return 200;
    }
    resolve(path, body) {
        if (path.includes("/dashboard")) {
            return this.data.dashboard;
        }
        if (path.includes("/tasks")) {
            return this.data.tasks;
        }
        if (path.includes("/workflow-runs/")) {
            const workflowRunId = path.split("/workflow-runs/")[1]?.split("/")[0] ?? "";
            return this.data.workflowRunSteps[workflowRunId] ?? [];
        }
        if (path.includes("/workflows")) {
            return this.data.workflows;
        }
        if (path.includes("/approvals")) {
            return this.data.approvals;
        }
        if (path.includes("/incidents")) {
            return this.data.incidents;
        }
        if (path.includes("/workers")) {
            return this.data.workers;
        }
        if (path.includes("/queues")) {
            return this.data.queues;
        }
        if (path.includes("/agents")) {
            return this.data.agents;
        }
        if (path.includes("/metrics")) {
            return this.data.analytics;
        }
        if (path.includes("/cost")) {
            return this.data.costs;
        }
        if (path.includes("/marketplace")) {
            return this.data.marketplace;
        }
        if (path.includes("/explanations")) {
            return this.data.explanations;
        }
        if (path.includes("/roles")) {
            return this.data.roles;
        }
        if (path.includes("/feature-flags")) {
            return this.data.featureFlags;
        }
        if (path.includes("/models")) {
            return this.data.models;
        }
        if (path.includes("/domains")) {
            return this.data.domainConfigs;
        }
        if (path.includes("/tenants")) {
            return this.data.tenants;
        }
        if (path.includes("/webhooks")) {
            return this.data.webhooks;
        }
        if (path.includes("/users")) {
            return this.data.users;
        }
        if (path.includes("/system-config")) {
            return this.data.systemConfig;
        }
        if (path.includes("/preferences")) {
            return this.data.preferences;
        }
        return { ok: true, body };
    }
}
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
};
const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
};
export class HttpTransport {
    options;
    fetchImplementation;
    fallbackTransport;
    retryConfig;
    circuitBreaker;
    constructor(options) {
        this.options = options;
        this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
        this.fallbackTransport = options.fallbackToMock === true ? new MockTransport() : null;
        this.retryConfig = DEFAULT_RETRY_CONFIG;
        this.circuitBreaker = { failures: 0, lastFailure: 0, state: "closed" };
    }
    shouldRetry(error, request) {
        if (!this.isRetryAllowed(request)) {
            return false;
        }
        if (error instanceof RestHttpError) {
            return error.status >= 500 || error.status === 429;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
            return false;
        }
        return true;
    }
    async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    calculateBackoff(attempt) {
        const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
        return Math.min(delay, this.retryConfig.maxDelayMs);
    }
    recordFailure() {
        this.circuitBreaker.failures += 1;
        this.circuitBreaker.lastFailure = Date.now();
        if (this.circuitBreaker.failures >= DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold) {
            this.circuitBreaker.state = "open";
        }
    }
    recordSuccess() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = "closed";
    }
    canAttempt() {
        if (this.circuitBreaker.state === "closed") {
            return true;
        }
        if (this.circuitBreaker.state === "open") {
            const elapsed = Date.now() - this.circuitBreaker.lastFailure;
            if (elapsed >= DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
                this.circuitBreaker.state = "half-open";
                return true;
            }
            return false;
        }
        return this.circuitBreaker.state === "half-open";
    }
    async parseResponse(response) {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
            return undefined;
        }
        const parsed = await response.json();
        if (parsed != null && typeof parsed === "object" && "data" in parsed) {
            return parsed.data;
        }
        if (parsed != null && typeof parsed === "object" && "envelopeId" in parsed && "schemaVersion" in parsed && "payload" in parsed) {
            return parsed.payload;
        }
        return parsed;
    }
    isRetryAllowed(request) {
        if (request.method === "GET") {
            return true;
        }
        if (request.method === "HEAD" || request.method === "OPTIONS") {
            return true;
        }
        return request.headers.has("Idempotency-Key") || request.headers.has("x-idempotency-key");
    }
    resolveRequestUrl(path) {
        const trimmed = path.replace(/^\uFEFF+/, "").trim();
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
            return trimmed;
        }
        const normalizedBaseUrl = this.options.baseUrl.replace(/\/$/, "");
        return `${normalizedBaseUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
    }
    async send(request) {
        const url = this.resolveRequestUrl(request.path);
        const requestBody = request.body == null ? null : JSON.stringify(this.wrapRequestBody(request));
        const requestHeaders = new Headers({
            "content-type": "application/json",
            "Accept-Version": this.options.acceptVersion ?? DEFAULT_ACCEPT_VERSION_HEADER,
            ...(this.options.headers ?? {}),
            ...Object.fromEntries(request.headers.entries()),
        });
        let lastError;
        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt += 1) {
            if (!this.canAttempt()) {
                throw new Error("rest.circuit_open:Circuit breaker is open");
            }
            try {
                const abortController = new AbortController();
                const timeoutMs = this.options.timeoutMs ?? 10_000;
                const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
                let response;
                try {
                    response = await this.fetchImplementation(url, {
                        method: request.method,
                        headers: requestHeaders,
                        body: requestBody,
                        credentials: this.options.credentials ?? "same-origin",
                        mode: this.options.mode ?? "cors",
                        signal: abortController.signal,
                    });
                }
                finally {
                    clearTimeout(timeoutHandle);
                }
                if (!response.ok) {
                    const retryAfterHeader = response.headers.get("retry-after");
                    const retryAfterSeconds = retryAfterHeader == null ? Number.NaN : Number(retryAfterHeader);
                    const details = await this.readErrorDetails(response);
                    throw new RestHttpError(response.status, Number.isFinite(retryAfterSeconds) ? Math.round(retryAfterSeconds * 1000) : null, details);
                }
                this.recordSuccess();
                return {
                    status: response.status,
                    data: await this.parseResponse(response),
                };
            }
            catch (error) {
                lastError = error;
                if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error, request)) {
                    await this.sleep(this.calculateBackoff(attempt));
                    continue;
                }
                break;
            }
        }
        this.recordFailure();
        if (this.fallbackTransport != null && !(lastError instanceof RestHttpError)) {
            return this.fallbackTransport.send(request);
        }
        throw lastError;
    }
    async readErrorDetails(response) {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
            return {};
        }
        try {
            const parsed = await response.clone().json();
            if (parsed == null || typeof parsed !== "object") {
                return {};
            }
            const root = parsed;
            const message = typeof root.error?.message === "string"
                ? root.error.message
                : typeof root.message === "string"
                    ? root.message
                    : undefined;
            const code = typeof root.error?.code === "string"
                ? root.error.code
                : typeof root.code === "string"
                    ? root.code
                    : null;
            return { ...(message == null ? {} : { message }), code };
        }
        catch {
            return {};
        }
    }
    wrapRequestBody(request) {
        if (request.body == null) {
            return null;
        }
        const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("x-idempotency-key") ?? undefined;
        return {
            envelopeId: generateStableId("env_"),
            schemaVersion: "v4.3",
            payload: request.body,
            ...(idempotencyKey == null ? {} : { idempotencyKey }),
        };
    }
}
function classifyRestHttpError(status) {
    if (status === 401 || status === 403) {
        return "auth";
    }
    if (status === 400 || status === 422) {
        return "validation";
    }
    if (status === 406) {
        return "contract";
    }
    if (status >= 500 || status === 429) {
        return "network";
    }
    return "business";
}
export class DefaultRESTClient {
    transport;
    interceptors;
    constructor(transport = (request) => new MockTransport().send(request), interceptors = []) {
        this.transport = transport;
        this.interceptors = interceptors;
    }
    get(path, options) {
        return this.request({ path, method: "GET", headers: options?.headers ?? new Headers() });
    }
    post(path, body, options) {
        return this.request({ path, method: "POST", headers: options?.headers ?? new Headers(), body });
    }
    put(path, body, options) {
        return this.request({ path, method: "PUT", headers: options?.headers ?? new Headers(), body });
    }
    patch(path, body, options) {
        return this.request({ path, method: "PATCH", headers: options?.headers ?? new Headers(), body });
    }
    delete(path, options) {
        return this.request({ path, method: "DELETE", headers: options?.headers ?? new Headers() });
    }
    async request(initialRequest) {
        let request = initialRequest;
        for (const interceptor of this.interceptors) {
            if (interceptor.onRequest != null) {
                request = await interceptor.onRequest(request);
            }
        }
        const dispatchResponse = async (currentRequest) => {
            let response = await this.transport(currentRequest);
            for (const interceptor of [...this.interceptors].reverse()) {
                if (interceptor.onResponse != null) {
                    response = await interceptor.onResponse(response);
                }
            }
            return response;
        };
        let dispatch = dispatchResponse;
        for (const interceptor of [...this.interceptors].reverse()) {
            if (interceptor.intercept == null) {
                continue;
            }
            const currentDispatch = dispatch;
            dispatch = (currentRequest) => interceptor.intercept(currentRequest, currentDispatch);
        }
        return (await dispatch(request)).data;
    }
}
export function createRuntimeRESTClient(options) {
    const baseUrl = options?.baseUrl ?? "/api";
    return new DefaultRESTClient((request) => new HttpTransport({
        baseUrl,
        ...(options?.headers == null ? {} : { headers: options.headers }),
        ...(options?.fetchImplementation == null ? {} : { fetchImplementation: options.fetchImplementation }),
        ...(options?.acceptVersion == null ? {} : { acceptVersion: options.acceptVersion }),
        ...(options?.credentials == null ? {} : { credentials: options.credentials }),
        ...(options?.mode == null ? {} : { mode: options.mode }),
        ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
        fallbackToMock: options?.fallbackToMock ?? false,
    }).send(request));
}
export function createRESTClient(options) {
    return createRuntimeRESTClient(options);
}
