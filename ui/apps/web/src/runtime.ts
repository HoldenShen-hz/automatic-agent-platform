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
import { createPersistentOfflineQueue } from "@aa/shared-sync";

export interface WebRuntimeConfig {
  readonly apiBaseUrl?: string;
  readonly wsUrl?: string;
}

export function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig {
  const apiBaseUrl = typeof env.VITE_API_BASE_URL === "string" && env.VITE_API_BASE_URL.length > 0 ? env.VITE_API_BASE_URL : undefined;
  const wsUrl = typeof env.VITE_WS_URL === "string" && env.VITE_WS_URL.length > 0 ? env.VITE_WS_URL : undefined;

  return {
    ...(apiBaseUrl == null ? {} : { apiBaseUrl }),
    ...(wsUrl == null ? {} : { wsUrl }),
  };
}

export function createWebRuntimeClients(config: WebRuntimeConfig): { client: RESTClient; wsClient: WSClient } {
  const offlineQueue = createPersistentOfflineQueue();
  const client = new DefaultRESTClient((request) => new HttpTransport({
    baseUrl: config.apiBaseUrl ?? "http://localhost:3000",
    fallbackToMock: true,
  }).send(request), [
    createTraceInterceptor(),
    createContractVersionInterceptor(),
    createCsrfInterceptor(),
    createAuthInterceptor(null),
    createTenantInterceptor("tenant-default"),
    createOfflineQueueInterceptor(offlineQueue),
  ]);

  const wsClient = config.wsUrl == null
    ? new BrowserWSClient(WebSocket, new InMemoryWSClient())
    : new BrowserWSClient(WebSocket, new InMemoryWSClient());

  return { client, wsClient };
}

export async function registerWebServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || "serviceWorker" in navigator === false) {
    return null;
  }
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}aa-sw.js`);
}
