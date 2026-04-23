/**
 * Dashboard WebSocket Server
 *
 * Provides real-time WebSocket push for dashboard updates.
 * Connects to DashboardProjectionService to push deltas to frontend clients.
 *
 * Architecture: §43 Dashboard - WebSocket real-time push
 * @see docs_zh/architecture/00-platform-architecture.md §43
 */
import type { DashboardDelta } from "./dashboard-projection-service.js";
export interface WebSocketClient {
    readonly clientId: string;
    readonly subscribedDashboards: readonly string[];
    readonly createdAt: string;
    isConnected: boolean;
}
export interface DashboardPushMessage {
    readonly type: "dashboard_delta" | "dashboard_snapshot" | "connection_ack" | "error";
    readonly clientId: string;
    readonly timestamp: string;
    readonly payload: unknown;
}
export interface WebSocketServerConfig {
    readonly heartbeatIntervalMs: number;
    readonly maxClients: number;
    readonly connectionTimeoutMs: number;
}
export declare class DashboardWebSocketServer {
    private readonly config;
    private readonly connections;
    private readonly dashboardSubscribers;
    private heartbeatTimer;
    private deltaHandler;
    constructor(config?: Partial<WebSocketServerConfig>);
    /**
     * Starts the WebSocket server heartbeat.
     */
    start(): void;
    /**
     * Stops the WebSocket server and closes all connections.
     */
    stop(): void;
    /**
     * Registers a new client connection.
     *
     * @param dashboardIds - Dashboards the client wants to subscribe to
     * @returns Client ID and acknowledgment message
     */
    registerClient(dashboardIds: readonly string[]): {
        clientId: string;
        ack: DashboardPushMessage;
    };
    /**
     * Unregisters a client connection.
     *
     * @param clientId - Client ID to remove
     */
    unregisterClient(clientId: string): void;
    /**
     * Updates subscriptions for a client.
     *
     * @param clientId - Client ID
     * @param dashboardIds - New dashboard IDs to subscribe to
     * @returns true if successful
     */
    updateSubscriptions(clientId: string, dashboardIds: readonly string[]): boolean;
    /**
     * Pushes a dashboard delta to all relevant clients.
     *
     * @param delta - Dashboard delta to push
     * @returns Number of clients that received the push
     */
    pushDelta(delta: DashboardDelta): number;
    /**
     * Pushes a dashboard snapshot to a specific client.
     *
     * @param clientId - Target client ID
     * @param snapshot - Dashboard snapshot data
     * @returns true if sent successfully
     */
    pushSnapshotToClient(clientId: string, snapshot: unknown): boolean;
    /**
     * Broadcasts to all connected clients.
     *
     * @param message - Message to broadcast
     * @returns Number of clients reached
     */
    broadcast(message: DashboardPushMessage): number;
    /**
     * Gets list of connected clients.
     */
    getConnectedClients(): WebSocketClient[];
    /**
     * Gets the number of connected clients.
     */
    getClientCount(): number;
    /**
     * Checks if a client is connected.
     */
    isClientConnected(clientId: string): boolean;
    /**
     * Sets the delta handler callback (for integration with projection service).
     */
    setDeltaHandler(handler: (delta: DashboardDelta, clientIds: readonly string[]) => void): void;
    /**
     * Handles a delta from the projection service and pushes to clients.
     */
    handleProjectionDelta(delta: DashboardDelta): number;
    private performHeartbeat;
    private findAffectedClientIds;
    private createMessage;
}
export declare function createDashboardWebSocketServer(config?: Partial<WebSocketServerConfig>): DashboardWebSocketServer;
