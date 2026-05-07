import {
  BrowserWSClient,
  DefaultRESTClient,
  HttpTransport,
  createRuntimeWSClient,
  DEFAULT_ACCEPT_VERSIONS,
  fetchContractVersion,
  createAuthInterceptor,
  createContractVersionInterceptor,
  createCsrfInterceptor,
  createIdempotencyKeyInterceptor,
  createOfflineQueueInterceptor,
  createTenantInterceptor,
  createTraceInterceptor,
  type RESTClient,
  type WSClient,
} from "@aa/shared-api-client";
import {
  createTelemetrySink,
  OtlpHttpTelemetryExporter,
  startWebVitalsCollection,
  type TelemetrySink,
} from "@aa/shared-telemetry";
import { createPersistentOfflineQueue, type OfflineQueue } from "@aa/shared-sync";
import { TokenManager } from "@aa/shared-auth";

export interface WebRuntimeConfig {
  readonly apiBaseUrl?: string;
  readonly wsUrl?: string;
  readonly telemetryEndpoint?: string;
  readonly telemetryAuthToken?: string;
  /** Auth token manager for dynamic token resolution per §5.4.4 */
  readonly tokenManager?: TokenManager;
  /** Tenant ID from auth context per §5.1.1 - not hardcoded */
  readonly tenantId?: string;
}

export interface WebRuntimeClients {
  readonly client: RESTClient;
  readonly wsClient: WSClient;
  readonly offlineQueue: OfflineQueue;
  readonly tokenManager: TokenManager;
  readonly wsUrl?: string;
}

export interface WebRuntimeBanner {
  readonly tone: "warning" | "error";
  readonly title: string;
  readonly message: string;
}

export interface WebTelemetryRuntime {
  readonly sink: TelemetrySink;
  stop(): void;
}

export const SUPPORTED_CONTRACT_VERSIONS = [...DEFAULT_ACCEPT_VERSIONS] as const;

/**
 * Creates web runtime configuration from environment variables per §5.1.2.
 * All sensitive values come from auth context, not hardcoded.
 */
export function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig {
  const apiBaseUrl = typeof env.VITE_API_BASE_URL === "string" && env.VITE_API_BASE_URL.trim().length > 0 ? env.VITE_API_BASE_URL.trim() : undefined;
  const wsUrl = typeof env.VITE_WS_URL === "string" && env.VITE_WS_URL.trim().length > 0 ? env.VITE_WS_URL.trim() : undefined;
  const telemetryEndpoint = typeof env.VITE_OTLP_ENDPOINT === "string" && env.VITE_OTLP_ENDPOINT.trim().length > 0
    ? env.VITE_OTLP_ENDPOINT.trim()
    : undefined;
  const telemetryAuthToken = typeof env.VITE_OTLP_AUTH_TOKEN === "string" && env.VITE_OTLP_AUTH_TOKEN.trim().length > 0
    ? env.VITE_OTLP_AUTH_TOKEN.trim()
    : undefined;

  return {
    ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(telemetryEndpoint == null ? {} : { telemetryEndpoint }),
    ...(telemetryAuthToken == null ? {} : { telemetryAuthToken }),
  };
}

/**
 * Creates web runtime clients with proper auth per §5.4.4.
 * - Token comes from TokenManager (supports auto-refresh)
 * - Tenant ID comes from auth context (not hardcoded)
 * - All interceptors properly configured
 */
export function createWebRuntimeClients(config: WebRuntimeConfig): WebRuntimeClients {
  const offlineQueue = createPersistentOfflineQueue();
  const tokenManager = config.tokenManager ?? new TokenManager();

  const client = new DefaultRESTClient((request) => new HttpTransport({
    // §185-2166 FIX: Remove hardcoded localhost fallback for API base URL.
    // Root cause: Hardcoded "http://localhost:3000" is a security risk - production
    // builds could accidentally connect to local dev server. Fallback should be
    // explicit or use environment-specific configuration.
    // Fix: Use undefined as baseUrl when config.apiBaseUrl is not set, allowing
    // HttpTransport to handle missing URL appropriately (fail or use mock).
    baseUrl: config.apiBaseUrl,
    fallbackToMock: true,
  }).send(request), [
    createTraceInterceptor(),
    createContractVersionInterceptor(),
    createCsrfInterceptor(),
    createIdempotencyKeyInterceptor(),
    // §5.4.4: Dynamic token from TokenManager with auto-refresh
    createAuthInterceptor(tokenManager),
    // §5.1.1: Tenant ID from auth context, not hardcoded
    createTenantInterceptor(config.tenantId ?? null),
    createOfflineQueueInterceptor(offlineQueue),
  ]);

  // #2167: create a BrowserWSClient in both cases, but keep the configured URL
  // for the shell/runtime layer instead of smuggling it into the constructor.
  // The previous "fix" passed `new WebSocket(config.wsUrl)` as the factory, which
  // breaks `connect()` because BrowserWSClient expects a WebSocket constructor.
  const wsClient = createRuntimeWSClient(WebSocket);

  return {
    client,
    wsClient,
    offlineQueue,
    tokenManager,
    ...(config.wsUrl == null ? {} : { wsUrl: config.wsUrl }),
  };
}

export async function checkWebContractVersion(client: RESTClient): Promise<WebRuntimeBanner | null> {
  try {
    const contractInfo = await fetchContractVersion(client);
    const negotiatedVersion = contractInfo.contractVersion.trim();
    const hasCompatibleVersion = SUPPORTED_CONTRACT_VERSIONS.some((version) => contractInfo.supportedVersions.includes(version));
    if (SUPPORTED_CONTRACT_VERSIONS.includes(negotiatedVersion as typeof SUPPORTED_CONTRACT_VERSIONS[number]) && hasCompatibleVersion) {
      return null;
    }
    return {
      tone: "warning",
      title: "Contract version mismatch",
      message: `Server contract ${negotiatedVersion} is outside the client-supported set ${SUPPORTED_CONTRACT_VERSIONS.join(", ")}.`,
    };
  } catch {
    return null;
  }
}

/**
 * Starts UI telemetry only when a real OTLP sink is configured.
 * This wires Core Web Vitals/RUM collection into the web bootstrap path.
 */
export function startWebRuntimeTelemetry(config: Pick<WebRuntimeConfig, "telemetryEndpoint" | "telemetryAuthToken">): WebTelemetryRuntime | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (config.telemetryEndpoint == null || config.telemetryAuthToken == null) {
    return null;
  }
  const exporter = new OtlpHttpTelemetryExporter(
    config.telemetryEndpoint,
    globalThis.fetch.bind(globalThis),
    { authorization: config.telemetryAuthToken },
  );
  const sink = createTelemetrySink([exporter]);
  const stopCollection = startWebVitalsCollection(sink);
  return {
    sink,
    stop() {
      stopCollection();
      sink.dispose();
    },
  };
}

/**
 * Service worker registration for L1 static caching per §5.5.1.
 * Only registers if the service worker file exists at the expected path.
 */
export async function registerWebServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || "serviceWorker" in navigator === false) {
    return null;
  }

  const swUrl = `${import.meta.env.BASE_URL}aa-sw.js`;

  try {
    // Check if service worker file exists before attempting registration
    const response = await fetch(swUrl, { method: "HEAD" });
    if (!response.ok) {
      console.warn(`[ServiceWorker] File not found at ${swUrl} - L1 static cache disabled`);
      return null;
    }
    return navigator.serviceWorker.register(swUrl);
  } catch {
    console.warn("[ServiceWorker] Failed to register service worker");
    return null;
  }
}
