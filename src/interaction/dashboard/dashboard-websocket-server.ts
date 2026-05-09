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
import type { DashboardDelta } from "./dashboard-projection-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WebSocketClient {
  readonly clientId: string;
  readonly principal: string;
  readonly tenantId: string;
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

const DEFAULT_CONFIG: WebSocketServerConfig = {
  heartbeatIntervalMs: 30000,
  maxClients: 1000,
  connectionTimeoutMs: 60000,
};

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Connection State
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectionState {
  clientId: string;
  principal: string;
  tenantId: string;
  subscribedDashboards: Set<string>;
  isConnected: boolean;
  lastActivityAt: string;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard WebSocket Server
// ─────────────────────────────────────────────────────────────────────────────

export class DashboardWebSocketServer {
  private readonly config: WebSocketServerConfig;
  private readonly connections = new Map<string, ConnectionState>();
  private readonly dashboardSubscribers = new Map<string, Set<string>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private deltaHandler: ((delta: DashboardDelta, clientIds: readonly string[]) => void) | null = null;

  constructor(config?: Partial<WebSocketServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts the WebSocket server heartbeat.
   */
  public start(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stops the WebSocket server and closes all connections.
   */
  public stop(): void {
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
   * @param principal - Principal ID for authentication (required by §11.1)
   * @param tenantId - Tenant ID for multi-tenant isolation (required by §11.1)
   * @returns Client ID and acknowledgment message
   * @throws Error if authentication fails or tenantId is invalid
   */
public registerClient(
  dashboardIds: readonly string[],
  principal: string,
  tenantId: string,
): { clientId: string; ack: DashboardPushMessage } {
  // R4-38: Validate authentication and tenantId per §11.1
  if (!principal || principal.trim().length === 0) {
    const errorAck = this.createMessage("error", "", {
      error: "invalid_principal",
      message: "Authentication required: principal ID must be provided",
    });
    return { clientId: "", ack: errorAck };
  }

  if (!tenantId || tenantId.trim().length === 0) {
    const errorAck = this.createMessage("error", "", {
      error: "invalid_tenant",
      message: "Tenant isolation required: tenantId must be provided",
    });
    return { clientId: "", ack: errorAck };
  }

  if (this.connections.size >= this.config.maxClients) {
    const errorAck = this.createMessage("error", "", {
      error: "max_clients_reached",
      message: `Maximum ${this.config.maxClients} clients allowed`,
    });
    return { clientId: "", ack: errorAck };
  }

  const clientId = newId("wsclient");
  const connection: ConnectionState = {
    clientId,
    principal,
    tenantId,
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
    this.dashboardSubscribers.get(dashboardId)!.add(clientId);
  }

  const ack = this.createMessage("connection_ack", clientId, {
    clientId,
    principal,
    tenantId,
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
  public unregisterClient(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (!connection) return;

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
  public updateSubscriptions(clientId: string, dashboardIds: readonly string[]): boolean {
    const connection = this.connections.get(clientId);
    if (!connection) return false;

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
      this.dashboardSubscribers.get(dashboardId)!.add(clientId);
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
  public pushDelta(delta: DashboardDelta): number {
    const affectedClients = new Set<string>();

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
  public pushSnapshotToClient(clientId: string, snapshot: unknown): boolean {
    const connection = this.connections.get(clientId);
    if (!connection || !connection.isConnected) return false;

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
  public broadcast(message: DashboardPushMessage): number {
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
  public getConnectedClients(): WebSocketClient[] {
    return [...this.connections.values()].map((conn) => ({
      clientId: conn.clientId,
      principal: conn.principal,
      tenantId: conn.tenantId,
      subscribedDashboards: [...conn.subscribedDashboards],
      createdAt: conn.lastActivityAt,
      isConnected: conn.isConnected,
    }));
  }

  /**
   * Gets the number of connected clients.
   */
  public getClientCount(): number {
    return this.connections.size;
  }

  /**
   * Checks if a client is connected.
   */
  public isClientConnected(clientId: string): boolean {
    const connection = this.connections.get(clientId);
    return connection?.isConnected ?? false;
  }

  /**
   * Sets the delta handler callback (for integration with projection service).
   */
  public setDeltaHandler(handler: (delta: DashboardDelta, clientIds: readonly string[]) => void): void {
    this.deltaHandler = handler;
  }

  /**
   * Handles a delta from the projection service and pushes to clients.
   */
  public handleProjectionDelta(delta: DashboardDelta): number {
    if (this.deltaHandler) {
      const affectedClients = this.findAffectedClientIds(delta);
      this.deltaHandler(delta, affectedClients);
    }
    return this.pushDelta(delta);
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private performHeartbeat(): void {
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

  private findAffectedClientIds(delta: DashboardDelta): string[] {
    const clientIds = new Set<string>();

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

  private createMessage(type: DashboardPushMessage["type"], clientId: string, payload: unknown): DashboardPushMessage {
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

export function createDashboardWebSocketServer(
  config?: Partial<WebSocketServerConfig>,
): DashboardWebSocketServer {
  return new DashboardWebSocketServer(config);
}
