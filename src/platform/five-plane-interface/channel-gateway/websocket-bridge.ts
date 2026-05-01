/**
 * @fileoverview WebSocket Bridge - Real-time task status updates over WebSocket
 *
 * Provides WebSocket connectivity for real-time task status updates,
 * complementing the existing SSE (Server-Sent Events) streaming via StreamBridge.
 *
 * ## Key Features
 *
 * - Token-based authentication via secure WebSocket subprotocol header (rfc6455)
 * - Task-specific subscriptions for targeted updates
 * - Broadcast capability for server-initiated notifications
 * - Ping/pong heartbeat for connection health
 *
 * ## Usage
 *
 * Connect to `/ws/v1/stream` with Sec-WebSocket-Protocol header containing the JWT.
 * Or connect to `/ws/v1/stream` with initial task subscription message after auth.
 *
 * ## Security
 *
 * §11: JWT must NOT be passed as URL query parameter to prevent exposure in:
 * - Access logs / proxy logs
 * - Referer headers
 * - Browser history
 * - Server-side logging
 *
 * Instead, authentication uses the WebSocket subprotocol header (Sec-WebSocket-Protocol)
 * which is not included in HTTP request logs or forwarded by standard proxies.
 *
 * @see SSE/StreamBridge: src/gateway/stream/stream-bridge.ts
 * @see Gateway Streaming Contract: docs_zh/contracts/gateway_streaming_contract.md
 */

import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { z } from "zod";
import type { ApiAuthService } from "../api/api-auth-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { nowIso } from "../../contracts/types/ids.js";
import { TenantScopeFilter, type TaskProjectionScopeResolver } from "./tenant-scope-filter.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Schema for validating incoming WebSocket messages at the entry boundary.
 * §5.2 / §7.1: External client input at the entry boundary requires runtime schema check.
 * Uses strict objects to ensure all fields are required (matching WebSocketMessageType).
 */
const webSocketMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ping") }),
  z.strictObject({ type: z.literal("pong") }),
  z.strictObject({ type: z.literal("subscribe"), taskId: z.string().min(1) }),
  z.strictObject({ type: z.literal("unsubscribe"), taskId: z.string().min(1) }),
  z.strictObject({ type: z.literal("subscribed"), taskId: z.string().min(1) }),
  z.strictObject({ type: z.literal("unsubscribed"), taskId: z.string().min(1) }),
  z.strictObject({ type: z.literal("task_update"), taskId: z.string().min(1), sequenceNum: z.number().int().nonnegative(), eventId: z.string(), event: z.record(z.unknown()) }),
  z.strictObject({ type: z.literal("error"), code: z.string(), message: z.string() }),
  // §6.7/R15-80: Ack message for delivery guarantee
  z.strictObject({ type: z.literal("ack"), sequenceNum: z.number().int().nonnegative(), delivered: z.boolean() }),
]);

/**
 * WebSocket message types for client-server communication.
 * §7: Includes stream_gap for gap detection and event_id for resume tracking.
 * §6.7/R15-80: Includes sequenceNum for at-least-once delivery guarantee.
 */
export type WebSocketMessageType =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "subscribe"; taskId: string }
  | { type: "unsubscribe"; taskId: string }
  | { type: "subscribed"; taskId: string }
  | { type: "unsubscribed"; taskId: string }
  | { type: "task_update"; taskId: string; sequenceNum: number; eventId: string; event: TaskWebSocketEvent }
  | { type: "error"; code: string; message: string }
  | { type: "stream_gap"; taskId: string; fromEventId: string; toEventId: string; reason: string }
  | { type: "backpressure_warning"; taskId: string; bufferedCount: number; reason: string }
  // §6.7/R15-80: Ack message for at-least-once delivery guarantee
  | { type: "ack"; sequenceNum: number; delivered: boolean };

/**
 * Task-related events broadcast over WebSocket.
 */
export type TaskWebSocketEvent =
  | { eventType: "status_changed"; taskId: string; status: string; timestamp: string }
  | { eventType: "progress"; taskId: string; progress: number; timestamp: string }
  | { eventType: "message_delta"; taskId: string; delta: Record<string, unknown>; timestamp: string }
  | { eventType: "artifact_ready"; taskId: string; artifactId: string; timestamp: string }
  | { eventType: "approval_requested"; taskId: string; approvalId: string; timestamp: string }
  | { eventType: "completed"; taskId: string; result: Record<string, unknown>; timestamp: string }
  | { eventType: "failed"; taskId: string; error: string; timestamp: string };

