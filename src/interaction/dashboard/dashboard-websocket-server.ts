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
import type { DashboardDelta, DashboardChange } from "./dashboard-projection-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WebSocketClient {
  readonly clientId: string;
  readonly principal: string;
  readonly tenantId: string;
  readonly subscribedChannels: readonly ChannelSubscription[];
  readonly createdAt: string;
  isConnected: boolean;
}

export type DashboardPushMessageType =
  | "task.status_changed"
  | "task.created"
  | "task.completed"
  | "task.failed"
  | "approval.requested"
  | "approval.resolved"
  | "incident.opened"
  | "incident.resolved"
  | "system.health_changed"
  | "dashboard_snapshot"
  | "connection_ack"
  | "error";

export interface DashboardPushMessage {
  readonly type: DashboardPushMessageType;
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

// UI spec channel-based subscription model: global/task:{id}/approvals/admin
export type DashboardChannel =
  | "global"
  | "task"
  | "approvals"
  | "admin";

export interface ChannelSubscription {
  readonly channel: DashboardChannel;
  readonly filterId?: string; // For "task" channel: taskId; for others: undefined
}

function channelToKey(channel: DashboardChannel, filterId?: string): string {
  if (channel === "task" && filterId) {
    return `task:${filterId}`;
  }
  return channel;
}

interface ConnectionState {
  clientId: string;
  principal: string;
  tenantId: string;
  subscribedChannels: ChannelSubscription[];
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
  private readonly channelSubscribers = new Map<string, Set<string>>();
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
    this.channelSubscribers.clear();
  }

  /**
 * Registers a new client connection.
 *
 * @param channels - Channel-based subscriptions per UI spec (global/task:{id}/approvals/admin)
 * @param principal - Principal ID for authentication (required by §11.1)
 * @param tenantId - Tenant ID for multi-tenant isolation (required by §11.1)
 * @returns Client ID and acknowledgment message
 */
public registerClient(
  channels: readonly ChannelSubscription[],
  principal: string,
  tenantId: string,
): { clientId: string; ack: DashboardPushMessage } {
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
    subscribedChannels: [...channels],
    isConnected: true,
    lastActivityAt: nowIso(),
    heartbeatTimer: null,
  };

  this.connections.set(clientId, connection);

  // Register channel subscriptions
  for (const subscription of channels) {
    const key = channelToKey(subscription.channel, subscription.filterId);
    if (!this.channelSubscribers.has(key)) {
      this.channelSubscribers.set(key, new Set());
    }
    this.channelSubscribers.get(key)!.add(clientId);
  }

