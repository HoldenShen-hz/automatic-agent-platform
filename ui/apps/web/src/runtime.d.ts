import { type RESTClient, type WSClient } from "@aa/shared-api-client";
import { TokenManager } from "@aa/shared-auth";
import { createPersistentOfflineQueue } from "@aa/shared-sync";
import { type TelemetrySink } from "@aa/shared-telemetry";
export interface WebRuntimeConfig {
    readonly apiBaseUrl?: string;
    readonly wsUrl?: string;
    readonly tenantId?: string;
    readonly tokenManager?: TokenManager;
    readonly telemetryEndpoint?: string;
    readonly telemetryAuthToken?: string;
    readonly authToken?: string;
}
export interface StartupBanner {
    readonly tone: "warning";
    readonly title: string;
    readonly message: string;
}
export declare function createWebRuntimeConfig(env: Record<string, string | boolean | undefined>): WebRuntimeConfig;
export declare function readBootstrapAuthToken(doc?: Document): string | undefined;
export interface WebRuntimeTelemetry {
    readonly sink: TelemetrySink;
    stop(): void;
}
export declare function startWebRuntimeTelemetry(config: Pick<WebRuntimeConfig, "telemetryEndpoint" | "telemetryAuthToken">): WebRuntimeTelemetry | null;
export declare function createWebRuntimeClients(config: WebRuntimeConfig): {
    client: RESTClient;
    wsClient: WSClient;
    offlineQueue: ReturnType<typeof createPersistentOfflineQueue>;
    tokenManager: TokenManager;
};
export declare function checkWebContractVersion(client: RESTClient): Promise<StartupBanner | null>;
export declare function registerWebServiceWorker(): Promise<ServiceWorkerRegistration | null>;
