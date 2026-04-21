/**
 * Alert Dispatcher
 *
 * Handles alert event persistence and delivery through configured channels.
 * Provides a clean separation of concerns for alert dispatching logic.
 */

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type {
  AlertChannelKind,
  AlertEvent,
  AlertSeverity,
  RawRow,
} from "./slo-alerting/types.js";
import type { AlertChannel } from "./slo-alerting-service.js";

export interface AlertDispatcherOptions {
  channels?: Record<AlertChannelKind, AlertChannel>;
}

export class AlertDispatcher {
  private readonly channels: Map<AlertChannelKind, AlertChannel>;

  constructor(
    private readonly db: AuthoritativeSqlDatabase,
    options?: AlertDispatcherOptions,
  ) {
    this.channels = new Map();
    if (options?.channels) {
      for (const [kind, channel] of Object.entries(options.channels)) {
        this.channels.set(kind as AlertChannelKind, channel);
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
  public persistAlertEvent(event: AlertEvent): void {
    this.db.connection
      .prepare(
        `INSERT INTO alert_events (id, rule_id, severity, status, title, detail, channel_kind, delivered_at, acknowledged_by, resolved_at, fired_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.ruleId,
        event.severity,
        event.status,
        event.title,
        event.detail,
        event.channelKind,
        event.deliveredAt,
        event.acknowledgedBy,
        event.resolvedAt,
        event.firedAt,
      );
  }

  /**
   * Updates an alert event's delivered timestamp.
   */
  public markDelivered(alertId: string, deliveredAt: string): void {
    this.db.connection
      .prepare(`UPDATE alert_events SET delivered_at = ? WHERE id = ?`)
      .run(deliveredAt, alertId);
  }

  /**
   * Retrieves an alert rule by ID.
   */
  public getAlertRule(ruleId: string): RawRow | undefined {
    return this.db.connection
      .prepare(`SELECT * FROM alert_rules WHERE id = ?`)
      .get(ruleId) as RawRow | undefined;
  }

  /**
   * Gets a delivery channel by kind.
   */
  public getChannel(kind: AlertChannelKind): AlertChannel | undefined {
    return this.channels.get(kind);
  }

  /**
   * Gets all registered channel kinds.
   */
  public getRegisteredChannelKinds(): AlertChannelKind[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Registers a delivery channel.
   */
  public registerChannel(kind: AlertChannelKind, channel: AlertChannel): void {
    this.channels.set(kind, channel);
  }

  /**
   * Creates and dispatches a new alert event.
   */
  public dispatch(
    ruleId: string,
    title: string,
    detail: string,
    severity?: AlertSeverity,
    channelKind?: AlertChannelKind,
  ): AlertEvent {
    const now = nowIso();
    const rule = this.getAlertRule(ruleId);

    // Extract severity and channel from rule or use defaults
    const resolvedSeverity: AlertSeverity = severity ?? (rule ? String(rule.severity) as AlertSeverity : "warning");
    const resolvedChannelKind: AlertChannelKind = channelKind ?? (rule ? String(rule.channel_kind) as AlertChannelKind : "log");

    const event: AlertEvent = {
      id: newId("alert"),
      ruleId,
      severity: resolvedSeverity,
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
  public dispatchRaw(
    ruleId: string,
    title: string,
    detail: string,
    severity: AlertSeverity,
    channelKind: AlertChannelKind,
  ): AlertEvent {
    const now = nowIso();

    const event: AlertEvent = {
      id: newId("alert"),
      ruleId,
      severity,
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
class InMemoryLogChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "log";
  private readonly deliveredEvents: AlertEvent[] = [];

  deliver(event: AlertEvent): { channelKind: AlertChannelKind; delivered: boolean; error: string | null } {
    this.deliveredEvents.push(event);
    return { channelKind: "log", delivered: true, error: null };
  }

  getDelivered(): AlertEvent[] {
    return [...this.deliveredEvents];
  }

  clear(): void {
    this.deliveredEvents.length = 0;
  }
}