  const ack = this.createMessage("connection_ack", clientId, {
    clientId,
    principal,
    tenantId,
    subscribedChannels: channels,
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

    // Remove from channel subscriptions
    for (const subscription of connection.subscribedChannels) {
      const key = channelToKey(subscription.channel, subscription.filterId);
      const subscribers = this.channelSubscribers.get(key);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.channelSubscribers.delete(key);
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
   * Updates channel subscriptions for a client.
   *
   * @param clientId - Client ID
   * @param channels - New channel subscriptions
   * @returns true if successful
   */
  public updateSubscriptions(clientId: string, channels: readonly ChannelSubscription[]): boolean {
    const connection = this.connections.get(clientId);
    if (!connection) return false;

    // Remove from old subscriptions
    for (const subscription of connection.subscribedChannels) {
      const key = channelToKey(subscription.channel, subscription.filterId);
      const subscribers = this.channelSubscribers.get(key);
      if (subscribers) {
        subscribers.delete(clientId);
      }
    }

    // Add to new subscriptions
    connection.subscribedChannels = [...channels];
    for (const subscription of channels) {
      const key = channelToKey(subscription.channel, subscription.filterId);
      if (!this.channelSubscribers.has(key)) {
        this.channelSubscribers.set(key, new Set());
      }
      this.channelSubscribers.get(key)!.add(clientId);
    }

    connection.lastActivityAt = nowIso();
    return true;
  }

  /**
   * Pushes a dashboard delta to all relevant clients.
   * Maps delta change types to domain event types per UI spec.
   * Routes based on channel-based subscription model.
   *
   * @param delta - Dashboard delta to push
   * @returns Number of clients that received the push
   */
  public pushDelta(delta: DashboardDelta): number {
    const affectedClients = new Set<string>();

    // Map change types to channel-based routing per UI spec
    for (const change of delta.changes) {
      let channel: DashboardChannel;
      let filterId: string | undefined;

      switch (change.changeType) {
        case "task_created":
        case "task_updated":
          channel = "task";
          filterId = change.entityId;
          break;
        case "task_completed":
        case "task_failed":
          channel = "task";
          filterId = change.entityId;
          break;
        case "incident_opened":
        case "incident_resolved":
          channel = "admin";
          break;
        case "system_health_changed":
          channel = "global";
          break;
        default:
          channel = "global";
      }

      const key = channelToKey(channel, filterId);
      const clients = this.channelSubscribers.get(key);
      if (clients) {
        for (const clientId of clients) {
          affectedClients.add(clientId);
        }
      }
    }

    // Also push to clients subscribed to global channel
    const globalClients = this.channelSubscribers.get("global");
    if (globalClients) {
      for (const clientId of globalClients) {
        affectedClients.add(clientId);
      }
    }

    // Map change types to domain event types per UI spec
    const domainEventType = this.mapChangeTypeToDomainEvent(delta.changes);

    // Create push message with domain event type
    const message = this.createMessage(domainEventType, "", {
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

  private mapChangeTypeToDomainEvent(changes: readonly DashboardChange[]): DashboardPushMessageType {
    if (changes.length === 0) return "dashboard_snapshot";
    const firstChange = changes[0];
    switch (firstChange.changeType) {
      case "task_created":
        return "task.created";
      case "task_completed":
        return "task.completed";
      case "task_failed":
        return "task.failed";
      case "incident_opened":
        return "incident.opened";
      case "incident_resolved":
        return "incident.resolved";
      case "system_health_changed":
        return "system.health_changed";
      default:
        return "task.status_changed";
    }
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
      subscribedChannels: conn.subscribedChannels,
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
   * Integrates with a DashboardProjectionService to auto-push deltas.
   *
   * @param projectionService - The projection service to integrate with
   * @returns Cleanup function to remove integration
   */
  public integrateWithProjectionService(
    projectionService: { processProjectionUpdate: (record: unknown) => DashboardDelta | null; consumePendingDeltas: () => readonly DashboardDelta[] },
  ): () => void {
    // Start polling for deltas
    const pollInterval = setInterval(() => {
      const deltas = projectionService.consumePendingDeltas();
      for (const delta of deltas) {
        this.handleProjectionDelta(delta);
      }
    }, 100);

    // Return cleanup function
    return () => {
      clearInterval(pollInterval);
    };
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

    // Route to channel subscribers based on change type
    for (const change of delta.changes) {
      let channel: DashboardChannel;
      let filterId: string | undefined;

      switch (change.changeType) {
        case "task_created":
        case "task_updated":
          channel = "task";
          filterId = change.entityId;
          break;
        case "task_completed":
        case "task_failed":
          channel = "task";
          filterId = change.entityId;
          break;
        case "incident_opened":
        case "incident_resolved":
          channel = "admin";
          break;
        case "system_health_changed":
          channel = "global";
          break;
        default:
          // Push to global for other changes
          channel = "global";
      }

      const key = channelToKey(channel, filterId);
      const clients = this.channelSubscribers.get(key);
      if (clients) {
        for (const clientId of clients) {
          clientIds.add(clientId);
        }
      }
    }

    // Also push to "all" global subscribers
    const globalClients = this.channelSubscribers.get("global");
    if (globalClients) {
      for (const clientId of globalClients) {
        clientIds.add(clientId);
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
