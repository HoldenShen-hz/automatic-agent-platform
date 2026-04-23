/**
 * SLO Alerting Service
 *
 * Provides Service Level Objective (SLO) management, Service Level Indicator (SLI)
 * collection, alert rule evaluation, and runbook execution tracking.
 *
 * Key concepts:
 * - **SLI (Service Level Indicator)**: A quantitative measure of service behavior
 *   (e.g., success rate, latency, error rate)
 * - **SLO (Service Level Objective)**: A target value for an SLI over a time window
 *   (e.g., "99% success rate over 60 minutes")
 * - **Alert Rule**: A condition that triggers notification when evaluated
 * - **Runbook**: A documented procedure for responding to an alert
 *
 * The service maintains SQLite tables for:
 * - SLI samples (raw measurements)
 * - SLO definitions (targets and windows)
 * - Alert rules (conditions and delivery channels)
 * - Alert events (fired alerts with status)
 * - Runbook definitions and executions
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/slo_alerting_and_runbook_contract.md | SLO Alerting and Runbook Contract}
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type AlertChannelKind, type AlertEvent, type AlertRule, type AlertStatus, type RunbookDefinition, type RunbookExecution, type SliRecord, type SloDefinition, type SloStatus } from "./slo-alerting/types.js";
export { SLO_ALERTING_DDL } from "./slo-alerting/types.js";
export type { AlertChannelKind, AlertEvent, AlertRule, AlertSeverity, AlertStatus, RunbookDefinition, RunbookExecution, RunbookStatus, SliKind, SliRecord, SloDefinition, SloStatus, } from "./slo-alerting/types.js";
/**
 * Result of an alert delivery attempt.
 */
export interface AlertDeliveryResult {
    channelKind: AlertChannelKind;
    delivered: boolean;
    error: string | null;
}
/**
 * Interface for alert delivery channels.
 * Implement this to add custom delivery mechanisms.
 */
export interface AlertChannel {
    readonly kind: AlertChannelKind;
    deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}
/**
 * Error budget degradation result.
 */
export interface ErrorBudgetDegradationResult {
    degraded: boolean;
    sloId: string;
    sloStatus: SloStatus;
    rolloutFrozen: boolean;
    alertFired: boolean;
    alertId: string | null;
}
/**
 * Log-based alert channel that stores alerts in memory.
 * Useful for testing and development.
 */
export declare class LogAlertChannel implements AlertChannel {
    readonly kind: AlertChannelKind;
    private readonly deliveredEvents;
    deliver(event: AlertEvent): AlertDeliveryResult;
    getDelivered(): AlertEvent[];
}
type FetchLike = typeof fetch;
/**
 * Options for WebhookAlertChannel.
 */
export interface WebhookAlertChannelOptions {
    fetchImpl?: FetchLike;
    defaultHeaders?: Record<string, string>;
    timeoutMs?: number;
}
/**
 * Webhook-based alert channel that POSTs alerts to a configurable URL.
 * Supports custom headers and configurable timeout.
 */
export declare class WebhookAlertChannel implements AlertChannel {
    readonly kind: AlertChannelKind;
    private readonly fetchImpl;
    private readonly defaultHeaders;
    private readonly timeoutMs;
    constructor(options?: WebhookAlertChannelOptions);
    deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}
export interface SlackAlertChannelOptions {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
}
export declare class SlackAlertChannel implements AlertChannel {
    readonly kind: AlertChannelKind;
    private readonly fetchImpl;
    private readonly timeoutMs;
    constructor(options?: SlackAlertChannelOptions);
    deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}
export interface PagerDutyAlertChannelOptions {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    endpoint?: string;
}
export declare class PagerDutyAlertChannel implements AlertChannel {
    readonly kind: AlertChannelKind;
    private readonly fetchImpl;
    private readonly timeoutMs;
    private readonly pagerdutyEndpoint;
    constructor(options?: PagerDutyAlertChannelOptions);
    deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}
export interface OpsGenieAlertChannelOptions {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    endpoint?: string;
}
export declare class OpsGenieAlertChannel implements AlertChannel {
    readonly kind: AlertChannelKind;
    private readonly fetchImpl;
    private readonly timeoutMs;
    private readonly endpoint;
    constructor(options?: OpsGenieAlertChannelOptions);
    deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult;
}
export declare class EmailAlertChannel implements AlertChannel {
    readonly kind: AlertChannelKind;
    private readonly deliveredEvents;
    deliver(event: AlertEvent): AlertDeliveryResult;
    getDelivered(): AlertEvent[];
}
/**
 * Options for creating SloAlertingService.
 */
export interface SloAlertingServiceOptions {
    channels?: Partial<Record<AlertChannelKind, AlertChannel>>;
}
/**
 * SloAlertingService manages SLOs, SLIs, alert rules, alert events, and runbooks.
 * It provides a complete alerting pipeline from measurement collection through
 * alert firing to runbook execution.
 *
 * Internally uses AlertDispatcher for alert event persistence and delivery.
 */
