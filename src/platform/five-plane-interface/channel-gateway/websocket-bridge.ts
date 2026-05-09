/**
 * @fileoverview WebSocket Bridge - Real-time task status updates over WebSocket
 *
 * Uses WebSocket subprotocol auth instead of query-string JWTs and attaches
 * sequence numbers plus client acknowledgements for at-least-once delivery.
 */

import type { IncomingMessage, Server } from "node:http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { z } from "zod";

import type { ApiAuthService } from "../api/api-auth-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { TenantScopeFilter, type TaskProjectionScopeResolver } from "./tenant-scope-filter.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
const WS_PATH = "/ws/v1/stream";
const SLOW_CONSUMER_BUFFER_BYTES = 1_000_000;
const CLOSE_TIMEOUT_MS = 100;
const MAX_SUBSCRIPTIONS_PER_CLIENT = 100;
const MAX_TASK_EVENT_HISTORY = 200;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;
// R12-07: Configurable back-pressure threshold
const DEFAULT_BACK_PRESSURE_THRESHOLD_BYTES = 500_000;

/**
 * Zod schema for validating WebSocket messages at the inter-plane boundary.
 * This provides runtime validation to ensure message structure matches the declared types.
 */
const WebSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("ack"), sequenceNum: z.number(), delivered: z.boolean() }),
  z.object({ type: z.literal("subscribe"), taskId: z.string(), lastEventId: z.union([z.string(), z.null()]).optional() }),
  z.object({ type: z.literal("unsubscribe"), taskId: z.string() }),
  z.object({ type: z.literal("subscribed"), taskId: z.string() }),
  z.object({ type: z.literal("unsubscribed"), taskId: z.string() }),
  z.object({ type: z.literal("stream_gap"), taskId: z.string(), fromEventId: z.union([z.string(), z.null()]), toEventId: z.union([z.string(), z.null()]), reason: z.enum(["missed_events", "history_unavailable"]) }),
  z.object({ type: z.literal("backpressure_warning"), taskId: z.string(), bufferedCount: z.number(), bufferedBytes: z.number().optional(), reason: z.literal("slow_consumer") }),
  z.object({ type: z.literal("task_update"), taskId: z.string(), eventId: z.string(), sequenceNum: z.number(), event: z.unknown() }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

export type WebSocketMessageType =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "ack"; sequenceNum: number; delivered: boolean }
  | { type: "subscribe"; taskId: string; lastEventId?: string | null }
  | { type: "unsubscribe"; taskId: string }
  | { type: "subscribed"; taskId: string }
  | { type: "unsubscribed"; taskId: string }
  | { type: "stream_gap"; taskId: string; fromEventId: string | null; toEventId: string | null; reason: "missed_events" | "history_unavailable" }
  | { type: "backpressure_warning"; taskId: string; bufferedCount: number; bufferedBytes?: number; reason: "slow_consumer" }
  | { type: "task_update"; taskId: string; eventId: string; sequenceNum: number; event: TaskWebSocketEvent }
  | { type: "error"; code: string; message: string };

export type TaskWebSocketEvent =
  | { eventType: "status_changed"; taskId: string; status: string; timestamp: string }
  | { eventType: "progress"; taskId: string; progress: number; timestamp: string }
  | { eventType: "message_delta"; taskId: string; delta: Record<string, unknown>; timestamp: string }
  | { eventType: "artifact_ready"; taskId: string; artifactId: string; timestamp: string }
  | { eventType: "approval_requested"; taskId: string; approvalId: string; timestamp: string }
  | { eventType: "completed"; taskId: string; result: Record<string, unknown>; timestamp: string }
  | { eventType: "failed"; taskId: string; error: string; timestamp: string };

interface ClientConnection {
  webSocket: WebSocket;
  principal: { actorId: string; tenantId: string | null; scopes: readonly string[] };
  subscribedTasks: Set<string>;
  lastEventId: string | null;
  nextExpectedSequenceNum: number;
  lastAcknowledgedSequenceNum: number;
  pendingAcks: Map<number, { eventId: string; taskId: string; sentAt: string }>;
  bufferedEventCount: number;
  isAlive: boolean;
}

type SubscriptionResult = "subscribed" | "scope_denied" | "subscription_limit_exceeded";

export interface WebSocketBridgeOptions {
  heartbeatIntervalMs?: number;
  maxPayloadBytes?: number;
}

export class WebSocketBridge {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientConnection>();
  private readonly taskSubscribers = new Map<string, Set<WebSocket>>();
  private readonly taskEventHistory = new Map<string, Array<{ eventId: string; event: TaskWebSocketEvent }>>();
  private readonly slowConsumers = new Set<WebSocket>();
  private readonly tenantScopeFilter: TenantScopeFilter | null;
  private readonly heartbeatTimer: NodeJS.Timeout;