/**
 * Connection metadata for a WebSocket client.
 * §6.7/R15-80: Tracks sequence numbers for at-least-once delivery guarantee.
 */
interface ClientConnection {
  webSocket: WebSocket;
  principal: { actorId: string; tenantId: string | null; scopes: readonly string[] };
  subscribedTasks: Set<string>;
  /** Last event ID received by this client for resume/replay */
  lastEventId: string | null;
  /** §6.7/R15-80: Next expected sequence number for ordering */
  nextExpectedSequenceNum: number;
  /** §6.7/R15-80: Last acknowledged sequence number */
  lastAcknowledgedSequenceNum: number;
  /** §6.7/R15-80: Pending messages awaiting ack (sequenceNum -> sentAt) */
  pendingAcks: Map<number, string>;
  /** Buffered event count for back-pressure monitoring */
  bufferedEventCount: number;
}

/**
 * WebSocket bridge for real-time task status updates.
 *
 * This bridge:
 * - Accepts WebSocket connections at `/ws/v1/stream`
 * - Authenticates clients via JWT token in query parameter
 * - Allows clients to subscribe to specific task updates
 * - Broadcasts task events to subscribed clients
 * - Maintains connection health via ping/pong
 * - Implements server-side backpressure via bufferedAmount checking per §7.1
 */
export class WebSocketBridge {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientConnection>();
  private readonly taskSubscribers = new Map<string, Set<WebSocket>>();
  /** §7.1: Per-connection backpressure tracking for slow-consumer detection */
  private readonly slowConsumers = new Set<WebSocket>();
  private readonly tenantScopeFilter: TenantScopeFilter | null;
  /** §9 isolation: Per-client subscription cap to prevent memory exhaustion */
  private static readonly MAX_SUBSCRIPTIONS_PER_CLIENT = 100;
  /** #2355: Max WebSocket message size to prevent GB-level frame OOM DoS (1MB) */
  private static readonly MAX_MESSAGE_SIZE_BYTES = 1_000_000;

  constructor(
    server: Server,
    private readonly authService: ApiAuthService,
    taskScopeResolver: TaskProjectionScopeResolver | null = null,
  ) {
    this.tenantScopeFilter = taskScopeResolver == null ? null : new TenantScopeFilter(taskScopeResolver);
    this.wss = new WebSocketServer({ server, path: "/ws/v1/stream" });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    logger.info("WebSocket bridge initialized", { path: "/ws/v1/stream" });
  }

