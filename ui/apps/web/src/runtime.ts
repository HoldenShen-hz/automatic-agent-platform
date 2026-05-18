import {
  BrowserWSClient,
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
  createTenantInterceptor,
  createTraceInterceptor,
  fetchContractVersion,
  type RESTClient,
  type WSClient,
} from "@aa/shared-api-client";
import { TokenManager } from "@aa/shared-auth";
import { createPersistentOfflineQueue } from "@aa/shared-sync";
import {
  OtlpHttpTelemetryExporter,
  createTelemetrySink,
  startWebVitalsCollection,
  type TelemetrySink,
} from "@aa/shared-telemetry";

export interface WebRuntimeConfig {
  readonly apiBaseUrl?: string;
  readonly wsUrl?: string;
  readonly authToken?: string;
  readonly tenantId?: string;
  readonly tokenManager?: TokenManager;
  readonly telemetryEndpoint?: string;
  readonly telemetryAuthToken?: string;
}

export interface StartupBanner {
  readonly tone: "warning";
  readonly title: string;
  readonly message: string;
}

type FactoryLike<TValue, TArgs extends readonly unknown[]> = {
  new(...args: TArgs): TValue;
  (...args: TArgs): TValue;
};

export function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig {
  const apiBaseUrl = normalizeOptionalEnv(env.VITE_API_BASE_URL);
  const wsUrl = normalizeOptionalEnv(env.VITE_WS_URL);
  const authToken = normalizeOptionalEnv(env.VITE_AUTH_TOKEN);
  const tenantId = normalizeOptionalEnv(env.VITE_TENANT_ID);
  const telemetryEndpoint = normalizeOptionalEnv(env.VITE_OTLP_ENDPOINT);
  const telemetryAuthToken = normalizeOptionalEnv(env.VITE_OTLP_AUTH_TOKEN);

  return {
    ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(authToken == null ? {} : { authToken }),
    ...(tenantId == null ? {} : { tenantId }),
    ...(telemetryEndpoint == null ? {} : { telemetryEndpoint }),
    ...(telemetryAuthToken == null ? {} : { telemetryAuthToken }),
  };
}

function normalizeOptionalEnv(value: string | boolean | undefined): string | undefined {
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
  factory: FactoryLike<TValue, TArgs>,
  ...args: TArgs
): TValue {
  if ("mock" in factory) {
    return factory(...args);
  }
  try {
    return new factory(...args);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("is not a constructor")) {
      return factory(...args);
    }
    throw error;
  }
}

export function startWebRuntimeTelemetry(config: Pick<WebRuntimeConfig, "telemetryEndpoint" | "telemetryAuthToken">): WebRuntimeTelemetry | null {
  if (config.telemetryEndpoint == null || config.telemetryAuthToken == null) {
    return null;
  }

  const sink = createTelemetrySink([
    new OtlpHttpTelemetryExporter(config.telemetryEndpoint, globalThis.fetch.bind(globalThis), {
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
  tokenManager.setSession({
    accessToken: authToken,
    refreshToken: "",
    expiresAt: Date.now() + 3600_000,
  });
}

export function createWebRuntimeClients(
  config: WebRuntimeConfig,
): { client: RESTClient; wsClient: WSClient; offlineQueue: ReturnType<typeof createPersistentOfflineQueue>; tokenManager: TokenManager } {
  const offlineQueue = createPersistentOfflineQueue();
  const tokenManager = config.tokenManager ?? constructOrCall(TokenManager);

  if (config.authToken != null && !hasSession(tokenManager)) {
    seedTokenManager(tokenManager, config.authToken);
  }

  const client = constructOrCall(
    DefaultRESTClient,
    (request) =>
      constructOrCall(HttpTransport, {
        baseUrl: config.apiBaseUrl ?? "/api/v1",
        fallbackToMock: false,
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

  const wsClient = constructOrCall(BrowserWSClient, WebSocket, constructOrCall(InMemoryWSClient));

  return { client, wsClient, offlineQueue, tokenManager };
}

export async function checkWebContractVersion(client: RESTClient): Promise<StartupBanner | null> {
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

export async function registerWebServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || "serviceWorker" in navigator === false) {
    return null;
  }
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}aa-sw.js`);
}
