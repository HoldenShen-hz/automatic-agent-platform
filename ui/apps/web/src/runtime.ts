import {
  DefaultRESTClient,
  HttpTransport,
  type RESTClient,
} from "../../../packages/shared/api-client/src/rest-client.js";
import {
  createAuthInterceptor,
  createCsrfInterceptor,
  createIdempotencyKeyInterceptor,
  createOfflineQueueInterceptor,
  createTenantInterceptor,
  createTraceInterceptor,
} from "../../../packages/shared/api-client/src/interceptors.js";
import {
  BrowserWSClient,
  InMemoryWSClient,
  type WSClient,
} from "../../../packages/shared/api-client/src/ws-client.js";
import { createPersistentOfflineQueue } from "../../../packages/shared/sync/src/offline-queue.js";
import { TokenManager } from "../../../packages/shared/auth/src/token-manager.js";

export interface WebRuntimeConfig {
  readonly apiBaseUrl?: string;
  readonly wsUrl?: string;
  readonly authToken?: string;
  readonly tenantId?: string;
  readonly tokenManager?: TokenManager;
}

export function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig {
  const apiBaseUrl = typeof env.VITE_API_BASE_URL === "string" && env.VITE_API_BASE_URL.length > 0 ? env.VITE_API_BASE_URL : undefined;
  const wsUrl = typeof env.VITE_WS_URL === "string" && env.VITE_WS_URL.length > 0 ? env.VITE_WS_URL : undefined;
  const authToken = typeof env.VITE_AUTH_TOKEN === "string" && env.VITE_AUTH_TOKEN.length > 0 ? env.VITE_AUTH_TOKEN : undefined;
  const tenantId = typeof env.VITE_TENANT_ID === "string" && env.VITE_TENANT_ID.length > 0 ? env.VITE_TENANT_ID : undefined;

  return {
    ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
    ...(wsUrl == null ? {} : { wsUrl }),
    ...(authToken == null ? {} : { authToken }),
    ...(tenantId == null ? {} : { tenantId }),
  };
}

export function createWebRuntimeClients(
  config: WebRuntimeConfig,
): { client: RESTClient; wsClient: WSClient; offlineQueue: ReturnType<typeof createPersistentOfflineQueue>; tokenManager: TokenManager } {
  const offlineQueue = createPersistentOfflineQueue();
  const tokenManager = config.tokenManager ?? new TokenManager();

  if (config.authToken != null && tokenManager.getSession() == null) {
    tokenManager.setSession({
      accessToken: config.authToken,
      refreshToken: "",
      expiresAt: Date.now() + 3600_000,
    });
  }

  const client = new DefaultRESTClient((request) => new HttpTransport({
    baseUrl: config.apiBaseUrl ?? "http://localhost:3000",
    fallbackToMock: true,
  }).send(request), [
    createTraceInterceptor(),
    createCsrfInterceptor(),
    createIdempotencyKeyInterceptor(),
    createAuthInterceptor(tokenManager),
    createTenantInterceptor(config.tenantId ?? null),
    createOfflineQueueInterceptor(offlineQueue),
  ]);

  const wsClient = config.wsUrl == null
    ? new BrowserWSClient(WebSocket, new InMemoryWSClient())
    : new BrowserWSClient(WebSocket, new InMemoryWSClient());

  return { client, wsClient, offlineQueue, tokenManager };
}

export async function registerWebServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || "serviceWorker" in navigator === false) {
    return null;
  }
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}aa-sw.js`);
}