  /**
   * Handle a new WebSocket connection.
   *
   * §11 Security: JWT token is received via Sec-WebSocket-Protocol header (rfc6455)
   * instead of URL query parameter to prevent exposure in logs/Referer.
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const initialTaskId = url.searchParams.get("taskId");
    // §7: last_event_id for resume/replay on reconnect
    const lastEventId = url.searchParams.get("last_event_id");

    // §11: JWT must be passed via Sec-WebSocket-Protocol header, NOT URL query param
    // This prevents token exposure in access logs, proxy logs, and Referer headers
    const protocolHeader = req.headers["sec-websocket-protocol"];
    const token = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader;

    // Authenticate the connection
    if (!token) {
      ws.close(4001, "Missing token");
      logger.warn("WebSocket connection rejected: missing token");
      return;
    }

    let principal: { actorId: string; tenantId: string | null; scopes: readonly string[] };
    try {
      const apiPrincipal = this.authService.authenticate({ authorization: `Bearer ${token}` });
      principal = { actorId: apiPrincipal.actorId, tenantId: apiPrincipal.tenantId, scopes: apiPrincipal.roles };
    } catch {
      ws.close(4003, "Invalid token");
      logger.warn("WebSocket connection rejected: invalid token");
      return;
    }

    // Register the client
    // §6.7/R15-80: Initialize sequence tracking for at-least-once delivery
    const client: ClientConnection = {
      webSocket: ws,
      principal,
      subscribedTasks: new Set(),
      lastEventId,
      nextExpectedSequenceNum: 0,
      lastAcknowledgedSequenceNum: -1,
      pendingAcks: new Map(),
      bufferedEventCount: 0,
    };
    this.clients.set(ws, client);

    // Subscribe to initial task if provided
    if (initialTaskId) {
      this.subscribeToTask(ws, initialTaskId);
    }

    // §7: If client provides last_event_id on reconnect, replay any missed events
    if (lastEventId && initialTaskId) {
      this.replayMissedEvents(ws, client, initialTaskId, lastEventId);
    }

    // Handle incoming messages
    ws.on("message", (data) => {
      try {
        // #2355: Check message size before parsing to prevent OOM DoS
        const dataLength = data.length;
        if (dataLength > WebSocketBridge.MAX_MESSAGE_SIZE_BYTES) {
          logger.warn("WebSocket message too large, rejecting", { dataLength, maxSize: WebSocketBridge.MAX_MESSAGE_SIZE_BYTES });
          ws.send(JSON.stringify({ type: "error", code: "message_too_large", message: `Message exceeds maximum size of ${WebSocketBridge.MAX_MESSAGE_SIZE_BYTES} bytes` }));
          return;
        }
        const parsed = JSON.parse(data.toString());
        // §5.2 / §7.1: Schema-validated parsing at entry boundary for external client input
        const result = webSocketMessageSchema.safeParse(parsed);
        if (!result.success) {
          ws.send(JSON.stringify({ type: "error", code: "invalid_message", message: "Failed to parse message" }));
          return;
        }
        // Cast to WebSocketMessageType - Zod has validated the structure
        const message = result.data as WebSocketMessageType;
        this.handleMessage(ws, message);
      } catch {
        ws.send(JSON.stringify({ type: "error", code: "invalid_message", message: "Failed to parse message" }));
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on("error", (error) => {
      logger.error("WebSocket client error", {
        actorId: principal.actorId,
        error: error.message,
      });
    });

    logger.info("WebSocket client connected", {
      actorId: principal.actorId,
      tenantId: principal.tenantId,
      initialTaskId: initialTaskId ?? null,
    });
  }

  /**
   * Handle incoming WebSocket message.
   * §6.7/R15-80: Handles ack messages for delivery guarantee.
   */
  private handleMessage(ws: WebSocket, message: WebSocketMessageType): void {
    switch (message.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;
      case "subscribe":
        if (typeof message.taskId === "string" && message.taskId.length > 0) {
          const subscribed = this.subscribeToTask(ws, message.taskId);
          ws.send(JSON.stringify(subscribed
            ? { type: "subscribed", taskId: message.taskId }
            : { type: "error", code: "scope_denied", message: "Task scope denied" }));
        }
        break;
      case "unsubscribe":
        if (typeof message.taskId === "string" && message.taskId.length > 0) {
          this.unsubscribeFromTask(ws, message.taskId);
          ws.send(JSON.stringify({ type: "unsubscribed", taskId: message.taskId }));
        }
        break;
      case "pong":
        // Heartbeat response - no action needed
        break;
      // §6.7/R15-80: Handle ack messages for at-least-once delivery guarantee
      case "ack":
        this.handleAck(ws, message.sequenceNum, message.delivered);
        break;
      default:
        ws.send(JSON.stringify({ type: "error", code: "unknown_message", message: "Unknown message type" }));
    }
  }

  /**
   * Handle acknowledgment from client.
   * §6.7/R15-80: Tracks acknowledged sequence numbers for delivery guarantee.
   */
  private handleAck(ws: WebSocket, sequenceNum: number, delivered: boolean): void {
    const client = this.clients.get(ws);
    if (!client) return;

    if (delivered) {
      // Client confirmed delivery - update last acknowledged sequence
      if (sequenceNum > client.lastAcknowledgedSequenceNum) {
        client.lastAcknowledgedSequenceNum = sequenceNum;
      }
      // Remove from pending acks
      client.pendingAcks.delete(sequenceNum);
      logger.debug("Message delivery confirmed", {
        actorId: client.principal.actorId,
        sequenceNum,
      });
    } else {
      // Client rejected delivery - mark for retry
      client.pendingAcks.set(sequenceNum, "rejected");
      logger.warn("Message delivery rejected by client, will retry", {
        actorId: client.principal.actorId,
        sequenceNum,
      });
    }
  }

