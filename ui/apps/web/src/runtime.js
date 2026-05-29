import { BrowserWSClient, createDedupeInterceptor, DefaultRESTClient, DEFAULT_ACCEPT_VERSIONS, HttpTransport, InMemoryWSClient, createAuthInterceptor, createContractVersionInterceptor, createCsrfInterceptor, createIdempotencyKeyInterceptor, createOfflineQueueInterceptor, createRetryInterceptor, createTenantInterceptor, createTraceInterceptor, fetchContractVersion, } from "@aa/shared-api-client";
import { TokenManager } from "@aa/shared-auth";
import { createPersistentOfflineQueue } from "@aa/shared-sync";
import { OtlpHttpTelemetryExporter, createTelemetrySink, startWebVitalsCollection, } from "@aa/shared-telemetry";
import { reportUiError } from "./ui-telemetry";
const STATIC_BOOTSTRAP_SESSION_REFRESH_TOKEN = "bootstrap-session";
const NON_EXPIRING_BOOTSTRAP_SESSION_EXPIRY = Number.MAX_SAFE_INTEGER;
const runtimeFetch = (...args) => globalThis.fetch(...args);
export function createWebRuntimeConfig(env) {
    const apiBaseUrl = normalizeOptionalEnv(env.VITE_API_BASE_URL);
    const wsUrl = normalizeOptionalEnv(env.VITE_WS_URL);
    const tenantId = normalizeOptionalEnv(env.VITE_TENANT_ID);
    const telemetryEndpoint = normalizeOptionalEnv(env.VITE_OTLP_ENDPOINT);
    const telemetryAuthToken = normalizeOptionalEnv(env.VITE_OTLP_AUTH_TOKEN);
    return {
        ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
        ...(wsUrl == null ? {} : { wsUrl }),
        ...(tenantId == null ? {} : { tenantId }),
        ...(telemetryEndpoint == null ? {} : { telemetryEndpoint }),
        ...(telemetryAuthToken == null ? {} : { telemetryAuthToken }),
    };
}
export function readBootstrapAuthToken(doc = document) {
    const metaToken = doc.querySelector('meta[name="aa-auth-token"]')?.getAttribute("content");
    return normalizeOptionalEnv(metaToken);
}
function normalizeOptionalEnv(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function constructOrCall(factory, ...args) {
    if (typeof factory !== "function" || !/^class\s/.test(Function.prototype.toString.call(factory))) {
        return factory(...args);
    }
    return Reflect.construct(factory, args);
}
export function startWebRuntimeTelemetry(config) {
    if (config.telemetryEndpoint == null || config.telemetryAuthToken == null) {
        return null;
    }
    const sink = createTelemetrySink([
        new OtlpHttpTelemetryExporter(config.telemetryEndpoint, runtimeFetch, {
            authorization: config.telemetryAuthToken,
        }),
    ]);
    const stopVitals = startWebVitalsCollection(sink);
    return {
        sink,
        stop() {
            stopVitals();
            sink.dispose();
        },
    };
}
function hasSession(tokenManager) {
    return typeof tokenManager.getSession === "function" && tokenManager.getSession() != null;
}
function seedTokenManager(tokenManager, authToken) {
    if (typeof tokenManager.setSession !== "function") {
        return;
    }
    const expiresAt = readJwtExpiry(authToken) ?? NON_EXPIRING_BOOTSTRAP_SESSION_EXPIRY;
    tokenManager.setSession({
        accessToken: authToken,
        refreshToken: STATIC_BOOTSTRAP_SESSION_REFRESH_TOKEN,
        expiresAt,
    });
}
function readJwtExpiry(token) {
    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }
    try {
        const encodedPayload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const decodedPayload = typeof globalThis.atob === "function"
            ? globalThis.atob(encodedPayload)
            : Buffer.from(encodedPayload, "base64").toString("utf8");
        const payload = JSON.parse(decodedPayload);
        if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= 0) {
            return null;
        }
        return payload.exp * 1000;
    }
    catch {
        return null;
    }
}
export function createWebRuntimeClients(config) {
    const offlineQueue = createPersistentOfflineQueue();
    const tokenManager = config.tokenManager ?? constructOrCall(TokenManager);
    if (config.authToken != null && !hasSession(tokenManager)) {
        seedTokenManager(tokenManager, config.authToken);
    }
    const client = constructOrCall(DefaultRESTClient, (request) => constructOrCall(HttpTransport, {
        baseUrl: config.apiBaseUrl ?? "/api",
        fallbackToMock: false,
    }).send(request), [
        createTraceInterceptor(),
        createRetryInterceptor(),
        createDedupeInterceptor(),
        createContractVersionInterceptor(),
        createCsrfInterceptor(),
        createIdempotencyKeyInterceptor(),
        createAuthInterceptor(tokenManager),
        createTenantInterceptor(config.tenantId ?? null),
        createOfflineQueueInterceptor(offlineQueue),
    ]);
    const wsClient = config.wsUrl == null || typeof WebSocket === "undefined"
        ? constructOrCall(InMemoryWSClient)
        : constructOrCall(BrowserWSClient, WebSocket, constructOrCall(InMemoryWSClient));
    return { client, wsClient, offlineQueue, tokenManager };
}
export async function checkWebContractVersion(client) {
    const server = await fetchContractVersion(client);
    if (DEFAULT_ACCEPT_VERSIONS.includes(server.contractVersion)) {
        return null;
    }
    return {
        tone: "warning",
        title: "Contract version mismatch",
        message: `Server contract ${server.contractVersion} is outside the client-supported set ${DEFAULT_ACCEPT_VERSIONS.join(", ")}.`,
    };
}
export async function registerWebServiceWorker() {
    if (typeof window === "undefined" || "serviceWorker" in navigator === false) {
        return null;
    }
    try {
        const baseUrl = import.meta.env?.BASE_URL ?? "/";
        const registration = await navigator.serviceWorker.register(`${baseUrl}aa-sw.js`);
        const notifyUpdateAvailable = () => {
            window.dispatchEvent(new CustomEvent("aa-sw-update-available", {
                detail: { registration },
            }));
        };
        if (registration.waiting != null) {
            notifyUpdateAvailable();
        }
        registration.addEventListener?.("updatefound", () => {
            const installing = registration.installing;
            installing?.addEventListener?.("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller != null) {
                    notifyUpdateAvailable();
                }
            });
        });
        return registration;
    }
    catch (error) {
        reportUiError("ui.service_worker_registration_failed", error);
        throw error;
    }
}