  public constructor(
    server: Server,
    private readonly authService: ApiAuthService,
    taskScopeResolver: TaskProjectionScopeResolver | null = null,
    options: WebSocketBridgeOptions = {},
  ) {
    this.tenantScopeFilter = taskScopeResolver == null ? null : new TenantScopeFilter(taskScopeResolver);
    this.wss = new WebSocketServer({
      server,
      path: WS_PATH,
      maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    this.heartbeatTimer = setInterval(
      () => this.runHeartbeatSweep(),
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
    );
    this.heartbeatTimer.unref?.();
    logger.info("WebSocket bridge initialized", { path: WS_PATH });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const token = this.extractBearerToken(req.headers["sec-websocket-protocol"]);
    const initialTaskId = url.searchParams.get("taskId");
    const initialLastEventId = url.searchParams.get("last_event_id");

    if (!token) {
      ws.close(4001, "Missing token");
      logger.warn("WebSocket connection rejected: missing subprotocol token");
      return;
    }

    let principal: { actorId: string; tenantId: string | null; scopes: readonly string[] };
    try {
      const apiPrincipal = this.authService.authenticate({ authorization: `Bearer ${token}` });
      principal = { actorId: apiPrincipal.actorId, tenantId: apiPrincipal.tenantId, scopes: apiPrincipal.roles };
    } catch {
      ws.close(4003, "Invalid token");
      logger.warn("WebSocket connection rejected: invalid subprotocol token");
      return;
    }

    const client: ClientConnection = {
      webSocket: ws,
      principal,
      subscribedTasks: new Set(),
      lastEventId: null,
      nextExpectedSequenceNum: 0,
      lastAcknowledgedSequenceNum: -1,
      pendingAcks: new Map(),
      bufferedEventCount: 0,
      isAlive: true,
    };
    this.clients.set(ws, client);

    if (initialTaskId) {
      this.subscribeToTask(ws, initialTaskId, initialLastEventId);
    }

    ws.on("message", (data) => {
      const liveClient = this.clients.get(ws);
      if (liveClient != null) {
        liveClient.isAlive = true;
      }
      try {
        const parsed = JSON.parse(data.toString());
        const result = WebSocketMessageSchema.safeParse(parsed) as { success: true; data: WebSocketMessageType } | { success: false; data: unknown };
        if (!result.success) {
          ws.send(JSON.stringify({ type: "error", code: "invalid_message", message: "Message schema validation failed" }));
          return;
        }
        this.handleMessage(ws, result.data);
      } catch {
        ws.send(JSON.stringify({ type: "error", code: "invalid_message", message: "Failed to parse message" }));
      }
    });
    ws.on("close", () => {
      this.handleDisconnection(ws);
    });
    ws.on("pong", () => {
      const liveClient = this.clients.get(ws);
      if (liveClient != null) {
        liveClient.isAlive = true;
      }
    });
    ws.on("error", (error) => {
      logger.error("WebSocket client error", {
        actorId: principal.actorId,
        error: error.message,
      });
    });
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessageType): void {
    const client = this.clients.get(ws);
    switch (message.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      case "pong":
        if (client != null) {
          client.isAlive = true;
        }
        return;
      case "ack":
        if (client != null && message.delivered) {
          client.lastAcknowledgedSequenceNum = Math.max(client.lastAcknowledgedSequenceNum, message.sequenceNum);
          client.pendingAcks.delete(message.sequenceNum);
        }
        return;
      case "subscribe":
        if (typeof message.taskId === "string" && message.taskId.length > 0) {
          const result = this.subscribeToTask(ws, message.taskId, message.lastEventId ?? null);
          ws.send(JSON.stringify(result === "subscribed"
            ? { type: "subscribed", taskId: message.taskId }
            : {
                type: "error",
                code: result === "scope_denied" ? "scope_denied" : "subscription_limit_exceeded",
                message: result === "scope_denied"
                  ? "Task scope denied"
                  : `Subscription limit of ${MAX_SUBSCRIPTIONS_PER_CLIENT} tasks exceeded`,
              }));
        }
        return;
      case "unsubscribe":
        if (typeof message.taskId === "string" && message.taskId.length > 0) {
          this.unsubscribeFromTask(ws, message.taskId);
          ws.send(JSON.stringify({ type: "unsubscribed", taskId: message.taskId }));
        }
        return;
      default:
        ws.send(JSON.stringify({ type: "error", code: "unknown_message", message: "Unknown message type" }));
    }
  }

  private subscribeToTask(
    ws: WebSocket,
    taskId: string,
    lastEventId: string | null = null,
  ): SubscriptionResult {
    const client = this.clients.get(ws);
    if (!client) {
      return "scope_denied";
    }
    const scopeDecision = this.tenantScopeFilter?.evaluate(client.principal, taskId);
    if (scopeDecision != null && !scopeDecision.allowed) {
      return "scope_denied";
    }
    if (!client.subscribedTasks.has(taskId) && client.subscribedTasks.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
      return "subscription_limit_exceeded";
    }
    client.subscribedTasks.add(taskId);
    if (!this.taskSubscribers.has(taskId)) {
      this.taskSubscribers.set(taskId, new Set());
    }
    this.taskSubscribers.get(taskId)!.add(ws);
    this.replayMissedEvents(ws, client, taskId, lastEventId);
    return "subscribed";
  }

  private unsubscribeFromTask(ws: WebSocket, taskId: string): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }
    client.subscribedTasks.delete(taskId);
    this.taskSubscribers.get(taskId)?.delete(ws);
    if (this.taskSubscribers.get(taskId)?.size === 0) {
      this.taskSubscribers.delete(taskId);
    }
  }

