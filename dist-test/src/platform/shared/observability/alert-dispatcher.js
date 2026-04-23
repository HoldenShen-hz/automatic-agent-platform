/**
 * Alert Dispatcher
 *
 * Handles alert event persistence and delivery through configured channels.
 * Provides a clean separation of concerns for alert dispatching logic.
 */
import { alertSeverityToUnifiedSeverity } from "../../contracts/types/index.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class AlertDispatcher {
    db;
    channels;
    constructor(db, options) {
        this.db = db;
        this.channels = new Map();
        if (options?.channels) {
            for (const [kind, channel] of Object.entries(options.channels)) {
                this.channels.set(kind, channel);
            }
        }
        // Ensure a log channel is always available
        if (!this.channels.has("log")) {
            this.channels.set("log", new InMemoryLogChannel());
        }
    }
    /**
     * Persists an alert event to the database.
     */
    persistAlertEvent(event) {
        this.db.connection
            .prepare(`INSERT INTO alert_events (id, rule_id, severity, status, title, detail, channel_kind, delivered_at, acknowledged_by, resolved_at, fired_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(event.id, event.ruleId, event.severity, event.status, event.title, event.detail, event.channelKind, event.deliveredAt, event.acknowledgedBy, event.resolvedAt, event.firedAt);
    }
    /**
     * Updates an alert event's delivered timestamp.
     */
    markDelivered(alertId, deliveredAt) {
        this.db.connection
            .prepare(`UPDATE alert_events SET delivered_at = ? WHERE id = ?`)
            .run(deliveredAt, alertId);
    }
    /**
     * Retrieves an alert rule by ID.
     */
    getAlertRule(ruleId) {
        return this.db.connection
            .prepare(`SELECT * FROM alert_rules WHERE id = ?`)
            .get(ruleId);
    }
    /**
     * Gets a delivery channel by kind.
     */
    getChannel(kind) {
        return this.channels.get(kind);
    }
    /**
     * Gets all registered channel kinds.
     */
    getRegisteredChannelKinds() {
        return Array.from(this.channels.keys());
    }
    /**
     * Registers a delivery channel.
     */
    registerChannel(kind, channel) {
        this.channels.set(kind, channel);
    }
    /**
     * Creates and dispatches a new alert event.
     */
    dispatch(ruleId, title, detail, severity, channelKind) {
        const now = nowIso();
        const rule = this.getAlertRule(ruleId);
        // Extract severity and channel from rule or use defaults
        const resolvedSeverity = severity ?? (rule ? String(rule.severity) : "warning");
        const resolvedChannelKind = channelKind ?? (rule ? String(rule.channel_kind) : "log");
        const event = {
            id: newId("alert"),
            ruleId,
            severity: resolvedSeverity,
            unifiedSeverity: alertSeverityToUnifiedSeverity(resolvedSeverity),
            status: "firing",
            title,
            detail,
            channelKind: resolvedChannelKind,
            deliveredAt: null,
            acknowledgedBy: null,
            resolvedAt: null,
            firedAt: now,
        };
        // Persist alert event
        this.persistAlertEvent(event);
        // Attempt delivery through the configured channel
        const channel = this.channels.get(resolvedChannelKind);
        if (channel) {
            const config = rule ? JSON.parse(String(rule.channel_config ?? "{}")) : {};
            const result = channel.deliver(event, config);
            if (result.delivered) {
                const deliveredAt = nowIso();
                this.markDelivered(event.id, deliveredAt);
                event.deliveredAt = deliveredAt;
            }
        }
        return event;
    }
    /**
     * Creates an alert event directly with explicit values (bypassing rule lookup).
     */
    dispatchRaw(ruleId, title, detail, severity, channelKind) {
        const now = nowIso();
        const event = {
            id: newId("alert"),
            ruleId,
            severity,
            unifiedSeverity: alertSeverityToUnifiedSeverity(severity),
            status: "firing",
            title,
            detail,
            channelKind,
            deliveredAt: null,
            acknowledgedBy: null,
            resolvedAt: null,
            firedAt: now,
        };
        // Persist alert event
        this.persistAlertEvent(event);
        // Attempt delivery
        const channel = this.channels.get(channelKind);
        if (channel) {
            const result = channel.deliver(event, {});
            if (result.delivered) {
                const deliveredAt = nowIso();
                this.markDelivered(event.id, deliveredAt);
                event.deliveredAt = deliveredAt;
            }
        }
        return event;
    }
}
/**
 * In-memory log channel for default alerting.
 */
class InMemoryLogChannel {
    kind = "log";
    deliveredEvents = [];
    deliver(event) {
        this.deliveredEvents.push(event);
        return { channelKind: "log", delivered: true, error: null };
    }
    getDelivered() {
        return [...this.deliveredEvents];
    }
    clear() {
        this.deliveredEvents.length = 0;
    }
}
//# sourceMappingURL=alert-dispatcher.js.map