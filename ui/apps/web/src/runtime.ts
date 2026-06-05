import {
  createDedupeInterceptor,
  DefaultRESTClient,
  DEFAULT_ACCEPT_VERSIONS,
  HttpTransport,
  InMemoryWSClient,
  createAuthInterceptor,
  createContractVersionInterceptor,
  createCsrfInterceptor,
  createIdempotencyKeyInterceptor,
  createOfflineQueueInterceptor,
  createRetryInterceptor,
  createRuntimeWSClient,
  createTenantInterceptor,
  createTraceInterceptor,
  fetchContractVersion,
  type RESTClient,
  type WSClient,
} from "@aa/shared-api-client";
import { TokenManager } from "@aa/shared-auth";
import { createMemoryOfflineMutationStore, createPersistentOfflineQueue } from "@aa/shared-sync";
import {
  OtlpHttpTelemetryExporter,
  createTelemetrySink,
  startWebVitalsCollection,
  type TelemetrySink,
} from "@aa/shared-telemetry";
import { reportUiError } from "./ui-telemetry";

export interface WebRuntimeConfig {
  readonly apiBaseUrl?: string;
  readonly wsUrl?: string;
  readonly tenantId?: string;
  readonly tokenManager?: TokenManager;
  readonly telemetryEndpoint?: string;
  readonly telemetryAuthToken?: string;
  readonly authToken?: string;
  readonly fallbackToMock?: boolean;
}

export interface StartupBanner {
  readonly tone: "warning";
  readonly title: string;
  readonly message: string;
}

type Constructable<TValue, TArgs extends readonly unknown[]> = new(...args: TArgs) => TValue;
type CallableFactory<TValue, TArgs extends readonly unknown[]> = (...args: TArgs) => TValue;
const STATIC_BOOTSTRAP_SESSION_REFRESH_TOKEN = "bootstrap-session";
const MAX_BOOTSTRAP_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const DEFAULT_RUNTIME_API_BASE_URL = "/api";
const DEFAULT_LOCAL_DEV_API_KEY = "local-dev-platform-operator";

const runtimeFetch: typeof fetch = (...args) => globalThis.fetch(...args);

function isDevRuntime(): boolean {
  return (import.meta as ImportMeta & { readonly env?: { readonly DEV?: boolean } }).env?.DEV === true;
}

export function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig {
  const apiBaseUrl = normalizeOptionalEnv(env.VITE_API_BASE_URL);
  const wsUrl = normalizeOptionalEnv(env.VITE_WS_URL);
  const tenantId = normalizeOptionalEnv(env.VITE_TENANT_ID);
  const telemetryEndpoint = normalizeOptionalEnv(env.VITE_OTLP_ENDPOINT);
  const telemetryAuthToken = normalizeOptionalEnv(env.VITE_OTLP_AUTH_TOKEN);
  const authToken = normalizeOptionalEnv(env.VITE_AUTH_TOKEN);
  const fallbackToMockEnv = normalizeOptionalEnv(env.VITE_API_FALLBACK_TO_MOCK);
  const fallbackToMock = fallbackToMockEnv === "true"
    || (fallbackToMockEnv == null && env.DEV === true && apiBaseUrl == null);

  return {
    ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(tenantId == null ? {} : { tenantId }),
    ...(telemetryEndpoint == null ? {} : { telemetryEndpoint }),
    ...(telemetryAuthToken == null ? {} : { telemetryAuthToken }),
    ...(authToken == null ? {} : { authToken }),
    fallbackToMock,
  };
}

export function readBootstrapAuthToken(doc: Document = document): string | undefined {
  const tokenMeta = doc.querySelector<HTMLMetaElement>('meta[name="aa-auth-token"]');
  const expiryMeta = doc.querySelector<HTMLMetaElement>('meta[name="aa-auth-token-exp"]');
  const metaToken = tokenMeta?.getAttribute("content");
  const metaExpiry = expiryMeta?.getAttribute("content");
  const token = normalizeOptionalEnv(metaToken);
  const expiresAt = metaExpiry == null ? Number.NaN : Date.parse(metaExpiry);
  tokenMeta?.remove();
  expiryMeta?.remove();
  if (token == null || !Number.isFinite(expiresAt)) {
    return undefined;
  }
  if (expiresAt <= Date.now() || expiresAt > Date.now() + MAX_BOOTSTRAP_TOKEN_LIFETIME_MS) {
    return undefined;
  }
  return token;
}

