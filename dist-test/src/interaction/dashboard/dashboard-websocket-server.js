/**
 * Dashboard WebSocket Server
 *
 * Provides real-time WebSocket push for dashboard updates.
 * Connects to DashboardProjectionService to push deltas to frontend clients.
 *
 * Architecture: §43 Dashboard - WebSocket real-time push
 * @see docs_zh/architecture/00-platform-architecture.md §43
 */
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
const DEFAULT_CONFIG = {
    heartbeatIntervalMs: 30000,
    maxClients: 1000,
    connectionTimeoutMs: 60000,
};
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard WebSocket Server
// ─────────────────────────────────────────────────────────────────────────────
export class DashboardWebSocketServer {
    config;
    connections = new Map();
    dashboardSubscribers = new Map();
    heartbeatTimer = null;
    deltaHandler = null;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Starts the WebSocket server heartbeat.
     */
    start() {
        if (this.heartbeatTimer)
            return;
        this.heartbeatTimer = setInterval(() => {
            this.performHeartbeat();
        }, this.config.heartbeatIntervalMs);
    }
    /**
     * Stops the WebSocket server and closes all connections.
     */
    stop() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        for (const connection of this.connections.values()) {
            if (connection.heartbeatTimer) {
                clearInterval(connection.heartbeatTimer);
            }
        }
        this.connections.clear();
        this.dashboardSubscribers.clear();
    }
    /**
     * Registers a new client connection.
     *
     * @param dashboardIds - Dashboards the client wants to subscribe to
     * @returns Client ID and acknowledgment message
     */
    registerClient(dashboardIds) {
        if (this.connections.size >= this.config.maxClients) {
            const errorAck = this.createMessage("error", "", {
                error: "max_clients_reached",
                message: `Maximum ${this.config.maxClients} clients allowed`,
            });
            return { clientId: "", ack: errorAck };
        }
        const clientId = newId("wsclient");
        const connection = {
            clientId,
            subscribedDashboards: new Set(dashboardIds),
            isConnected: true,
            lastActivityAt: nowIso(),
            heartbeatTimer: null,
        };
        this.connections.set(clientId, connection);
        for (const dashboardId of dashboardIds) {
            if (!this.dashboardSubscribers.has(dashboardId)) {
                this.dashboardSubscribers.set(dashboardId, new Set());
            }
            this.dashboardSubscribers.get(dashboardId).add(clientId);
        }
        const ack = this.createMessage("connection_ack", clientId, {
            clientId,
            subscribedDashboards: dashboardIds,
            serverTime: nowIso(),
        });
        return { clientId, ack };
    }
    /**
     * Unregisters a client connection.
     *
     * @param clientId - Client ID to remove
     */
    unregisterClient(clientId) {
        const connection = this.connections.get(clientId);
        if (!connection)
            return;
        // Remove from dashboard subscriptions
        for (const dashboardId of connection.subscribedDashboards) {
            const subscribers = this.dashboardSubscribers.get(dashboardId);
            if (subscribers) {
                subscribers.delete(clientId);
                if (subscribers.size === 0) {
                    this.dashboardSubscribers.delete(dashboardId);
                }
            }
        }
        // Clear heartbeat timer
        if (connection.heartbeatTimer) {
            clearInterval(connection.heartbeatTimer);
        }
        this.connections.delete(clientId);
    }
    /**
     * Updates subscriptions for a client.
     *
     * @param clientId - Client ID
     * @param dashboardIds - New dashboard IDs to subscribe to
     * @returns true if successful
     */
    updateSubscriptions(clientId, dashboardIds) {
        const connection = this.connections.get(clientId);
        if (!connection)
            return false;
        // Remove from old subscriptions
        for (const dashboardId of connection.subscribedDashboards) {
            const subscribers = this.dashboardSubscribers.get(dashboardId);
            if (subscribers) {
                subscribers.delete(clientId);
            }
        }
        // Add to new subscriptions
        connection.subscribedDashboards = new Set(dashboardIds);
        for (const dashboardId of dashboardIds) {
            if (!this.dashboardSubscribers.has(dashboardId)) {
                this.dashboardSubscribers.set(dashboardId, new Set());
            }
            this.dashboardSubscribers.get(dashboardId).add(clientId);
        }
        connection.lastActivityAt = nowIso();
        return true;
    }
    /**
     * Pushes a dashboard delta to all relevant clients.
     *
     * @param delta - Dashboard delta to push
     * @returns Number of clients that received the push
     */
    pushDelta(delta) {
        const affectedClients = new Set();
        // Find all clients subscribed to affected metrics
        for (const metric of delta.affectedMetrics) {
            const clients = this.dashboardSubscribers.get(metric);
            if (clients) {
                for (const clientId of clients) {
                    affectedClients.add(clientId);
                }
            }
        }
        // Also push to clients subscribed to "all" dashboards
        const allClients = this.dashboardSubscribers.get("*");
        if (allClients) {
            for (const clientId of allClients) {
                affectedClients.add(clientId);
            }
        }
        // Create push message
        const message = this.createMessage("dashboard_delta", "", {
            delta,
            affectedMetrics: delta.affectedMetrics,
        });
        // Send to all affected clients (in real impl, this would use WebSocket.send)
        let sentCount = 0;
        for (const clientId of affectedClients) {
            const connection = this.connections.get(clientId);
            if (connection && connection.isConnected) {
                // In real implementation: ws.send(JSON.stringify(message))
                sentCount++;
                connection.lastActivityAt = nowIso();
            }
        }
        return sentCount;
    }
    /**
     * Pushes a dashboard snapshot to a specific client.
     *
     * @param clientId - Target client ID
     * @param snapshot - Dashboard snapshot data
     * @returns true if sent successfully
     */
    pushSnapshotToClient(clientId, snapshot) {
        const connection = this.connections.get(clientId);
        if (!connection || !connection.isConnected)
            return false;
        const message = this.createMessage("dashboard_snapshot", clientId, { snapshot });
        // In real implementation: ws.send(JSON.stringify(message))
        connection.lastActivityAt = nowIso();
        return true;
    }
    /**
     * Broadcasts to all connected clients.
     *
     * @param message - Message to broadcast
     * @returns Number of clients reached
     */
    broadcast(message) {
        let sentCount = 0;
        for (const connection of this.connections.values()) {
            if (connection.isConnected) {
                // In real implementation: ws.send(JSON.stringify(message))
                sentCount++;
            }
        }
        return sentCount;
    }
    /**
     * Gets list of connected clients.
     */
    getConnectedClients() {
        return [...this.connections.values()].map((conn) => ({
            clientId: conn.clientId,
            subscribedDashboards: [...conn.subscribedDashboards],
            createdAt: conn.lastActivityAt,
            isConnected: conn.isConnected,
        }));
    }
    /**
     * Gets the number of connected clients.
     */
    getClientCount() {
        return this.connections.size;
    }
    /**
     * Checks if a client is connected.
     */
    isClientConnected(clientId) {
        const connection = this.connections.get(clientId);
        return connection?.isConnected ?? false;
    }
    /**
     * Sets the delta handler callback (for integration with projection service).
     */
    setDeltaHandler(handler) {
        this.deltaHandler = handler;
    }
    /**
     * Handles a delta from the projection service and pushes to clients.
     */
    handleProjectionDelta(delta) {
        if (this.deltaHandler) {
            const affectedClients = this.findAffectedClientIds(delta);
            this.deltaHandler(delta, affectedClients);
        }
        return this.pushDelta(delta);
    }
    // ─── Private Methods ─────────────────────────────────────────────────────
    performHeartbeat() {
        const now = Date.now();
        for (const [clientId, connection] of this.connections.entries()) {
            const lastActivity = new Date(connection.lastActivityAt).getTime();
            const timeout = this.config.connectionTimeoutMs;
            if (now - lastActivity > timeout) {
                // Connection has timed out
                connection.isConnected = false;
                if (connection.heartbeatTimer) {
                    clearInterval(connection.heartbeatTimer);
                    connection.heartbeatTimer = null;
                }
                // In real impl: ws.terminate()
            }
        }
    }
    findAffectedClientIds(delta) {
        const clientIds = new Set();
        for (const metric of delta.affectedMetrics) {
            const clients = this.dashboardSubscribers.get(metric);
            if (clients) {
                for (const clientId of clients) {
                    clientIds.add(clientId);
                }
            }
        }
        return [...clientIds];
    }
    createMessage(type, clientId, payload) {
        return {
            type,
            clientId,
            timestamp: nowIso(),
            payload,
        };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createDashboardWebSocketServer(config) {
    return new DashboardWebSocketServer(config);
}
//# sourceMappingURL=dashboard-websocket-server.js.map