export declare class SloAlertingService {
    private readonly db;
    private readonly dispatcher;
    private readonly alertRuleShadow;
    private readonly alertEventShadow;
    constructor(db: AuthoritativeSqlDatabase, options?: SloAlertingServiceOptions);
    /**
     * Creates a new SLO definition with the specified parameters.
     */
    defineSlo(input: Omit<SloDefinition, "id" | "status" | "createdAt" | "updatedAt">): SloDefinition;
    /**
     * Retrieves an SLO definition by ID.
     */
    getSlo(sloId: string): SloDefinition | null;
    /**
     * Lists all SLO definitions ordered by name.
     */
    listSlos(): SloDefinition[];
    /**
     * Collects a new SLI sample for an SLO.
     * This is the primary method for reporting metric measurements.
     */
    collectSli(sloId: string, value: number, unit?: string, metadata?: Record<string, unknown>): SliRecord;
    /**
     * Retrieves SLI samples for an SLO within a time window.
     */
    listSliSamples(sloId: string, limit?: number): SliRecord[];
    /**
     * Evaluates an SLO against recent SLI samples.
     * Computes the average value within the SLO window and compares against the target.
     * Returns the SLO status: met, at_risk, breached, or unknown.
     */
    evaluateSlo(sloId: string): SloStatus;
    /**
     * Creates a new alert rule.
     */
    defineAlertRule(input: Omit<AlertRule, "id" | "createdAt">): AlertRule;
    /**
     * Lists all alert rules ordered by creation time.
     */
    listAlertRules(): AlertRule[];
    /**
     * Fires an alert for a rule, creating an alert event and attempting delivery.
     */
    fireAlert(ruleId: string, title: string, detail: string): AlertEvent;
    /**
     * Acknowledges a firing alert, indicating an operator is working on it.
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean;
    /**
     * Resolves a firing or acknowledged alert.
     */
    resolveAlert(alertId: string): boolean;
    /**
     * Lists alert events with optional status filtering.
     */
    listAlertEvents(status?: AlertStatus, limit?: number): AlertEvent[];
    private mergeAlertRules;
    private mergeAlertEvents;
    /**
     * Creates a new runbook definition.
     */
    defineRunbook(input: Omit<RunbookDefinition, "id" | "createdAt">): RunbookDefinition;
    /**
     * Executes a runbook and records the execution.
     */
    executeRunbook(runbookId: string, alertEventId: string | null, executedBy: string): RunbookExecution;
    /**
     * Lists runbook executions for a runbook.
     */
    listRunbookExecutions(runbookId: string, limit?: number): RunbookExecution[];
    /**
     * Returns a summary of current alerting state.
     */
    summary(): {
        sloCount: number;
        breachedCount: number;
        firingAlertCount: number;
        runbookExecutionCount: number;
    };
    /**
     * Maps a database row to an SloDefinition.
     */
    private mapSlo;
    /**
     * Maps a database row to an SliRecord.
     */
    private mapSli;
    /**
     * Maps a database row to an AlertRule.
     */
    private mapAlertRule;
    /**
     * Maps a database row to an AlertEvent.
     */
    private mapAlertEvent;
    /**
     * Maps a database row to a RunbookExecution.
     */
    private mapRunbookExecution;
    /**
     * Checks if rollouts are currently frozen due to error budget exhaustion.
     */
    isRolloutFrozen(): boolean;
    /**
     * Gets the timestamp when rollouts were frozen due to error budget, if applicable.
     */
    getRolloutFrozenAt(): string | null;
    /**
     * Gets the SLO ID that triggered the rollout freeze, if applicable.
     */
    getFrozenBySloId(): string | null;
    /**
     * Manually unfreezes rollouts after error budget has been restored.
     * Should be called after the SLO recovers and manual approval is given.
     */
    unfreezeRollouts(): void;
    /**
     * Computes the burn rate for an SLO over a given time window.
     *
     * Burn rate = (actual error budget consumed) / (expected error budget consumed over time)
     * A burn rate > 1 indicates the error budget is being consumed faster than expected.
     *
     * @param sloId - The SLO ID to compute burn rate for
     * @param windowMs - Time window in milliseconds to evaluate
     * @returns Burn rate (1.0 = at budget pace, >1 = burning faster than expected, <1 = burning slower)
     */
    computeBurnRate(sloId: string, windowMs: number): number;
    /**
     * Triggers error budget auto-degradation for an SLO.
     *
     * If the SLO is breached (error budget exhausted):
     * 1. Sets rollout freeze flag
     * 2. Fires a page-level alert to on-call
     *
     * Returns the degradation result including whether rollout was frozen and alert was fired.
     */
    triggerErrorBudgetDegradation(sloId: string): ErrorBudgetDegradationResult;
    /**
     * Fires an alert specifically to PagerDuty for critical/error budget exhaustion.
     * Falls back to log channel if PagerDuty is not configured.
     */
    private fireAlertToPagerDuty;
    /**
     * Fires an alert with explicit channel specification.
     */
    private fireAlertWithChannel;
}
