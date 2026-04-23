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
import type { Server } from "node:http";
import type { ApiAuthService } from "../api/api-auth-service.js";
/**
 * WebSocket message types for client-server communication.
 */
export type WebSocketMessageType = {
    type: "ping";
} | {
    type: "pong";
} | {
    type: "subscribe";
    taskId: string;
} | {
    type: "unsubscribe";
    taskId: string;
} | {
    type: "subscribed";
    taskId: string;
} | {
    type: "unsubscribed";
    taskId: string;
} | {
    type: "task_update";
    taskId: string;
    event: TaskWebSocketEvent;
} | {
    type: "error";
    code: string;
    message: string;
};
/**
 * Task-related events broadcast over WebSocket.
 */
export type TaskWebSocketEvent = {
    eventType: "status_changed";
    taskId: string;
    status: string;
    timestamp: string;
} | {
    eventType: "progress";
    taskId: string;
    progress: number;
    timestamp: string;
} | {
    eventType: "message_delta";
    taskId: string;
    delta: Record<string, unknown>;
    timestamp: string;
} | {
    eventType: "artifact_ready";
    taskId: string;
    artifactId: string;
    timestamp: string;
} | {
    eventType: "approval_requested";
    taskId: string;
    approvalId: string;
    timestamp: string;
} | {
    eventType: "completed";
    taskId: string;
    result: Record<string, unknown>;
    timestamp: string;
} | {
    eventType: "failed";
    taskId: string;
    error: string;
    timestamp: string;
};
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
export declare class WebSocketBridge {
    private readonly authService;
    private readonly wss;
    private readonly clients;
    private readonly taskSubscribers;
    constructor(server: Server, authService: ApiAuthService);
    /**
     * Handle a new WebSocket connection.
     */
    private handleConnection;
    /**
     * Handle incoming WebSocket message.
     */
    private handleMessage;
    /**
     * Subscribe a WebSocket client to a task's updates.
     */
    private subscribeToTask;
    /**
     * Unsubscribe a WebSocket client from a task's updates.
     */
    private unsubscribeFromTask;
    /**
     * Handle client disconnection.
     */
    private handleDisconnection;
    /**
     * Broadcast a task event to all subscribers of that task.
     */
    broadcastToTask(taskId: string, event: TaskWebSocketEvent): void;
    /**
     * Broadcast to all connected clients (for system-wide announcements).
     */
    broadcastToAll(message: WebSocketMessageType): void;
    /**
     * Get the number of connected clients.
     */
    getClientCount(): number;
    /**
     * Get the number of subscribers for a specific task.
     */
    getTaskSubscriberCount(taskId: string): number;
    /**
     * Close all connections and shut down the WebSocket server.
     */
    close(): Promise<void>;
}
