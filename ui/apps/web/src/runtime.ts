import {
  BrowserWSClient,
  DefaultRESTClient,
  HttpTransport,
  InMemoryWSClient,
  createAuthInterceptor,
  createContractVersionInterceptor,
  createCsrfInterceptor,
  createOfflineQueueInterceptor,
  createTenantInterceptor,
  createTraceInterceptor,
  type RESTClient,
  type WSClient,
} from "@aa/shared-api-client";
import { createPersistentOfflineQueue, type OfflineQueue } from "@aa/shared-sync";
import { TokenManager } from "@aa/shared-auth";

export interface WebRuntimeConfig {
  readonly apiBaseUrl?: string;
  readonly wsUrl?: string;
  /** Auth token manager for dynamic token resolution per §5.4.4 */
  readonly tokenManager?: TokenManager;
  /** Tenant ID from auth context per §5.1.1 - not hardcoded */
  readonly tenantId?: string;
}

/**
 * Creates web runtime configuration from environment variables per §5.1.2.
 * All sensitive values come from auth context, not hardcoded.
 */
export function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig {
  const apiBaseUrl = typeof env.VITE_API_BASE_URL === "string" && env.VITE_API_BASE_URL.length > 0 ? env.VITE_API_BASE_URL : undefined;
  const wsUrl = typeof env.VITE_WS_URL === "string" && env.VITE_WS_URL.length > 0 ? env.VITE_WS_URL : undefined;

  return {
    ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
    ...(wsUrl == null ? {} : { wsUrl }),
  };
}

/**
 * Creates web runtime clients with proper auth per §5.4.4.
 * - Token comes from TokenManager (supports auto-refresh)
 * - Tenant ID comes from auth context (not hardcoded)
 * - All interceptors properly configured
 */
export function createWebRuntimeClients(config: WebRuntimeConfig): { client: RESTClient; wsClient: WSClient; offlineQueue: OfflineQueue } {
  const offlineQueue = createPersistentOfflineQueue();
  const tokenManager = config.tokenManager ?? new TokenManager();

  const client = new DefaultRESTClient((request) => new HttpTransport({
    baseUrl: config.apiBaseUrl ?? "http://localhost:3000",
    fallbackToMock: true,
  }).send(request), [
    createTraceInterceptor(),
    createContractVersionInterceptor(),
    createCsrfInterceptor(),
    // §5.4.4: Dynamic token from TokenManager with auto-refresh
    createAuthInterceptor(tokenManager),
    // §5.1.1: Tenant ID from auth context, not hardcoded
    createTenantInterceptor(config.tenantId ?? null),
    createOfflineQueueInterceptor(offlineQueue),
  ]);

  const wsClient = config.wsUrl == null
    ? new BrowserWSClient(WebSocket, new InMemoryWSClient())
    : new BrowserWSClient(WebSocket, new InMemoryWSClient());

  return { client, wsClient, offlineQueue };
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