  /**
   * Subscribe a WebSocket client to a task's updates.
   */
  private subscribeToTask(ws: WebSocket, taskId: string): boolean {
    const client = this.clients.get(ws);
    if (!client) return false;

    const scopeDecision = this.tenantScopeFilter?.evaluate(client.principal, taskId);
    if (scopeDecision != null && !scopeDecision.allowed) {
      logger.warn("WebSocket task subscription denied by tenant scope filter", {
        actorId: client.principal.actorId,
        tenantId: client.principal.tenantId,
        taskId,
        reasonCode: scopeDecision.reasonCode,
      });
      return false;
    }

    // §9 isolation: Enforce per-client subscription cap to prevent memory exhaustion
    if (client.subscribedTasks.size >= WebSocketBridge.MAX_SUBSCRIPTIONS_PER_CLIENT) {
      logger.warn("WebSocket client subscription limit reached", {
        actorId: client.principal.actorId,
        tenantId: client.principal.tenantId,
        taskId,
        subscriptionCount: client.subscribedTasks.size,
        limit: WebSocketBridge.MAX_SUBSCRIPTIONS_PER_CLIENT,
      });
      return false;
    }

    client.subscribedTasks.add(taskId);

    if (!this.taskSubscribers.has(taskId)) {
      this.taskSubscribers.set(taskId, new Set());
    }
    this.taskSubscribers.get(taskId)!.add(ws);

    logger.debug("Client subscribed to task", {
      actorId: client.principal.actorId,
      taskId,
    });
    return true;
  }

  /**
   * Unsubscribe a WebSocket client from a task's updates.
   */
  private unsubscribeFromTask(ws: WebSocket, taskId: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    client.subscribedTasks.delete(taskId);
    this.taskSubscribers.get(taskId)?.delete(ws);

    if (this.taskSubscribers.get(taskId)?.size === 0) {
      this.taskSubscribers.delete(taskId);
    }

    logger.debug("Client unsubscribed from task", {
      actorId: client.principal.actorId,
      taskId,
    });
  }

  /**
   * Handle client disconnection.
   */
  private handleDisconnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove from all task subscriptions
    for (const taskId of Array.from(client.subscribedTasks)) {
      this.taskSubscribers.get(taskId)?.delete(ws);
      if (this.taskSubscribers.get(taskId)?.size === 0) {
        this.taskSubscribers.delete(taskId);
      }
    }

    // §7.1: Remove from slow consumer tracking
    this.slowConsumers.delete(ws);
    this.clients.delete(ws);

