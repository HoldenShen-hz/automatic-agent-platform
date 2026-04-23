import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class TaskWebSocketStatusRelay {
    server;
    store;
    pollIntervalMs;
    backlogLimit;
    seenEventIds = new Set();
    timer = null;
    constructor(server, store, options = {}) {
        this.server = server;
        this.store = store;
        this.pollIntervalMs = options.pollIntervalMs ?? 1000;
        this.backlogLimit = options.backlogLimit ?? 100;
    }
    start() {
        if (this.timer != null) {
            return;
        }
        for (const event of this.store.event.listEventsByType("task:status_changed", this.backlogLimit)) {
            this.markSeen(event.id);
        }
        this.timer = setInterval(() => {
            this.pollOnce();
        }, this.pollIntervalMs);
        this.timer.unref?.();
    }
    stop() {
        if (this.timer != null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    pollOnce() {
        try {
            const recentEvents = this.store.event
                .listEventsByType("task:status_changed", this.backlogLimit)
                .slice()
                .reverse();
            for (const event of recentEvents) {
                if (this.seenEventIds.has(event.id)) {
                    continue;
                }
                this.markSeen(event.id);
                this.broadcastStatusChanged(event);
            }
        }
        catch (error) {
            logger.warn("task websocket status relay poll failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    broadcastStatusChanged(event) {
        if (event.taskId == null) {
            return;
        }
        const payload = safeParsePayload(event.payloadJson);
        const status = typeof payload?.toStatus === "string" ? payload.toStatus : null;
        const timestamp = typeof payload?.occurredAt === "string" ? payload.occurredAt : event.createdAt;
        if (status == null) {
            return;
        }
        this.server.broadcastTaskEvent(event.taskId, {
            eventType: "status_changed",
            taskId: event.taskId,
            status,
            timestamp,
        });
    }
    markSeen(eventId) {
        this.seenEventIds.add(eventId);
        if (this.seenEventIds.size <= this.backlogLimit * 10) {
            return;
        }
        const overflow = this.seenEventIds.size - this.backlogLimit * 10;
        const iterator = this.seenEventIds.values();
        for (let i = 0; i < overflow; i++) {
            const next = iterator.next();
            if (next.done) {
                break;
            }
            this.seenEventIds.delete(next.value);
        }
    }
}
function safeParsePayload(payloadJson) {
    try {
        const parsed = JSON.parse(payloadJson);
        return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=task-websocket-status-relay.js.map