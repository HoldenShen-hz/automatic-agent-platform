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
 * Connect to `/ws?token=<jwt_token>&taskId=<task_id>` for task-specific updates.
 * Or connect to `/ws?token=<jwt_token>` for general broadcasts.
 *
 * @see SSE/StreamBridge: src/gateway/stream/stream-bridge.ts
 * @see Gateway Streaming Contract: docs_zh/contracts/gateway_streaming_contract.md
 */
import { WebSocketServer } from "ws";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * WebSocket bridge for real-time task status updates.
 *
 * This bridge:
 * - Accepts WebSocket connections at `/ws` path
 * - Authenticates clients via JWT token in query parameter
 * - Allows clients to subscribe to specific task updates
 * - Broadcasts task events to subscribed clients
 * - Maintains connection health via ping/pong
 */
export class WebSocketBridge {
    authService;
    wss;
    clients = new Map();
    taskSubscribers = new Map();
    constructor(server, authService) {
        this.authService = authService;
        this.wss = new WebSocketServer({ server, path: "/ws" });
        this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
        logger.info("WebSocket bridge initialized", { path: "/ws" });
    }
    /**
     * Handle a new WebSocket connection.
     */
    handleConnection(ws, req) {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const token = url.searchParams.get("token");
        const initialTaskId = url.searchParams.get("taskId");
        // Authenticate the connection
        if (!token) {
            ws.close(4001, "Missing token");
            logger.warn("WebSocket connection rejected: missing token");
            return;
        }
        let principal;
        try {
            const apiPrincipal = this.authService.authenticate({ authorization: `Bearer ${token}` });
            principal = { actorId: apiPrincipal.actorId, tenantId: apiPrincipal.tenantId };
        }
        catch {
            ws.close(4003, "Invalid token");
            logger.warn("WebSocket connection rejected: invalid token");
            return;
        }
        // Register the client
        const client = {
            webSocket: ws,
            principal,
            subscribedTasks: new Set(),
        };
        this.clients.set(ws, client);
        // Subscribe to initial task if provided
        if (initialTaskId) {
            this.subscribeToTask(ws, initialTaskId);
        }
        // Handle incoming messages
        ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(ws, message);
            }
            catch {
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
    handleMessage(ws, message) {
        switch (message.type) {
            case "ping":
                ws.send(JSON.stringify({ type: "pong" }));
                break;
            case "subscribe":
                if (typeof message.taskId === "string" && message.taskId.length > 0) {
                    this.subscribeToTask(ws, message.taskId);
                    ws.send(JSON.stringify({ type: "subscribed", taskId: message.taskId }));
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
    subscribeToTask(ws, taskId) {
        const client = this.clients.get(ws);
        if (!client)
            return;
        client.subscribedTasks.add(taskId);
        if (!this.taskSubscribers.has(taskId)) {
            this.taskSubscribers.set(taskId, new Set());
        }
        this.taskSubscribers.get(taskId).add(ws);
        logger.debug("Client subscribed to task", {
            actorId: client.principal.actorId,
            taskId,
        });
    }
    /**
     * Unsubscribe a WebSocket client from a task's updates.
     */
    unsubscribeFromTask(ws, taskId) {
        const client = this.clients.get(ws);
        if (!client)
            return;
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
    handleDisconnection(ws) {
        const client = this.clients.get(ws);
        if (!client)
            return;
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
     */
    broadcastToTask(taskId, event) {
        const subscribers = this.taskSubscribers.get(taskId);
        if (!subscribers || subscribers.size === 0) {
            return;
        }
        const message = JSON.stringify({
            type: "task_update",
            taskId,
            event,
        });
        let deliveredCount = 0;
        for (const ws of subscribers) {
            if (ws.readyState === ws.OPEN) {
                ws.send(message);
                deliveredCount++;
            }
        }
        logger.debug("Broadcast to task subscribers", {
            taskId,
            eventType: event.eventType,
            subscriberCount: subscribers.size,
            deliveredCount,
        });
    }
    /**
     * Broadcast to all connected clients (for system-wide announcements).
     */
    broadcastToAll(message) {
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
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get the number of subscribers for a specific task.
     */
    getTaskSubscriberCount(taskId) {
        return this.taskSubscribers.get(taskId)?.size ?? 0;
    }
    /**
     * Close all connections and shut down the WebSocket server.
     */
    async close() {
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
//# sourceMappingURL=websocket-bridge.js.map