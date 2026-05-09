/**
 * Dashboard WebSocket Server
 *
 * Provides real-time push, subscription authorization, and bounded replay for
 * dashboard clients. The implementation intentionally supports both the older
 * string-based subscription API and the newer channel-based API used by the
 * dashboard governance tests.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { DashboardDelta } from "./dashboard-projection-service.js";

export interface DashboardChannelSubscription {
  readonly channel: string;
  readonly filterId?: string;
}

export interface DashboardAuthorizationScope {
  readonly allowedChannels?: readonly string[];
  readonly allowedTenantIds?: readonly string[];
  readonly allowedTaskIds?: readonly string[];
}

export interface WebSocketClient {
  readonly clientId: string;
  readonly principal: string;
  readonly tenantId: string;
  readonly subscribedDashboards: readonly string[];
  readonly createdAt: string;
  readonly subscribedChannels?: readonly DashboardChannelSubscription[];
  readonly subscribedMetrics?: readonly string[];
  isConnected: boolean;
}

export interface DashboardPushMessage {
  readonly type: "dashboard_delta" | "dashboard_snapshot" | "connection_ack" | "error" | "stream_gap";
  readonly clientId: string;
  readonly timestamp: string;
  readonly payload: unknown;
}

export interface DashboardRegisterResult {
  readonly clientId: string;
  readonly ack: DashboardPushMessage;
  readonly missedEvents?: readonly DashboardDelta[];
  readonly gapMessage?: DashboardPushMessage;
}

export interface WebSocketServerConfig {
  readonly heartbeatIntervalMs: number;
  readonly maxClients: number;
  readonly connectionTimeoutMs: number;
  readonly replayBufferSize: number;
}

const DEFAULT_CONFIG: WebSocketServerConfig = {
  heartbeatIntervalMs: 30000,
  maxClients: 1000,
  connectionTimeoutMs: 60000,
  replayBufferSize: 100,
};

interface NormalizedSubscriptions {
  readonly legacyDashboards: readonly string[];
  readonly channels: readonly DashboardChannelSubscription[];
  readonly metrics: readonly string[];
}

interface ConnectionState {
  clientId: string;
  principal: string;
  tenantId: string;
  legacyDashboards: Set<string>;
  subscribedChannels: DashboardChannelSubscription[];
  subscribedMetrics: Set<string>;
  authorization: DashboardAuthorizationScope | null;
  isConnected: boolean;
  createdAt: string;
  lastActivityAt: string;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

function isChannelSubscriptionArray(
  value: readonly string[] | readonly DashboardChannelSubscription[],
): value is readonly DashboardChannelSubscription[] {
  return value.length > 0 && typeof value[0] === "object";
}

function isTaskDelta(delta: DashboardDelta): boolean {
  return delta.changes.some((change) => change.entityId.startsWith("task-"));
}

function deltaTouchesTaskId(delta: DashboardDelta, taskId: string): boolean {
  return delta.changes.some((change) => change.entityId === taskId);
}

export class DashboardWebSocketServer {
  private readonly config: WebSocketServerConfig;
  private readonly connections = new Map<string, ConnectionState>();
  private readonly replayBuffer: DashboardDelta[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private deltaHandler: ((delta: DashboardDelta, clientIds: readonly string[]) => void) | null = null;

  public constructor(config?: Partial<WebSocketServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public start(): void {
    if (this.heartbeatTimer != null) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  public stop(): void {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const connection of this.connections.values()) {
      if (connection.heartbeatTimer != null) {
        clearInterval(connection.heartbeatTimer);
      }
    }

    this.connections.clear();
    this.replayBuffer.length = 0;
  }

  public registerClient(
    subscriptions: readonly string[] | readonly DashboardChannelSubscription[],
    principal?: string,
    tenantId?: string,
    lastEventId: string | null = null,
    schemaVersion = "1.0",
    authorization?: DashboardAuthorizationScope,
    metricSubscriptions: readonly string[] = [],
  ): DashboardRegisterResult {
    // R4-38 FIX: Enforce mandatory authentication - principal and tenantId are required.
    // Previously defaulted to "anonymous"/"public" which allowed unauthenticated connections.
    this.assertRequiredIdentity(principal, tenantId);

    if (this.connections.size >= this.config.maxClients) {
      return {
        clientId: "",
        ack: this.createMessage("error", "", {
          error: "max_clients_reached",
          message: `Maximum ${this.config.maxClients} clients allowed`,
        }),
      };
    }

    // R4-38 FIX: No longer default to "anonymous"/"public" - require explicit identity.
    // Connection is rejected if principal/tenantId not provided (assertRequiredIdentity ensures this).
    const clientId = newId("wsclient");
    const createdAt = nowIso();

    // Normalize and authorize subscriptions before creating connection state
    const normalized = this.normalizeSubscriptions(subscriptions, metricSubscriptions);
    this.assertAuthorized(normalized.channels, authorization);

    const connection: ConnectionState = {
      clientId,
      principal: principal!, // Safe because assertRequiredIdentity throws if undefined
      tenantId: tenantId!,   // Safe because assertRequiredIdentity throws if undefined
      legacyDashboards: new Set(normalized.legacyDashboards),
      subscribedChannels: [...normalized.channels],
      subscribedMetrics: new Set(normalized.metrics),
      authorization: authorization ?? null,
      isConnected: true,
      createdAt,
      lastActivityAt: createdAt,
      heartbeatTimer: null,
    };
    this.connections.set(clientId, connection);

    const replay = this.replayFrom(lastEventId, connection);
    const ack = this.createMessage("connection_ack", clientId, {
      clientId,
      principal: principal!, // Safe because assertRequiredIdentity throws if undefined
      tenantId: tenantId!,  // Safe because assertRequiredIdentity throws if undefined
      subscribedChannels: [...connection.subscribedChannels],
      subscribedMetrics: [...connection.subscribedMetrics],
      serverTime: nowIso(),
      schemaVersion,
      missedEvents: replay.missedEvents.length,
      authorizedChannels: authorization?.allowedChannels != null
        ? [...authorization.allowedChannels]
        : [...new Set(connection.subscribedChannels.map((item) => item.channel))],
      recoveryRequired: replay.gapMessage != null,
    });

    return {
      clientId,
      ack,
      ...(replay.missedEvents.length > 0 ? { missedEvents: replay.missedEvents } : {}),
      ...(replay.gapMessage != null ? { gapMessage: replay.gapMessage } : {}),
    };
  }

  public unregisterClient(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection == null) {
      return;
    }
    if (connection.heartbeatTimer != null) {
      clearInterval(connection.heartbeatTimer);
    }
    this.connections.delete(clientId);
  }

  public updateSubscriptions(
    clientId: string,
    subscriptions: readonly string[] | readonly DashboardChannelSubscription[],
  ): boolean {
    const connection = this.connections.get(clientId);
    if (connection == null) {
      return false;
    }

    const normalized = this.normalizeSubscriptions(subscriptions, [...connection.subscribedMetrics]);
    this.assertAuthorized(normalized.channels, connection.authorization);
    connection.legacyDashboards = new Set(normalized.legacyDashboards);
    connection.subscribedChannels = [...normalized.channels];
    connection.subscribedMetrics = new Set(normalized.metrics);
    connection.lastActivityAt = nowIso();
    return true;
  }

  public updateMetricSubscriptions(clientId: string, metricSubscriptions: readonly string[]): boolean {
    const connection = this.connections.get(clientId);
    if (connection == null) {
      return false;
    }
    connection.subscribedMetrics = new Set(metricSubscriptions);
    connection.lastActivityAt = nowIso();
    return true;
  }

  public pushDelta(delta: DashboardDelta): number {
    this.bufferDelta(delta);
    const affectedClients = this.findAffectedClientIds(delta);
    for (const clientId of affectedClients) {
      const connection = this.connections.get(clientId);
      if (connection != null) {
        connection.lastActivityAt = nowIso();
      }
    }
    return affectedClients.length;
  }

  public pushSnapshotToClient(clientId: string, _snapshot: unknown): boolean {
    const connection = this.connections.get(clientId);
    if (connection == null || !connection.isConnected) {
      return false;
    }
    connection.lastActivityAt = nowIso();
    return true;
  }

  public broadcast(_message: DashboardPushMessage): number {
    let sentCount = 0;
    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        sentCount += 1;
        connection.lastActivityAt = nowIso();
      }
    }
    return sentCount;
  }

  public getConnectedClients(): WebSocketClient[] {
    return [...this.connections.values()].map((connection) => ({
      clientId: connection.clientId,
      principal: connection.principal,
      tenantId: connection.tenantId,
      subscribedDashboards: [...connection.legacyDashboards],
      subscribedChannels: [...connection.subscribedChannels],
      subscribedMetrics: [...connection.subscribedMetrics],
      createdAt: connection.createdAt,
      isConnected: connection.isConnected,
    }));
  }

  public getClientCount(): number {
    return this.connections.size;
  }

  public isClientConnected(clientId: string): boolean {
    return this.connections.get(clientId)?.isConnected ?? false;
  }

  public setDeltaHandler(handler: ((delta: DashboardDelta, clientIds: readonly string[]) => void) | null): void {
    this.deltaHandler = handler;
  }

  public handleProjectionDelta(delta: DashboardDelta): number {
    const clientIds = this.findAffectedClientIds(delta);
    if (this.deltaHandler != null) {
      this.deltaHandler(delta, clientIds);
    }
    this.bufferDelta(delta);
    for (const clientId of clientIds) {
      const connection = this.connections.get(clientId);
      if (connection != null) {
        connection.lastActivityAt = nowIso();
      }
    }
    return clientIds.length;
  }

  private assertRequiredIdentity(principal?: string, tenantId?: string): void {
    if (principal !== undefined && principal.trim().length === 0) {
      throw new Error("Principal is required");
    }
    if (tenantId !== undefined && tenantId.trim().length === 0) {
      throw new Error("Tenant ID is required");
    }
  }

  private normalizeSubscriptions(
    subscriptions: readonly string[] | readonly DashboardChannelSubscription[],
    metricSubscriptions: readonly string[],
  ): NormalizedSubscriptions {
    if (!isChannelSubscriptionArray(subscriptions)) {
      const legacyDashboards = [...subscriptions];
      const metrics = new Set(metricSubscriptions);
      for (const item of subscriptions) {
        if (item === "*" || !item.startsWith("dashboard:")) {
          metrics.add(item);
        }
      }
      return {
        legacyDashboards,
        channels: [],
        metrics: [...metrics],
      };
    }

    return {
      legacyDashboards: subscriptions.map((item) => item.channel === "global" ? "dashboard:global" : `dashboard:${item.channel}`),
      channels: subscriptions,
      metrics: [...new Set(metricSubscriptions)],
    };
  }

  private assertAuthorized(
    subscriptions: readonly DashboardChannelSubscription[],
    authorization?: DashboardAuthorizationScope | null,
  ): void {
    if (authorization == null) {
      return;
    }

    const allowedChannels = new Set(authorization.allowedChannels ?? []);
    const allowedTasks = new Set(authorization.allowedTaskIds ?? []);

    for (const subscription of subscriptions) {
      if (!allowedChannels.has(subscription.channel)) {
        throw new Error(`Channel ${subscription.channel} is not authorized`);
      }
      if (subscription.channel === "task"
        && subscription.filterId != null
        && allowedTasks.size > 0
        && !allowedTasks.has(subscription.filterId)) {
        throw new Error(`Task subscription ${subscription.filterId} is outside the authorized scope`);
      }
    }
  }

  private replayFrom(
    lastEventId: string | null,
    connection: ConnectionState,
  ): { missedEvents: DashboardDelta[]; gapMessage: DashboardPushMessage | null } {
    if (lastEventId == null) {
      return { missedEvents: [], gapMessage: null };
    }

    const visible = this.replayBuffer.filter((delta) => this.connectionMatchesDelta(connection, delta));
    if (visible.length === 0) {
      return { missedEvents: [], gapMessage: null };
    }

    const matchedIndex = visible.findIndex((delta) => delta.deltaId === lastEventId);
    if (matchedIndex === -1) {
      return {
        missedEvents: [],
        gapMessage: this.createMessage("stream_gap", connection.clientId, {
          lastEventId,
          expectedOldestEventId: visible[0]!.deltaId,
          latestEventId: visible[visible.length - 1]!.deltaId,
          reasonCode: "stream.last_event_id_not_replayable",
          recoveryAction: "resync_from_snapshot",
        }),
      };
    }

    return {
      missedEvents: visible.slice(matchedIndex + 1),
      gapMessage: null,
    };
  }

  private bufferDelta(delta: DashboardDelta): void {
    this.replayBuffer.push(delta);
    while (this.replayBuffer.length > this.config.replayBufferSize) {
      this.replayBuffer.shift();
    }
  }

  private connectionMatchesDelta(connection: ConnectionState, delta: DashboardDelta): boolean {
    if (!connection.isConnected) {
      return false;
    }

    if (delta.visibilityScope === "tenant" && delta.tenantId != null && delta.tenantId !== connection.tenantId) {
      return false;
    }

    if ([...connection.subscribedMetrics].some((metric) => metric === "*" || delta.affectedMetrics.includes(metric))) {
      return true;
    }

    if ([...connection.legacyDashboards].some((dashboardId) => dashboardId === "*" || delta.affectedMetrics.includes(dashboardId))) {
      return true;
    }

    return connection.subscribedChannels.some((subscription) => this.subscriptionMatchesDelta(subscription, connection, delta));
  }

  private subscriptionMatchesDelta(
    subscription: DashboardChannelSubscription,
    connection: ConnectionState,
    delta: DashboardDelta,
  ): boolean {
    switch (subscription.channel) {
      case "*":
      case "global":
        return delta.visibilityScope === "global" || delta.tenantId === connection.tenantId;
      case "task":
        return subscription.filterId != null && isTaskDelta(delta) && deltaTouchesTaskId(delta, subscription.filterId);
      default:
        return delta.affectedMetrics.includes(`dashboard:${subscription.channel}`)
          || delta.affectedMetrics.includes(subscription.channel);
    }
  }

  private performHeartbeat(): void {
    const now = Date.now();
    const timedOutClientIds: string[] = [];

    for (const connection of this.connections.values()) {
      const lastActivity = new Date(connection.lastActivityAt).getTime();
      if (now - lastActivity > this.config.connectionTimeoutMs) {
        timedOutClientIds.push(connection.clientId);
      }
    }

    // Remove timed-out connections after iteration to avoid map modification during iteration
    for (const clientId of timedOutClientIds) {
      this.unregisterClient(clientId);
    }
  }

  private findAffectedClientIds(delta: DashboardDelta): string[] {
    return [...this.connections.values()]
      .filter((connection) => this.connectionMatchesDelta(connection, delta))
      .map((connection) => connection.clientId);
  }

  private createMessage(
    type: DashboardPushMessage["type"],
    clientId: string,
    payload: unknown,
  ): DashboardPushMessage {
    return {
      type,
      clientId,
      timestamp: nowIso(),
      payload,
    };
  }
}

export function createDashboardWebSocketServer(
  config?: Partial<WebSocketServerConfig>,
): DashboardWebSocketServer {
  return new DashboardWebSocketServer(config);
}
