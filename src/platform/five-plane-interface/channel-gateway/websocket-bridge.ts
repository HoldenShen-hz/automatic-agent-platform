/**
 * @fileoverview WebSocket Bridge - Real-time task status updates over WebSocket
 *
 * Provides WebSocket connectivity for real-time task status updates,
 * complementing the existing SSE (Server-Sent Events) streaming via StreamBridge.
 *
 * ## Key Features
 *
 * - Token-based authentication via URL query parameter
 * - Task-specific subscriptions for targeted updates
 * - Broadcast capability for server-initiated notifications
 * - Ping/pong heartbeat for connection health
 *
 * ## Usage
 *
 * Connect to `/ws/v1/stream?token=<jwt_token>&taskId=<task_id>` for task-specific updates.
 * Or connect to `/ws/v1/stream?token=<jwt_token>` for general broadcasts.
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
  z.strictObject({ type: z.literal("task_update"), taskId: z.string().min(1), event: z.record(z.unknown()) }),
  z.strictObject({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

/**
 * WebSocket message types for client-server communication.
 * §7: Includes stream_gap for gap detection and event_id for resume tracking.
 */
export type WebSocketMessageType =
  | { type: "ping" }
  | { type: "pong" }
  | { type: "subscribe"; taskId: string }
  | { type: "unsubscribe"; taskId: string }
  | { type: "subscribed"; taskId: string }
  | { type: "unsubscribed"; taskId: string }
  | { type: "task_update"; taskId: string; eventId: string; event: TaskWebSocketEvent }
  | { type: "error"; code: string; message: string }
  | { type: "stream_gap"; taskId: string; fromEventId: string; toEventId: string; reason: string }
  | { type: "backpressure_warning"; taskId: string; bufferedCount: number; reason: string };

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
 */
interface ClientConnection {
  webSocket: WebSocket;
  principal: { actorId: string; tenantId: string | null; scopes: readonly string[] };
  subscribedTasks: Set<string>;
  /** Last event ID received by this client for resume/replay */
  lastEventId: string | null;
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
 */
export class WebSocketBridge {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientConnection>();
  private readonly taskSubscribers = new Map<string, Set<WebSocket>>();
  private readonly tenantScopeFilter: TenantScopeFilter | null;

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
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const token = url.searchParams.get("token");
    const initialTaskId = url.searchParams.get("taskId");
    // §7: last_event_id for resume/replay on reconnect
    const lastEventId = url.searchParams.get("last_event_id");

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
    const client: ClientConnection = {
      webSocket: ws,
      principal,
      subscribedTasks: new Set(),
      lastEventId,
      bufferedEventCount: 0,
    };
    this.clients.set(ws, client);

    // Subscribe to initial task if provided
    if (initialTaskId) {
      this.subscribeToTask(ws, initialTaskId);
    }

    // Handle incoming messages
    ws.on("message", (data) => {
      try {
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
      default:
        ws.send(JSON.stringify({ type: "error", code: "unknown_message", message: "Unknown message type" }));
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
    for (const taskId of client.subscribedTasks) {
      this.taskSubscribers.get(taskId)?.delete(ws);
      if (this.taskSubscribers.get(taskId)?.size === 0) {
        this.taskSubscribers.delete(taskId);
      }
    }

    this.clients.delete(ws);

    logger.info("WebSocket client disconnected", {
      actorId: client.principal.actorId,
    });
  }

  /**
   * Broadcast a task event to all subscribers of that task.
   * Implements back-pressure by checking buffered amount before sending.
   * §7: Includes event_id for resume/replay support.
   */
  broadcastToTask(taskId: string, event: TaskWebSocketEvent, eventId?: string): void {
    const subscribers = this.taskSubscribers.get(taskId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    let deliveredCount = 0;
    for (const ws of subscribers) {
      const client = this.clients.get(ws);
      if (!client) continue;

      const scopeDecision = this.tenantScopeFilter?.evaluate(client.principal, taskId);
      if (ws.readyState !== ws.OPEN || (scopeDecision != null && !scopeDecision.allowed)) {
        continue;
      }

      // §7: Back-pressure check - skip slow clients with large send buffers
      // Check buffered amount to prevent memory buildup from slow consumers
      const bufferedAmount = ws.bufferedAmount;
      const maxBufferedAmount = 1_000_000; // 1MB threshold
      if (bufferedAmount > maxBufferedAmount) {
        // §9.2: Graduated back-pressure - warn client and skip delivery
        const warningMsg = JSON.stringify({
          type: "backpressure_warning",
          taskId,
          bufferedCount: client.bufferedEventCount,
          reason: "send_buffer_full",
        });
        ws.send(warningMsg);
        logger.warn("WebSocket client back-pressure, skipping delivery", {
          actorId: client.principal.actorId,
          taskId,
          bufferedAmount,
        });
        continue;
      }

      // §7: Include eventId for resume/replay support
      const message = JSON.stringify({
        type: "task_update",
        taskId,
        eventId: eventId ?? null,
        event,
      });

      ws.send(message);
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
   */
  private hasEventGap(client: ClientConnection, currentEventId: string): boolean {
    if (client.lastEventId === null) {
      return false;
    }
    // Simple sequence check - in production this would use proper sequence comparison
    return currentEventId > client.lastEventId;
  }

  /**
   * Broadcast to all connected clients (for system-wide announcements).
   */
  broadcastToAll(message: WebSocketMessageType): void {
    const payload = JSON.stringify(message);
    for (const [ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Get the number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
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
      for (const [ws] of this.clients) {
        ws.close(1001, "Server shutting down");
      }

      this.wss.close(() => {
        logger.info("WebSocket bridge closed");
        resolve();
      });
    });
  }
}