  private handleDisconnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }
    for (const taskId of client.subscribedTasks) {
      this.taskSubscribers.get(taskId)?.delete(ws);
      if (this.taskSubscribers.get(taskId)?.size === 0) {
        this.taskSubscribers.delete(taskId);
      }
    }
    this.slowConsumers.delete(ws);
    ws.removeAllListeners?.();
    this.clients.delete(ws);
  }

  public broadcastToTask(taskId: string, event: TaskWebSocketEvent, eventId: string = `evt-${Date.now()}`): void {
    const subscribers = this.taskSubscribers.get(taskId);
    this.recordTaskEvent(taskId, eventId, event);
    if (subscribers == null || subscribers.size === 0) {
      return;
    }
    for (const ws of subscribers) {
      const client = this.clients.get(ws);
      if (client == null || ws.readyState !== ws.OPEN) {
        continue;
      }
      const scopeDecision = this.tenantScopeFilter?.evaluate(client.principal, taskId);
      if (scopeDecision != null && !scopeDecision.allowed) {
        continue;
      }
      this.sendTaskUpdate(ws, client, taskId, event, eventId);
    }
  }

  public broadcastToAll(message: WebSocketMessageType): void {
    const payload = JSON.stringify(message);
    for (const [ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getTaskSubscriberCount(taskId: string): number {
    return this.taskSubscribers.get(taskId)?.size ?? 0;
  }

  public getSlowConsumerCount(): number {
    return this.slowConsumers.size;
  }

  public async close(): Promise<void> {
    clearInterval(this.heartbeatTimer);
    for (const [ws] of this.clients) {
      ws.close(1001, "Server shutting down");
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      this.wss.close(() => finish());
      setTimeout(() => finish(), CLOSE_TIMEOUT_MS);
    });
  }

  private runHeartbeatSweep(): void {
    for (const [ws, client] of this.clients) {
      if (ws.readyState !== ws.OPEN) {
        this.handleDisconnection(ws);
        continue;
      }
      if (!client.isAlive) {
        logger.warn("WebSocket heartbeat timeout", {
          actorId: client.principal.actorId,
          tenantId: client.principal.tenantId,
        });
        this.handleDisconnection(ws);
        if (typeof (ws as { terminate?: () => void }).terminate === "function") {
          (ws as { terminate: () => void }).terminate();
        } else {
          ws.close(4000, "Heartbeat timeout");
        }
        continue;
      }
      client.isAlive = false;
      if (typeof (ws as { ping?: () => void }).ping === "function") {
        (ws as { ping: () => void }).ping();
      } else if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "ping" } satisfies WebSocketMessageType));
      }
    }
  }

  private extractBearerToken(protocolHeader: string | string[] | undefined): string | null {
    const header = Array.isArray(protocolHeader) ? protocolHeader.join(",") : protocolHeader ?? "";
    const token = header.split(",")[0]?.trim() ?? "";
    return token.length > 0 ? token : null;
  }

  private replayMissedEvents(
    ws: WebSocket,
    client: ClientConnection,
    taskId: string,
    lastEventId: string | null,
  ): void {
    // R12-08: last_event_id resume/replay support
    // If lastEventId is provided, replay events from history
    if (lastEventId == null) {
      return;
    }
    const history = this.taskEventHistory.get(taskId) ?? [];
    if (history.length === 0) {
      // No history available - send stream_gap to indicate gap
      ws.send(JSON.stringify({
        type: "stream_gap",
        taskId,
        fromEventId: lastEventId,
        toEventId: null,
        reason: "history_unavailable",
      } satisfies WebSocketMessageType));
      return;
    }

    // Find the position of lastEventId in history
    const lastSeenIndex = history.findIndex((item) => item.eventId === lastEventId);
    if (lastSeenIndex < 0) {
      // lastEventId not found in history - could be a gap or invalid ID
      // Try to find the closest event by sequence comparison
      ws.send(JSON.stringify({
        type: "stream_gap",
        taskId,
        fromEventId: lastEventId,
        toEventId: history[history.length - 1]!.eventId,
        reason: "missed_events",
      } satisfies WebSocketMessageType));
      return;
    }

    // R12-08: Replay all events after lastEventId (exclusive)
    const eventsToReplay = history.slice(lastSeenIndex + 1);
    if (eventsToReplay.length === 0) {
      // Already at head - no events to replay
      client.nextExpectedSequenceNum = client.lastAcknowledgedSequenceNum + 1;
      return;
    }

    // Replay events in order, updating sequence numbers
    for (const item of eventsToReplay) {
      this.sendTaskUpdate(ws, client, taskId, item.event, item.eventId);
    }
  }

  private sendTaskUpdate(
    ws: WebSocket,
    client: ClientConnection,
    taskId: string,
    event: TaskWebSocketEvent,
    eventId: string,
  ): void {
    // R12-07: Check back-pressure before sending to avoid unbounded buffer growth
    const bufferedAmount = Number((ws as { bufferedAmount?: number }).bufferedAmount ?? 0);
    const backPressureThreshold = this.getBackPressureThreshold();
    const isUnderBackPressure = bufferedAmount > backPressureThreshold;

    // R12-07: If under back-pressure and this is a droppable event type, skip sending
    const droppableEventTypes = new Set(["status_changed", "progress", "message_delta"]);
    if (isUnderBackPressure && droppableEventTypes.has(event.eventType)) {
      this.slowConsumers.add(ws);
      client.bufferedEventCount = client.pendingAcks.size;
      // Only send backpressure warning periodically (every 10 events or when threshold significantly exceeded)
      if (client.bufferedEventCount % 10 === 0 || bufferedAmount > backPressureThreshold * 2) {
        ws.send(JSON.stringify({
          type: "backpressure_warning",
          taskId,
          bufferedCount: client.bufferedEventCount,
          bufferedBytes: bufferedAmount,
          reason: "slow_consumer",
        } satisfies WebSocketMessageType));
      }
      return;
    }

    // For critical events (completed, failed, approval_requested), always send but track backpressure
    const criticalEventTypes = new Set(["completed", "failed", "approval_requested"]);
    if (isUnderBackPressure && !criticalEventTypes.has(event.eventType)) {
      this.slowConsumers.add(ws);
      client.bufferedEventCount = client.pendingAcks.size;
      ws.send(JSON.stringify({
        type: "backpressure_warning",
        taskId,
        bufferedCount: client.bufferedEventCount,
        bufferedBytes: bufferedAmount,
        reason: "slow_consumer",
      } satisfies WebSocketMessageType));
      return;
    }

    const sequenceNum = client.nextExpectedSequenceNum++;
    if (client.lastEventId != null && client.lastAcknowledgedSequenceNum < sequenceNum - 1) {
      ws.send(JSON.stringify({
        type: "stream_gap",
        taskId,
        fromEventId: client.lastEventId,
        toEventId: eventId,
        reason: "missed_events",
      } satisfies WebSocketMessageType));
    }
    client.lastEventId = eventId;
    client.pendingAcks.set(sequenceNum, {
      eventId,
      taskId,
      sentAt: new Date().toISOString(),
    });
    client.bufferedEventCount = client.pendingAcks.size;

    // R12-07: Check buffered amount after send and warn if still under pressure
    ws.send(JSON.stringify({
      type: "task_update",
      taskId,
      eventId,
      sequenceNum,
      event,
    } satisfies WebSocketMessageType));

    const newBufferedAmount = Number((ws as { bufferedAmount?: number }).bufferedAmount ?? 0);
    if (newBufferedAmount > backPressureThreshold) {
      this.slowConsumers.add(ws);
      // Send backpressure warning after send if still over threshold
      ws.send(JSON.stringify({
        type: "backpressure_warning",
        taskId,
        bufferedCount: client.bufferedEventCount,
        bufferedBytes: newBufferedAmount,
        reason: "slow_consumer",
      } satisfies WebSocketMessageType));
    } else {
      this.slowConsumers.delete(ws);
    }
  }

  private getBackPressureThreshold(): number {
    // Allow threshold override via environment variable or use default
    return parseInt(process.env.WS_BACK_PRESSURE_THRESHOLD ?? "", 10) || DEFAULT_BACK_PRESSURE_THRESHOLD_BYTES;
  }

  private recordTaskEvent(taskId: string, eventId: string, event: TaskWebSocketEvent): void {
    const history = this.taskEventHistory.get(taskId) ?? [];
    history.push({ eventId, event });
    while (history.length > MAX_TASK_EVENT_HISTORY) {
      history.shift();
    }
    this.taskEventHistory.set(taskId, history);
  }
}