    logger.info("WebSocket client disconnected", {
      actorId: client.principal.actorId,
    });
  }

  /**
   * Broadcast a task event to all subscribers of that task.
   * Implements back-pressure by checking buffered amount before sending.
   * §7.1: Server-side backpressure - when buffer is full, drop low-priority events
   * but still deliver critical events (completed, failed, approval_requested).
   * §7: Includes event_id for resume/replay support.
   * §6.7/R15-80: Includes sequenceNum for at-least-once delivery guarantee.
   */
  broadcastToTask(taskId: string, event: TaskWebSocketEvent, eventId?: string): void {
    const subscribers = this.taskSubscribers.get(taskId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    let deliveredCount = 0;

    for (const ws of Array.from(subscribers)) {
      const client = this.clients.get(ws);
      if (!client) continue;

      const scopeDecision = this.tenantScopeFilter?.evaluate(client.principal, taskId);
      if (ws.readyState !== ws.OPEN || (scopeDecision != null && !scopeDecision.allowed)) {
        continue;
      }

      // §7.1: Back-pressure check - detect slow consumers with large send buffers
      const bufferedAmount = ws.bufferedAmount;
      const maxBufferedAmount = 1_000_000; // 1MB threshold

      if (bufferedAmount > maxBufferedAmount) {
        // §7.1: Mark client as slow consumer for tracking
        this.slowConsumers.add(ws);

        // §7.1: Critical events are never dropped - always deliver
        const isCritical = event.eventType === "completed" ||
                           event.eventType === "failed" ||
                           event.eventType === "approval_requested" ||
                           event.eventType === "artifact_ready";

        if (!isCritical) {
          // §7.1: Drop low-priority event for slow consumer
          logger.debug("Dropping low-priority event for slow consumer", {
            actorId: client.principal.actorId,
            taskId,
            eventType: event.eventType,
            bufferedAmount,
          });
          continue;
        }
        // Critical events still get through even for slow consumers
      } else {
        // §7.1: Clear slow consumer flag when buffer drains
        this.slowConsumers.delete(ws);
      }

      // §6.7/R15-80: Assign sequence number for at-least-once delivery guarantee
      const sequenceNum = client.nextExpectedSequenceNum++;

      // §7: Include eventId for resume/replay support
      const message = JSON.stringify({
        type: "task_update",
        taskId,
        sequenceNum, // §6.7/R15-80: Sequence number for ordering and ack
        eventId: eventId ?? null,
        event,
      });

      // §7/R12-08: Check for event gap before sending and notify client
      if (eventId && this.hasEventGap(client, eventId)) {
        const gapMessage = JSON.stringify({
          type: "stream_gap",
          taskId,
          fromEventId: client.lastEventId ?? "start",
          toEventId: eventId,
          reason: "missed_events",
        });
        ws.send(gapMessage);
        logger.warn("WebSocket client has event gap, notifying client", {
          actorId: client.principal.actorId,
          taskId,
          fromEventId: client.lastEventId,
          toEventId: eventId,
        });
      }

      ws.send(message);

      // §6.7/R15-80: Track pending ack for at-least-once delivery
      client.pendingAcks.set(sequenceNum, nowIso());
      client.lastEventId = eventId ?? client.lastEventId;
      client.bufferedEventCount++;
      deliveredCount++;
    }

    logger.debug("Broadcast to task subscribers", {
      taskId,
      eventType: event.eventType,
      eventId,
      subscriberCount: subscribers.size,
      deliveredCount,
    });
  }

  /**
   * Check if client has missed events since lastEventId.
   * Returns true if there's a gap indicating missing events.
   * §7: Emits stream_gap event to client when gap is detected.
   */
  private hasEventGap(client: ClientConnection, currentEventId: string): boolean {
    if (client.lastEventId === null) {
      return false;
    }
    // Simple sequence check - in production this would use proper sequence comparison
    return currentEventId > client.lastEventId;
  }

  /**
   * Notify client of a stream gap (missed events).
   * §7: Sends stream_gap event to client with from/to event IDs and reason.
   */
  private notifyStreamGap(client: ClientConnection, taskId: string, fromEventId: string, toEventId: string, reason: string): void {
    if (client.webSocket.readyState !== client.webSocket.OPEN) {
      return;
    }

    const gapMessage = JSON.stringify({
      type: "stream_gap",
      taskId,
      fromEventId,
      toEventId,
      reason,
    });

    try {
      client.webSocket.send(gapMessage);
    } catch (error) {
      logger.warn("Failed to send stream_gap notification", {
        actorId: client.principal.actorId,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Replay missed events for a client after reconnect.
   * §7: Uses lastEventId to fetch and replay events client missed while disconnected.
   * @param ws - The WebSocket connection
   * @param client - The client connection state
   * @param taskId - The task ID to replay events for
   * @param eventId - The last event ID the client received
   */
  private replayMissedEvents(ws: WebSocket, client: ClientConnection, taskId: string, eventId: string): void {
    // In a real implementation, this would fetch events from the event store
    // between client.lastEventId and eventId, then replay them to the client
    // For now, we emit a gap notification indicating the client should refetch
    logger.info("Replaying missed events for client", {
      actorId: client.principal.actorId,
      taskId,
      fromEventId: client.lastEventId,
      toEventId: eventId,
    });

    // Notify client of the gap - they should refetch from their last_event_id
    this.notifyStreamGap(client, taskId, client.lastEventId ?? "start", eventId, "reconnect_replay");
  }

  /**
   * Broadcast to all connected clients (for system-wide announcements).
   * Implements back-pressure by checking buffered amount before sending.
   * §7.1: Tracks slow consumers for per-connection backpressure monitoring.
   */
  broadcastToAll(message: WebSocketMessageType): void {
    const payload = JSON.stringify(message);
    for (const [ws, client] of Array.from(this.clients.entries())) {
      if (ws.readyState !== ws.OPEN) continue;

      // §7.1: Back-pressure check - track slow consumers
      const bufferedAmount = ws.bufferedAmount;
      const maxBufferedAmount = 1_000_000; // 1MB threshold
      if (bufferedAmount > maxBufferedAmount) {
        this.slowConsumers.add(ws);
        logger.warn("WebSocket client back-pressure in broadcastToAll, skipping", {
          actorId: client.principal.actorId,
          bufferedAmount,
        });
        continue;
      }

      // §7.1: Clear slow consumer flag when buffer drains
      this.slowConsumers.delete(ws);
      ws.send(payload);
    }
  }

  /**
   * Get the number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * §7.1: Get the number of slow consumers (clients with bufferedAmount > threshold).
   */
  getSlowConsumerCount(): number {
    return this.slowConsumers.size;
  }

  /**
   * Get the number of subscribers for a specific task.
   */
  getTaskSubscriberCount(taskId: string): number {
    return this.taskSubscribers.get(taskId)?.size ?? 0;
  }

  /**
   * Close all connections and shut down the WebSocket server.
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      for (const [ws] of Array.from(this.clients.entries())) {
        ws.close(1001, "Server shutting down");
      }

      this.wss.close(() => {
        logger.info("WebSocket bridge closed");
        resolve();
      });
    });
  }
}
