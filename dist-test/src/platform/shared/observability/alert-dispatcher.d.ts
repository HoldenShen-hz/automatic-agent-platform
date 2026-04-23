/**
 * Alert Dispatcher
 *
 * Handles alert event persistence and delivery through configured channels.
 * Provides a clean separation of concerns for alert dispatching logic.
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AlertChannelKind, AlertEvent, AlertSeverity, RawRow } from "./slo-alerting/types.js";
import type { AlertChannel } from "./slo-alerting-service.js";
export interface AlertDispatcherOptions {
    channels?: Partial<Record<AlertChannelKind, AlertChannel>>;
}
export declare class AlertDispatcher {
    private readonly db;
    private readonly channels;
    constructor(db: AuthoritativeSqlDatabase, options?: AlertDispatcherOptions);
    /**
     * Persists an alert event to the database.
     */
    persistAlertEvent(event: AlertEvent): void;
    /**
     * Updates an alert event's delivered timestamp.
     */
    markDelivered(alertId: string, deliveredAt: string): void;
    /**
     * Retrieves an alert rule by ID.
     */
    getAlertRule(ruleId: string): RawRow | undefined;
    /**
     * Gets a delivery channel by kind.
     */
    getChannel(kind: AlertChannelKind): AlertChannel | undefined;
    /**
     * Gets all registered channel kinds.
     */
    getRegisteredChannelKinds(): AlertChannelKind[];
    /**
     * Registers a delivery channel.
     */
    registerChannel(kind: AlertChannelKind, channel: AlertChannel): void;
    /**
     * Creates and dispatches a new alert event.
     */
    dispatch(ruleId: string, title: string, detail: string, severity?: AlertSeverity, channelKind?: AlertChannelKind): AlertEvent;
    /**
     * Creates an alert event directly with explicit values (bypassing rule lookup).
     */
    dispatchRaw(ruleId: string, title: string, detail: string, severity: AlertSeverity, channelKind: AlertChannelKind): AlertEvent;
}
