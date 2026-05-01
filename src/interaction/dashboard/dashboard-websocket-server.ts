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
  readonly subscribedChannels: readonly ChannelSubscription[];
  readonly subscribedMetrics: readonly string[];
  readonly createdAt: string;
  isConnected: boolean;
}

export type DashboardPushMessageType =
  // Task lifecycle events (R7-16 fix: now matches UI spec domain events)
  | "task.status_changed"
  | "task.created"
  | "task.completed"
  | "task.failed"
  // Approval lifecycle events
  | "approval.requested"
  | "approval.resolved"
  // Incident lifecycle events
  | "incident.opened"
  | "incident.resolved"
  // System health events
  | "system.health_changed"
  // Canonical model events (R7-16 fix: added harness_run/node_run events)
  | "harness_run.started"
  | "harness_run.completed"
  | "harness_run.failed"
  | "node_run.started"
  | "node_run.completed"
  | "node_run.failed"
  // Dashboard events
  | "dashboard_snapshot"
  | "connection_ack"
  | "stream_gap"
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
  readonly replayRetentionMs: number;
  readonly replayBufferLimit: number;
}

const DEFAULT_CONFIG: WebSocketServerConfig = {
  heartbeatIntervalMs: 30000,
  maxClients: 1000,
  connectionTimeoutMs: 60000,
  replayRetentionMs: 24 * 60 * 60 * 1000,
  replayBufferLimit: 5000,
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

export interface DashboardSubscriptionAuthorization {
  readonly allowedChannels: readonly DashboardChannel[];
  readonly allowedTaskIds?: readonly string[];
  readonly allowedTenantIds?: readonly string[];
}

export interface DashboardReplayGap {
  readonly lastEventId: string;
  readonly expectedOldestEventId: string | null;
  readonly latestEventId: string | null;
  readonly reasonCode: "stream.last_event_id_not_replayable" | "stream.tenant_scope_unavailable";
  readonly recoveryAction: "resync_from_snapshot";
}

export interface DashboardReconnectResult {
  readonly clientId: string;
  readonly ack: DashboardPushMessage;
  readonly missedEvents?: readonly DashboardDelta[];
  readonly gapMessage?: DashboardPushMessage;
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
  authorization: DashboardSubscriptionAuthorization;
  subscribedChannels: ChannelSubscription[];
  subscribedMetrics: string[];
  isConnected: boolean;
  lastActivityAt: string;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  lastEventId: string | null;      // §7.1: last_event_id for disconnect recovery + gap detection
  schemaVersion: string;            // §1.8: schema_version negotiation
}

interface ReplayRecord {
  readonly delta: DashboardDelta;
  readonly recordedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard WebSocket Server
// ─────────────────────────────────────────────────────────────────────────────

export class DashboardWebSocketServer {
  private readonly config: WebSocketServerConfig;
  private readonly connections = new Map<string, ConnectionState>();
  private readonly channelSubscribers = new Map<string, Set<string>>();
  private readonly metricSubscribers = new Map<string, Set<string>>(); // §43: metric-based routing
  private readonly replayBuffer: ReplayRecord[] = [];
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
   * Validates authentication credentials for client registration.
   * @param principal - Principal ID
   * @param tenantId - Tenant ID
   * @throws Error if credentials are invalid
   */
  private validateCredentials(principal: string, tenantId: string): void {
    if (!principal || typeof principal !== "string" || principal.trim().length === 0) {
      throw new Error("dashboard.auth: Principal is required for authentication");
    }
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw new Error("dashboard.auth: Tenant ID is required for multi-tenant isolation");
    }
    // Validate format (basic validation - in production this would call IAM service)
    if (principal.length > 256 || tenantId.length > 256) {
      throw new Error("dashboard.auth: Invalid credential format");
    }
  }

  private validateSubscriptions(
    channels: readonly ChannelSubscription[],
    tenantId: string,
    authorization?: DashboardSubscriptionAuthorization,
  ): DashboardSubscriptionAuthorization {
    const effectiveAuthorization = authorization ?? { allowedChannels: ["global"], allowedTenantIds: [tenantId] };
    const allowedChannels = new Set(effectiveAuthorization.allowedChannels);
    const allowedTaskIds = new Set(effectiveAuthorization.allowedTaskIds ?? []);
    const allowedTenantIds = new Set(effectiveAuthorization.allowedTenantIds ?? [tenantId]);

    if (!allowedTenantIds.has(tenantId)) {
      throw new Error("dashboard.authz: Tenant scope is not authorized");
    }

    for (const subscription of channels) {
      if (!allowedChannels.has(subscription.channel)) {
        throw new Error(`dashboard.authz: Channel ${channelToKey(subscription.channel, subscription.filterId)} is not authorized`);
      }
      if (subscription.channel === "task") {
        if (!subscription.filterId || subscription.filterId.trim().length === 0) {
          throw new Error("dashboard.authz: Task channel subscriptions require a task filterId");
        }
        if (effectiveAuthorization.allowedTaskIds !== undefined && !allowedTaskIds.has(subscription.filterId)) {
          throw new Error(`dashboard.authz: Task ${subscription.filterId} is outside the authorized scope`);
        }
      } else if (subscription.filterId !== undefined) {
        throw new Error(`dashboard.authz: Channel ${subscription.channel} does not accept filterId`);
      }
    }

    return effectiveAuthorization;
  }

  /**
   * Registers a new client connection.
   *
   * @param channels - Channel-based subscriptions per UI spec (global/task:{id}/approvals/admin)
   * @param principal - Principal ID for authentication (required by §11.1)
   * @param tenantId - Tenant ID for multi-tenant isolation (required by §11.1)
   * @param lastEventId - §7.1: last_event_id for disconnect recovery + gap detection
   * @param schemaVersion - §1.8: schema_version negotiation (UI arch)
   * @returns Client ID and acknowledgment message
   */
  public registerClient(
    channels: readonly ChannelSubscription[],
    principal: string,
    tenantId: string,
    lastEventId?: string | null,
    schemaVersion?: string,
    authorization?: DashboardSubscriptionAuthorization,
    metricSubscriptions: readonly string[] = [],
  ): DashboardReconnectResult {
    // Authenticate per §11.1
    this.validateCredentials(principal, tenantId);
    const validatedAuthorization = this.validateSubscriptions(channels, tenantId, authorization);

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
      authorization: validatedAuthorization,
      subscribedChannels: [...channels],
      subscribedMetrics: [...new Set(metricSubscriptions.filter((metric) => metric.trim().length > 0))],
      isConnected: true,
      lastActivityAt: nowIso(),
      heartbeatTimer: null,
      lastEventId: lastEventId ?? null,   // §7.1: track last_event_id for gap detection
      schemaVersion: schemaVersion ?? "1.0", // §1.8: schema_version negotiation with default
    };

    // §7.1: Compute missed events if reconnecting with last_event_id
    let missedEvents: readonly DashboardDelta[] | undefined;
    let gapMessage: DashboardPushMessage | undefined;
    if (lastEventId) {
      const replay = this.computeReconnectReplay(connection, lastEventId);
      missedEvents = replay.missedEvents;
      gapMessage = replay.gap === null
        ? undefined
        : this.createMessage("stream_gap", clientId, replay.gap);
      if (missedEvents.length > 0) {
        const lastMissedEvent = missedEvents[missedEvents.length - 1];
        connection.lastEventId = lastMissedEvent?.deltaId ?? null;
      }
    }

    this.connections.set(clientId, connection);

    // Register channel subscriptions
    for (const subscription of channels) {
      const key = channelToKey(subscription.channel, subscription.filterId);
      if (!this.channelSubscribers.has(key)) {
        this.channelSubscribers.set(key, new Set());
      }
      this.channelSubscribers.get(key)!.add(clientId);
    }
    this.registerMetricSubscriptions(clientId, connection.subscribedMetrics);

    const ack = this.createMessage("connection_ack", clientId, {
      clientId,
      principal,
      tenantId,
      subscribedChannels: channels,
      subscribedMetrics: connection.subscribedMetrics,
      serverTime: nowIso(),
      schemaVersion: connection.schemaVersion, // §1.8: echo negotiated schema version
      missedEvents: missedEvents?.length ?? 0,  // §7.1: signal gap recovery to client
      authorizedChannels: validatedAuthorization.allowedChannels,
      recoveryRequired: gapMessage !== undefined,
    });

    const result: DashboardReconnectResult = { clientId, ack };
    if (missedEvents !== undefined) {
      result.missedEvents = missedEvents;
    }
    if (gapMessage !== undefined) {
      result.gapMessage = gapMessage;
    }
    return result;
  }

  /**
   * §7.1: Computes missed events since last_event_id for gap detection + disconnect recovery.
   */
  private computeReconnectReplay(
    connection: ConnectionState,
    lastEventId: string,
  ): { missedEvents: readonly DashboardDelta[]; gap: DashboardReplayGap | null } {
    this.pruneReplayBuffer();
    const replayable = this.replayBuffer
      .map((entry) => entry.delta)
      .filter((delta) => this.canClientReceiveDelta(connection, delta));

    if (replayable.length === 0) {
      return { missedEvents: [], gap: null };
    }

    const replayIndex = replayable.findIndex((delta) => delta.deltaId === lastEventId);
    if (replayIndex >= 0) {
      return { missedEvents: replayable.slice(replayIndex + 1), gap: null };
    }

    return {
      missedEvents: [],
      gap: {
        lastEventId,
        expectedOldestEventId: replayable[0]?.deltaId ?? null,
        latestEventId: replayable[replayable.length - 1]?.deltaId ?? null,
        reasonCode: replayable.some((delta) => delta.visibilityScope === "tenant" && delta.tenantId === null)
          ? "stream.tenant_scope_unavailable"
          : "stream.last_event_id_not_replayable",
        recoveryAction: "resync_from_snapshot",
      },
    };
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
    this.unregisterMetricSubscriptions(clientId, connection.subscribedMetrics);

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
    this.validateSubscriptions(channels, connection.tenantId, connection.authorization);

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

  public updateMetricSubscriptions(clientId: string, metricSubscriptions: readonly string[]): boolean {
    const connection = this.connections.get(clientId);
    if (!connection) return false;

    this.unregisterMetricSubscriptions(clientId, connection.subscribedMetrics);
    connection.subscribedMetrics = [...new Set(metricSubscriptions.filter((metric) => metric.trim().length > 0))];
    this.registerMetricSubscriptions(clientId, connection.subscribedMetrics);
    connection.lastActivityAt = nowIso();
    return true;
  }

  /**
   * Pushes a dashboard delta to all relevant clients.
   * Maps delta change types to domain event types per UI spec.
   *
   * @param delta - Dashboard delta to push
   * @returns Number of clients that received the push
   */
  public pushDelta(delta: DashboardDelta): number {
    this.recordReplayDelta(delta);
    const affectedClients = new Set<string>();

    // Find all clients subscribed to affected metrics via channel routing
    const affectedClientIds = this.findAffectedClientIds(delta);
    for (const clientId of affectedClientIds) {
      affectedClients.add(clientId);
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
        connection.lastEventId = delta.deltaId;
      }
    }

    return sentCount;
  }

  private mapChangeTypeToDomainEvent(changes: readonly DashboardDelta["changes"]): DashboardPushMessageType {
    if (changes.length === 0) return "dashboard_snapshot";
    const firstChange = changes[0];
    if (firstChange === undefined) return "dashboard_snapshot";
    const changeType = firstChange.changeType;
    if (changeType === "task_created") {
      return "task.created";
    } else if (changeType === "task_completed") {
      return "task.completed";
    } else if (changeType === "task_failed") {
      return "task.failed";
    } else if (changeType === "incident_opened") {
      return "incident.opened";
    } else if (changeType === "incident_resolved") {
      return "incident.resolved";
    } else if (changeType === "system_health_changed") {
      return "system.health_changed";
    } else {
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
      subscribedMetrics: conn.subscribedMetrics,
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
   * R7-18 fix: was not integrated - now auto-polls and pushes deltas to subscribed clients.
   *
   * @param projectionService - The projection service to integrate with
   * @returns Cleanup function to remove integration
   */
  public integrateWithProjectionService(
    projectionService: { processProjectionUpdate: (record: unknown) => DashboardDelta | null; consumePendingDeltas: () => readonly DashboardDelta[] },
  ): () => void {
    // Start polling for deltas (100ms interval for near real-time)
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
    const timedOutClientIds: string[] = [];

    for (const [clientId, connection] of this.connections.entries()) {
      const lastActivity = new Date(connection.lastActivityAt).getTime();
      const timeout = this.config.connectionTimeoutMs;

      if (now - lastActivity > timeout) {
        // Connection has timed out - collect for removal
        timedOutClientIds.push(clientId);
      }
    }

    // Remove timed-out connections to prevent unbounded memory growth and stale pushes.
    // Root cause §175-2040: previously we only marked isConnected=false but did not call
    // unregisterClient, causing the connection to remain in connections Map and
    // channelSubscribers Map indefinitely (unbounded memory leak).
    for (const clientId of timedOutClientIds) {
      this.unregisterClient(clientId);
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
          const connection = this.connections.get(clientId);
          if (connection && this.canClientReceiveDelta(connection, delta, channel, filterId)) {
            clientIds.add(clientId);
          }
        }
      }

      // §43: Also route based on affectedMetrics - push to clients subscribed to specific metrics
      for (const metric of delta.affectedMetrics) {
        const metricClients = this.metricSubscribers.get(metric);
        if (metricClients) {
          for (const clientId of metricClients) {
            const connection = this.connections.get(clientId);
            if (connection && this.canClientReceiveDelta(connection, delta, undefined, undefined, true)) {
              clientIds.add(clientId);
            }
          }
        }
      }
    }

    // Also push to "all" global subscribers
    const globalClients = this.channelSubscribers.get("global");
    if (globalClients) {
      for (const clientId of globalClients) {
        const connection = this.connections.get(clientId);
        if (connection && this.canClientReceiveDelta(connection, delta, "global")) {
          clientIds.add(clientId);
        }
      }
    }

    return [...clientIds];
  }

  private canClientReceiveDelta(
    connection: ConnectionState,
    delta: DashboardDelta,
    routedChannel?: DashboardChannel,
    routedFilterId?: string,
    skipChannelSubscriptionCheck = false,
  ): boolean {
    if (delta.visibilityScope === "tenant") {
      if (delta.tenantId === null || delta.tenantId !== connection.tenantId) {
        return false;
      }
    }

    if (skipChannelSubscriptionCheck) {
      return true;
    }

    if (routedChannel === "task") {
      return connection.subscribedChannels.some((subscription) =>
        subscription.channel === "task" && subscription.filterId === routedFilterId);
    }

    if (routedChannel !== undefined) {
      return connection.subscribedChannels.some((subscription) => subscription.channel === routedChannel);
    }

    return connection.subscribedChannels.some((subscription) => {
      if (subscription.channel === "task") {
        return delta.changes.some((change) => change.entityId === subscription.filterId);
      }
      return subscription.channel === "global"
        || (subscription.channel === "admin" && delta.changes.some((change) => change.changeType.startsWith("incident_")))
        || (subscription.channel === "approvals" && delta.changes.some((change) => change.changeType.startsWith("approval_")));
    });
  }

  private recordReplayDelta(delta: DashboardDelta): void {
    this.replayBuffer.push({
      delta,
      recordedAtMs: Date.now(),
    });
    this.pruneReplayBuffer();
  }

  private pruneReplayBuffer(): void {
    const cutoff = Date.now() - this.config.replayRetentionMs;
    while (this.replayBuffer.length > 0 && this.replayBuffer[0]!.recordedAtMs < cutoff) {
      this.replayBuffer.shift();
    }
    while (this.replayBuffer.length > this.config.replayBufferLimit) {
      this.replayBuffer.shift();
    }
  }

  private createMessage(type: DashboardPushMessage["type"], clientId: string, payload: unknown): DashboardPushMessage {
    return {
      type,
      clientId,
      timestamp: nowIso(),
      payload,
    };
  }

  private registerMetricSubscriptions(clientId: string, metricSubscriptions: readonly string[]): void {
    for (const metric of metricSubscriptions) {
      if (!this.metricSubscribers.has(metric)) {
        this.metricSubscribers.set(metric, new Set());
      }
      this.metricSubscribers.get(metric)!.add(clientId);
    }
  }

  private unregisterMetricSubscriptions(clientId: string, metricSubscriptions: readonly string[]): void {
    for (const metric of metricSubscriptions) {
      const subscribers = this.metricSubscribers.get(metric);
      if (!subscribers) {
        continue;
      }
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.metricSubscribers.delete(metric);
      }
    }
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