function normalizeOptionalEnv(value: string | boolean | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface WebRuntimeTelemetry {
  readonly sink: TelemetrySink;
  stop(): void;
}

function constructOrCall<TValue, TArgs extends readonly unknown[]>(
  factory: Constructable<TValue, TArgs> | CallableFactory<TValue, TArgs>,
  ...args: TArgs
): TValue {
  if (typeof factory !== "function" || !/^class\s/.test(Function.prototype.toString.call(factory))) {
    return (factory as CallableFactory<TValue, TArgs>)(...args);
  }
  return Reflect.construct(factory, args) as TValue;
}

export function startWebRuntimeTelemetry(config: Pick<WebRuntimeConfig, "telemetryEndpoint" | "telemetryAuthToken">): WebRuntimeTelemetry | null {
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

function hasSession(tokenManager: TokenManager): boolean {
  return typeof tokenManager.getSession === "function" && tokenManager.getSession() != null;
}

function seedTokenManager(tokenManager: TokenManager, authToken: string): void {
  if (typeof tokenManager.setSession !== "function") {
    return;
  }
  const expiresAt = readJwtExpiry(authToken);
  if (expiresAt == null || expiresAt <= Date.now()) {
    return;
  }
  tokenManager.setSession({
    accessToken: authToken,
    refreshToken: STATIC_BOOTSTRAP_SESSION_REFRESH_TOKEN,
    expiresAt,
  });
}

function readJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const decodedPayload = decodeBase64UrlUtf8(parts[1]!);
    const payload = JSON.parse(decodedPayload) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= 0) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function decodeBase64UrlUtf8(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof TextDecoder !== "undefined") {
    const binary = typeof globalThis.atob === "function"
      ? globalThis.atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function createWebRuntimeClients(
  config: WebRuntimeConfig,
): { client: RESTClient; wsClient: WSClient; offlineQueue: ReturnType<typeof createPersistentOfflineQueue>; tokenManager: TokenManager } {
  const offlineQueue = isDevRuntime()
    ? createPersistentOfflineQueue(createMemoryOfflineMutationStore())
    : createPersistentOfflineQueue();
  const tokenManager = config.tokenManager ?? constructOrCall(TokenManager);

  if (config.authToken != null && !hasSession(tokenManager)) {
    seedTokenManager(tokenManager, config.authToken);
  }

  const client = constructOrCall(
    DefaultRESTClient,
    (request) =>
      constructOrCall(HttpTransport, {
        baseUrl: config.apiBaseUrl ?? DEFAULT_RUNTIME_API_BASE_URL,
        fallbackToMock: config.fallbackToMock ?? false,
      }).send(request),
    [
      createTraceInterceptor(),
      createRetryInterceptor(),
      createDedupeInterceptor(),
      createContractVersionInterceptor(),
      createCsrfInterceptor(),
      createIdempotencyKeyInterceptor(),
      createAuthInterceptor(tokenManager),
      createTenantInterceptor(config.tenantId ?? null),
      createOfflineQueueInterceptor(offlineQueue),
    ],
  );

  const wsClient = config.wsUrl == null
    ? constructOrCall(InMemoryWSClient)
    : createRuntimeWSClient(WebSocket);

  return { client, wsClient, offlineQueue, tokenManager };
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export async function bootstrapLocalDevAuthSession(
  config: Pick<WebRuntimeConfig, "apiBaseUrl" | "authToken">,
  tokenManager: TokenManager,
): Promise<string | null> {
  if (hasSession(tokenManager)) {
    return tokenManager.getAccessToken();
  }
  if (config.authToken != null) {
    seedTokenManager(tokenManager, config.authToken);
    return tokenManager.getAccessToken();
  }
  if (!isDevRuntime() || !isLocalDevHost()) {
    return null;
  }

  const localDevAuthRequestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `local-dev-auth-${Date.now()}`;
  const response = await runtimeFetch(`${config.apiBaseUrl ?? DEFAULT_RUNTIME_API_BASE_URL}/v1/auth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": localDevAuthRequestId,
    },
    body: JSON.stringify({
      apiKey: (import.meta as ImportMeta & { readonly env?: Record<string, string | undefined> }).env?.VITE_LOCAL_DEV_API_KEY
        ?? DEFAULT_LOCAL_DEV_API_KEY,
    }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json() as { data?: { accessToken?: string } };
  const accessToken = normalizeOptionalEnv(payload.data?.accessToken);
  if (accessToken == null) {
    return null;
  }
  seedTokenManager(tokenManager, accessToken);
  return accessToken;
}

export async function checkWebContractVersion(client: RESTClient): Promise<StartupBanner | null> {
  const server = await fetchContractVersion(client);
  if ((DEFAULT_ACCEPT_VERSIONS as readonly string[]).includes(server.contractVersion)) {
    return null;
  }

  return {
    tone: "warning",
    title: "Contract version mismatch",
    message: `Server contract ${server.contractVersion} is outside the client-supported set ${DEFAULT_ACCEPT_VERSIONS.join(", ")}.`,
  };
}

export async function registerWebServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || "serviceWorker" in navigator === false) {
    return null;
  }
  if (isDevRuntime()) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    return null;
  }
  try {
    const baseUrl = (import.meta as ImportMeta & { readonly env?: { readonly BASE_URL?: string } }).env?.BASE_URL ?? "/";
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
  } catch (error) {
    reportUiError("ui.service_worker_registration_failed", error);
    throw error;
  }
}
