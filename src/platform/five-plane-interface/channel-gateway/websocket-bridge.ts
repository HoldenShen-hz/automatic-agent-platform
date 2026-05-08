/**
 * @fileoverview WebSocket Bridge - Real-time task status updates over WebSocket
 *
 * Uses WebSocket subprotocol auth instead of query-string JWTs and attaches
 * sequence numbers plus client acknowledgements for at-least-once delivery.
 */

import type { IncomingMessage, Server } from "node:http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

import type { ApiAuthService } from "../api/api-auth-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { TenantScopeFilter, type TaskProjectionScopeResolver } from "./tenant-scope-filter.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
const WS_PATH = "/ws/v1/stream";
const SLOW_CONSUMER_BUFFER_BYTES = 1_000_000;
const CLOSE_TIMEOUT_MS = 100;
const MAX_SUBSCRIPTIONS_PER_CLIENT = 100;

export type WebSocketMessageType =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "ack"; sequenceNum: number; delivered: boolean }
  | { type: "subscribe"; taskId: string }
  | { type: "unsubscribe"; taskId: string }
  | { type: "subscribed"; taskId: string }
  | { type: "unsubscribed"; taskId: string }
  | { type: "stream_gap"; taskId: string; fromEventId: string | null; toEventId: string; reason: "missed_events" }
  | { type: "backpressure_warning"; taskId: string; bufferedCount: number; reason: "slow_consumer" }
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
}

type SubscriptionResult = "subscribed" | "scope_denied" | "subscription_limit_exceeded";

export class WebSocketBridge {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientConnection>();
  private readonly taskSubscribers = new Map<string, Set<WebSocket>>();
  private readonly slowConsumers = new Set<WebSocket>();
  private readonly tenantScopeFilter: TenantScopeFilter | null;

  public constructor(
    server: Server,
    private readonly authService: ApiAuthService,
    taskScopeResolver: TaskProjectionScopeResolver | null = null,
  ) {
    this.tenantScopeFilter = taskScopeResolver == null ? null : new TenantScopeFilter(taskScopeResolver);
    this.wss = new WebSocketServer({ server, path: WS_PATH });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    logger.info("WebSocket bridge initialized", { path: WS_PATH });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const token = this.extractBearerToken(req.headers["sec-websocket-protocol"]);
    const initialTaskId = url.searchParams.get("taskId");

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
    };
    this.clients.set(ws, client);

    if (initialTaskId) {
      this.subscribeToTask(ws, initialTaskId);
    }

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessageType;
        this.handleMessage(ws, message);
      } catch {
        ws.send(JSON.stringify({ type: "error", code: "invalid_message", message: "Failed to parse message" }));
      }
    });
    ws.on("close", () => {
      this.handleDisconnection(ws);
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
        return;
      case "ack":
        if (client != null && message.delivered) {
          client.lastAcknowledgedSequenceNum = Math.max(client.lastAcknowledgedSequenceNum, message.sequenceNum);
          client.pendingAcks.delete(message.sequenceNum);
        }
        return;
      case "subscribe":
        if (typeof message.taskId === "string" && message.taskId.length > 0) {
          const result = this.subscribeToTask(ws, message.taskId);
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

  private subscribeToTask(ws: WebSocket, taskId: string): SubscriptionResult {
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
      const bufferedAmount = Number((ws as { bufferedAmount?: number }).bufferedAmount ?? 0);
      if (
        bufferedAmount > SLOW_CONSUMER_BUFFER_BYTES
        && (event.eventType === "status_changed" || event.eventType === "progress" || event.eventType === "message_delta")
      ) {
        this.slowConsumers.add(ws);
        client.bufferedEventCount = client.pendingAcks.size;
        ws.send(JSON.stringify({
          type: "backpressure_warning",
          taskId,
          bufferedCount: client.bufferedEventCount,
          reason: "slow_consumer",
        } satisfies WebSocketMessageType));
        continue;
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
      const message: WebSocketMessageType = {
        type: "task_update",
        taskId,
        eventId,
        sequenceNum,
        event,
      };
      ws.send(JSON.stringify(message));
      if (bufferedAmount > SLOW_CONSUMER_BUFFER_BYTES) {
        this.slowConsumers.add(ws);
        ws.send(JSON.stringify({
          type: "backpressure_warning",
          taskId,
          bufferedCount: client.bufferedEventCount,
          reason: "slow_consumer",
        } satisfies WebSocketMessageType));
      } else {
        this.slowConsumers.delete(ws);
      }
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

  private extractBearerToken(protocolHeader: string | string[] | undefined): string | null {
    const header = Array.isArray(protocolHeader) ? protocolHeader.join(",") : protocolHeader ?? "";
    const token = header.split(",")[0]?.trim() ?? "";
    return token.length > 0 ? token : null;
  }
}
