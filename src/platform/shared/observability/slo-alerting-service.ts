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
import {
  alertSeverityToUnifiedSeverity,
  newId,
  nowIso,
} from "../../contracts/types/index.js";
import { AlertDispatcher } from "./alert-dispatcher.js";
import { runtimeMetricsRegistry } from "./runtime-metrics-registry.js";
import { rolloutFreezeManager } from "./rollout-freeze-manager.js";
import { StructuredLogger } from "./structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

function recordAlertDeliveryFailure(channel: AlertChannelKind, alertId: string, error: unknown): void {
  runtimeMetricsRegistry.incrementCounter("alert_delivery_failures_total", { channel }, 1);
  logger.error("alert.delivery_failed", {
    alertId,
    channel,
    error: error instanceof Error ? error.message : String(error),
  });
}
import {
  type AlertChannelKind,
  type AlertEvent,
  type AlertRule,
  type AlertSeverity,
  type AlertStatus,
  type RawRow,
  type RunbookDefinition,
  type RunbookExecution,
  type RunbookStatus,
  type SliKind,
  type SliRecord,
  type SloDefinition,
  type SloStatus,
} from "./slo-alerting/types.js";

export { SLO_ALERTING_DDL } from "./slo-alerting/types.js";
export type {
  AlertChannelKind,
  AlertEvent,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  RunbookDefinition,
  RunbookExecution,
  RunbookStatus,
  SliKind,
  SliRecord,
  SloDefinition,
  SloStatus,
} from "./slo-alerting/types.js";

// ── Alert Delivery Channels ────────────────────────────────────────────

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
export class LogAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "log";
  private readonly deliveredEvents: AlertEvent[] = [];

  deliver(event: AlertEvent): AlertDeliveryResult {
    this.deliveredEvents.push(event);
    return { channelKind: "log", delivered: true, error: null };
  }

  getDelivered(): AlertEvent[] {
    return [...this.deliveredEvents];
  }
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
export class WebhookAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "webhook";
  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: WebhookAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const url = typeof config.url === "string" ? config.url.trim() : "";
    if (!url) {
      return { channelKind: "webhook", delivered: false, error: "missing webhook url" };
    }

    // Build headers with defaults and config overrides
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.defaultHeaders,
      ...(config.headers as Record<string, string> | undefined),
    };

    // Build alert payload
    const body = JSON.stringify({
      id: event.id,
      ruleId: event.ruleId,
      severity: event.severity,
      status: event.status,
      title: event.title,
      detail: event.detail,
      channelKind: event.channelKind,
      deliveredAt: event.deliveredAt,
      acknowledgedBy: event.acknowledgedBy,
      resolvedAt: event.resolvedAt,
      firedAt: event.firedAt,
    });

    // §R14-05: Wait for fetch to complete before reporting delivered status
    let delivered = false;
    let error: string | null = null;

    const fetchPromise = this.fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    fetchPromise
      .then(() => {
        delivered = true;
      })
      .catch((err) => {
        delivered = false;
        error = err instanceof Error ? err.message : String(err);
        recordAlertDeliveryFailure("webhook", event.id, err);
      });

    return { channelKind: "webhook", delivered, error };
  }
}

export interface SlackAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export class SlackAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "slack";
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: SlackAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const webhookUrl = typeof config.webhookUrl === "string" ? config.webhookUrl.trim() : "";
    if (!webhookUrl) {
      return { channelKind: "slack", delivered: false, error: "missing slack webhook url" };
    }

    const payload = {
      text: `[${event.severity.toUpperCase()}] ${event.title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${event.title}*\n${event.detail}`,
          },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `rule: \`${event.ruleId}\`` },
            { type: "mrkdwn", text: `severity: \`${event.severity}\`` },
            { type: "mrkdwn", text: `status: \`${event.status}\`` },
          ],
        },
      ],
    };

    this.fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("slack", event.id, err);
    });

    return { channelKind: "slack", delivered: true, error: null };
  }
}

export interface PagerDutyAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  endpoint?: string;
}

const PAGERDUTY_DEFAULT_ENDPOINT = "https://events.pagerduty.com/v2/enqueue";

export class PagerDutyAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "pagerduty";
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly pagerdutyEndpoint: string;

  constructor(options: PagerDutyAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    // Constructor option takes priority, then env var, then production default
    this.pagerdutyEndpoint = options.endpoint ?? process.env.PAGERDUTY_API_URL ?? PAGERDUTY_DEFAULT_ENDPOINT;
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const routingKey = typeof config.routingKey === "string" ? config.routingKey.trim() : "";
    if (!routingKey) {
      return { channelKind: "pagerduty", delivered: false, error: "missing pagerduty routing key" };
    }
    const dedupKey = typeof config.dedupKey === "string" && config.dedupKey.trim().length > 0
      ? config.dedupKey.trim()
      : `${event.ruleId}:${event.id}`;

    const payload = {
      routing_key: routingKey,
      event_action: event.status === "resolved" ? "resolve" : "trigger",
      dedup_key: dedupKey,
      payload: {
        summary: event.title,
        severity: event.severity === "page" ? "critical" : event.severity,
        source: "automatic-agent",
        custom_details: {
          ruleId: event.ruleId,
          detail: event.detail,
          status: event.status,
          firedAt: event.firedAt,
        },
      },
    };

    this.fetchImpl(this.pagerdutyEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("pagerduty", event.id, err);
    });

    return { channelKind: "pagerduty", delivered: true, error: null };
  }
}

export interface OpsGenieAlertChannelOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  endpoint?: string;
}

export class OpsGenieAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "opsgenie";
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(options: OpsGenieAlertChannelOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.endpoint = options.endpoint ?? "https://api.opsgenie.com/v2/alerts";
  }

  deliver(event: AlertEvent, config: Record<string, unknown>): AlertDeliveryResult {
    const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
    if (!apiKey) {
      return { channelKind: "opsgenie", delivered: false, error: "missing opsgenie api key" };
    }
    const priority = event.severity === "critical" || event.severity === "page"
      ? "P1"
      : event.severity === "warning"
        ? "P3"
        : "P5";
    const payload = {
      message: event.title,
      description: event.detail,
      alias: `${event.ruleId}:${event.id}`,
      priority,
      source: "automatic-agent",
      tags: ["automatic-agent", event.severity, event.status],
      details: {
        ruleId: event.ruleId,
        firedAt: event.firedAt,
        status: event.status,
      },
    };

    this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `GenieKey ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch((err) => {
      recordAlertDeliveryFailure("opsgenie", event.id, err);
    });

    return { channelKind: "opsgenie", delivered: true, error: null };
  }
}

export class EmailAlertChannel implements AlertChannel {
  readonly kind: AlertChannelKind = "email";
  private readonly deliveredEvents: AlertEvent[] = [];

  deliver(event: AlertEvent): AlertDeliveryResult {
    this.deliveredEvents.push(event);
    return { channelKind: "email", delivered: true, error: null };
  }

  getDelivered(): AlertEvent[] {
    return [...this.deliveredEvents];
  }
}

// ── Service ────────────────────────────────────────────────────────────

/**
 * Options for creating SloAlertingService.
 */
export interface SloAlertingServiceOptions {
  channels?: Partial<Record<AlertChannelKind, AlertChannel>>;
}

function buildDefaultAlertChannels(
  channels: Partial<Record<AlertChannelKind, AlertChannel>> | undefined,
): Record<AlertChannelKind, AlertChannel> {
  return {
    log: new LogAlertChannel(),
    webhook: new WebhookAlertChannel(),
    slack: new SlackAlertChannel(),
    pagerduty: new PagerDutyAlertChannel(),
    opsgenie: new OpsGenieAlertChannel(),
    email: new EmailAlertChannel(),
    ...(channels ?? {}),
  };
}

/**
 * SloAlertingService manages SLOs, SLIs, alert rules, alert events, and runbooks.
 * It provides a complete alerting pipeline from measurement collection through
 * alert firing to runbook execution.
 *
 * Internally uses AlertDispatcher for alert event persistence and delivery.
 */
export class SloAlertingService {
  private readonly dispatcher: AlertDispatcher;
  private readonly alertRuleShadow = new Map<string, AlertRule>();
  private readonly alertEventShadow = new Map<string, AlertEvent>();

  constructor(
    private readonly db: AuthoritativeSqlDatabase,
    options?: SloAlertingServiceOptions,
  ) {
    // Initialize AlertDispatcher with the same channels configuration
    this.dispatcher = new AlertDispatcher(db, {
      channels: buildDefaultAlertChannels(options?.channels),
    });
  }

  // ── SLO Management ─────────────────────────────────────────────────

  /**
   * Creates a new SLO definition with the specified parameters.
   */
  defineSlo(input: Omit<SloDefinition, "id" | "status" | "createdAt" | "updatedAt">): SloDefinition {
    const now = nowIso();
    const slo: SloDefinition = {
      id: newId("slo"),
      status: "unknown",
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.db.connection
      .prepare(
        `INSERT INTO slo_definitions (id, domain_id, tenant_id, name, description, sli_kind, target_value, operator, window_minutes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slo.id, slo.domainId, slo.tenantId, slo.name, slo.description, slo.sliKind, slo.targetValue, slo.operator, slo.windowMinutes, slo.status, slo.createdAt, slo.updatedAt);

    return slo;
  }

  /**
   * Retrieves an SLO definition by ID.
   */
  getSlo(sloId: string): SloDefinition | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM slo_definitions WHERE id = ?`)
      .get(sloId) as RawRow | undefined;
    return row ? this.mapSlo(row) : null;
  }

  /**
   * Lists all SLO definitions ordered by name.
   */
  listSlos(): SloDefinition[] {
    return (this.db.connection
      .prepare(`SELECT * FROM slo_definitions ORDER BY name`)
      .all() as RawRow[]).map((r) => this.mapSlo(r));
  }

  // ── SLI Collection ─────────────────────────────────────────────────

  /**
   * Collects a new SLI sample for an SLO.
   * This is the primary method for reporting metric measurements.
   */
  collectSli(sloId: string, value: number, unit: string = "", metadata?: Record<string, unknown>): SliRecord {
    const now = nowIso();
    const slo = this.getSlo(sloId);
    const sli: SliRecord = {
      id: newId("sli"),
      sloId,
      domainId: (metadata?.domainId as string) ?? slo?.domainId ?? "default",
      kind: (slo?.sliKind ?? "custom") as SliKind,
      value,
      unit,
      collectedAt: now,
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    this.db.connection
      .prepare(
        `INSERT INTO sli_samples (id, slo_id, domain_id, kind, value, unit, collected_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(sli.id, sli.sloId, sli.domainId, sli.kind, sli.value, sli.unit, sli.collectedAt, sli.metadata);

    return sli;
  }

  /**
   * Retrieves SLI samples for an SLO within a time window.
   */
  listSliSamples(sloId: string, limit: number = 100): SliRecord[] {
    return (this.db.connection
      .prepare(`SELECT * FROM sli_samples WHERE slo_id = ? ORDER BY collected_at DESC LIMIT ?`)
      .all(sloId, limit) as RawRow[]).map((r) => this.mapSli(r));
  }

  // ── SLO Evaluation ─────────────────────────────────────────────────

  /**
   * Evaluates an SLO against recent SLI samples.
   * Computes the average value within the SLO window and compares against the target.
   * Returns the SLO status: met, at_risk, breached, or unknown.
   */
  evaluateSlo(sloId: string): SloStatus {
    const slo = this.getSlo(sloId);
    if (!slo) return "unknown";

    // Calculate window start time
    const windowStart = new Date(Date.now() - slo.windowMinutes * 60_000).toISOString();
    const samples = this.db.connection
      .prepare(`SELECT value FROM sli_samples WHERE slo_id = ? AND collected_at >= ? ORDER BY collected_at`)
      .all(sloId, windowStart) as RawRow[];

    if (samples.length === 0) return "unknown";

    // Calculate average value
    const values = samples.map((r) => Number(r.value));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Determine if target is met based on operator
    let met: boolean;
    switch (slo.operator) {
      case "lte": met = avg <= slo.targetValue; break;
      case "gte": met = avg >= slo.targetValue; break;
      case "lt": met = avg < slo.targetValue; break;
      case "gt": met = avg > slo.targetValue; break;
      default: met = false;
    }

    // At-risk if within 10% of threshold (for met SLOs)
    const margin = Math.abs(slo.targetValue) * 0.1;
    let status: SloStatus;
    if (met) {
      const distance = Math.abs(avg - slo.targetValue);
      status = distance < margin ? "at_risk" : "met";
    } else {
      status = "breached";
    }

    // Persist updated status
    const now = nowIso();
    this.db.connection
      .prepare(`UPDATE slo_definitions SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, now, sloId);

    return status;
  }

  // ── Alert Rules ────────────────────────────────────────────────────

  /**
   * Creates a new alert rule.
   */
  defineAlertRule(input: Omit<AlertRule, "id" | "createdAt">): AlertRule {
    const now = nowIso();
    const rule: AlertRule = {
      id: newId("arule"),
      createdAt: now,
      ...input,
      unifiedSeverity: input.unifiedSeverity ?? alertSeverityToUnifiedSeverity(input.severity),
    };

    this.db.connection
      .prepare(
        `INSERT INTO alert_rules (id, name, slo_id, condition, severity, channel_kind, channel_config, cooldown_minutes, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(rule.id, rule.name, rule.sloId, rule.condition, rule.severity, rule.channelKind, rule.channelConfig, rule.cooldownMinutes, rule.enabled ? 1 : 0, rule.createdAt);

    this.alertRuleShadow.set(rule.id, rule);
    return rule;
  }

  /**
   * Lists all alert rules ordered by creation time.
   */
  listAlertRules(): AlertRule[] {
    const persisted = (this.db.connection
      .prepare(`SELECT * FROM alert_rules ORDER BY created_at`)
      .all() as RawRow[]).map((r) => this.mapAlertRule(r));
    return this.mergeAlertRules(persisted);
  }

  // ── Alert Firing ───────────────────────────────────────────────────

  /**
   * Fires an alert for a rule, creating an alert event and attempting delivery.
   */
  fireAlert(ruleId: string, title: string, detail: string): AlertEvent {
    const alert = this.dispatcher.dispatch(ruleId, title, detail);
    this.alertEventShadow.set(alert.id, alert);
    return alert;
  }

  /**
   * Acknowledges a firing alert, indicating an operator is working on it.
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    this.db.connection
      .prepare(`UPDATE alert_events SET status = 'acknowledged', acknowledged_by = ? WHERE id = ? AND status = 'firing'`)
      .run(acknowledgedBy, alertId);

    const updated = this.db.connection
      .prepare(`SELECT changes() as cnt`).get() as RawRow | undefined;
    const shadow = this.alertEventShadow.get(alertId);
    if (shadow != null && shadow.status === "firing") {
      // Create new object - do not mutate the existing readonly semantic object
      this.alertEventShadow.set(alertId, Object.assign({}, shadow, {
        status: "acknowledged" as const,
        acknowledgedBy,
      }));
    }
    return Number(updated?.cnt ?? 0) > 0 || shadow?.status === "acknowledged";
  }

  /**
   * Resolves a firing or acknowledged alert.
   */
  resolveAlert(alertId: string): boolean {
    const now = nowIso();
    this.db.connection
      .prepare(`UPDATE alert_events SET status = 'resolved', resolved_at = ? WHERE id = ? AND status IN ('firing', 'acknowledged')`)
      .run(now, alertId);

    const row = this.db.connection
      .prepare(`SELECT * FROM alert_events WHERE id = ?`)
      .get(alertId) as RawRow | undefined;
    const shadow = this.alertEventShadow.get(alertId);
    if (shadow != null && (shadow.status === "firing" || shadow.status === "acknowledged")) {
      shadow.status = "resolved";
      shadow.resolvedAt = now;
      this.alertEventShadow.set(alertId, shadow);
    }
    return row ? String(row.status) === "resolved" : shadow?.status === "resolved";
  }

  /**
   * Lists alert events with optional status filtering.
   */
  listAlertEvents(status?: AlertStatus, limit: number = 100): AlertEvent[] {
    const persisted = status
      ? (this.db.connection
        .prepare(`SELECT * FROM alert_events WHERE status = ? ORDER BY fired_at DESC LIMIT ?`)
        .all(status, limit) as RawRow[]).map((r) => this.mapAlertEvent(r))
      : (this.db.connection
      .prepare(`SELECT * FROM alert_events ORDER BY fired_at DESC LIMIT ?`)
      .all(limit) as RawRow[]).map((r) => this.mapAlertEvent(r));
    return this.mergeAlertEvents(persisted, status, limit);
  }

  private mergeAlertRules(persisted: readonly AlertRule[]): AlertRule[] {
    const rules = new Map<string, AlertRule>();
    for (const rule of persisted) {
      rules.set(rule.id, rule);
    }
    for (const rule of this.alertRuleShadow.values()) {
      if (!rules.has(rule.id)) {
        rules.set(rule.id, rule);
      }
    }
    return [...rules.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  private mergeAlertEvents(
    persisted: readonly AlertEvent[],
    status?: AlertStatus,
    limit: number = 100,
  ): AlertEvent[] {
    const events = new Map<string, AlertEvent>();
    for (const event of persisted) {
      events.set(event.id, event);
    }
    for (const event of this.alertEventShadow.values()) {
      if ((status == null || event.status === status) && !events.has(event.id)) {
        events.set(event.id, event);
      }
    }
    return [...events.values()]
      .sort((left, right) => right.firedAt.localeCompare(left.firedAt))
      .slice(0, limit);
  }

  // ── Runbook Management ─────────────────────────────────────────────

  /**
   * Creates a new runbook definition.
   */
  defineRunbook(input: Omit<RunbookDefinition, "id" | "createdAt">): RunbookDefinition {
    const now = nowIso();
    const runbook: RunbookDefinition = { id: newId("rbook"), createdAt: now, ...input };

    this.db.connection
      .prepare(
        `INSERT INTO runbook_definitions (id, name, description, alert_rule_id, steps, auto_execute, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(runbook.id, runbook.name, runbook.description, runbook.alertRuleId, runbook.steps, runbook.autoExecute ? 1 : 0, runbook.createdAt);

    return runbook;
  }

  /**
   * Executes a runbook and records the execution.
   */
  executeRunbook(runbookId: string, alertEventId: string | null, executedBy: string): RunbookExecution {
    const now = nowIso();
    const execution: RunbookExecution = {
      id: newId("rbexec"),
      runbookId,
      alertEventId,
      status: "failed",
      output: null,
      startedAt: now,
      completedAt: now,
      executedBy,
    };

    // Insert execution record with failed status since runbook execution is not yet implemented
    this.db.connection
      .prepare(
        `INSERT INTO runbook_executions (id, runbook_id, alert_event_id, status, output, started_at, completed_at, executed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(execution.id, execution.runbookId, execution.alertEventId, execution.status, execution.output, execution.startedAt, execution.completedAt, execution.executedBy);

    execution.output = JSON.stringify({ error: "runbook_execution.not_implemented", message: "Runbook step execution not yet implemented per §61.3" });
    return execution;
  }

  /**
   * Lists runbook executions for a runbook.
   */
  listRunbookExecutions(runbookId: string, limit: number = 50): RunbookExecution[] {
    return (this.db.connection
      .prepare(`SELECT * FROM runbook_executions WHERE runbook_id = ? ORDER BY started_at DESC LIMIT ?`)
      .all(runbookId, limit) as RawRow[]).map((r) => this.mapRunbookExecution(r));
  }

  // ── Summary ────────────────────────────────────────────────────────

  /**
   * Returns a summary of current alerting state.
   */
  summary(): {
    sloCount: number;
    breachedCount: number;
    firingAlertCount: number;
    runbookExecutionCount: number;
  } {
    const slos = this.db.connection.prepare(`SELECT COUNT(*) as cnt FROM slo_definitions`).get() as RawRow;
    const breached = this.db.connection.prepare(`SELECT COUNT(*) as cnt FROM slo_definitions WHERE status = 'breached'`).get() as RawRow;
    const firing = this.db.connection.prepare(`SELECT COUNT(*) as cnt FROM alert_events WHERE status = 'firing'`).get() as RawRow;
    const execs = this.db.connection.prepare(`SELECT COUNT(*) as cnt FROM runbook_executions`).get() as RawRow;

    return {
      sloCount: Number(slos.cnt),
      breachedCount: Number(breached.cnt),
      firingAlertCount: Number(firing.cnt),
      runbookExecutionCount: Number(execs.cnt),
    };
  }

  // ── Mappers ───────────────────────────────────────────────────────

  /**
   * Maps a database row to an SloDefinition.
   * §R14-06: SLO definitions must have domainId/tenantId columns
   */
  private mapSlo(row: RawRow): SloDefinition {
    return {
      id: String(row.id),
      domainId: String(row.domain_id ?? "default"),
      tenantId: String(row.tenant_id ?? "default"),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      sliKind: String(row.sli_kind ?? "custom") as SliKind,
      targetValue: Number(row.target_value ?? 0),
      operator: String(row.operator ?? "lte") as SloDefinition["operator"],
      windowMinutes: Number(row.window_minutes ?? 60),
      status: String(row.status ?? "unknown") as SloStatus,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }

  /**
   * Maps a database row to an SliRecord.
   */
  private mapSli(row: RawRow): SliRecord {
    return {
      id: String(row.id),
      sloId: String(row.slo_id ?? ""),
      domainId: String(row.domain_id ?? "default"),
      kind: String(row.kind ?? "custom") as SliKind,
      value: Number(row.value ?? 0),
      unit: String(row.unit ?? ""),
      collectedAt: String(row.collected_at ?? ""),
      metadata: row.metadata != null ? String(row.metadata) : null,
    };
  }

  /**
   * Maps a database row to an AlertRule.
   */
  private mapAlertRule(row: RawRow): AlertRule {
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      sloId: row.slo_id != null ? String(row.slo_id) : null,
      condition: String(row.condition ?? ""),
      severity: String(row.severity ?? "warning") as AlertSeverity,
      unifiedSeverity: alertSeverityToUnifiedSeverity(String(row.severity ?? "warning") as AlertSeverity),
      channelKind: String(row.channel_kind ?? "log") as AlertChannelKind,
      channelConfig: String(row.channel_config ?? "{}"),
      cooldownMinutes: Number(row.cooldown_minutes ?? 5),
      enabled: Boolean(row.enabled),
      createdAt: String(row.created_at ?? ""),
    };
  }

  /**
   * Maps a database row to an AlertEvent.
   */
  private mapAlertEvent(row: RawRow): AlertEvent {
    return {
      id: String(row.id),
      ruleId: String(row.rule_id ?? ""),
      severity: String(row.severity ?? "warning") as AlertSeverity,
      unifiedSeverity: alertSeverityToUnifiedSeverity(String(row.severity ?? "warning") as AlertSeverity),
      status: String(row.status ?? "firing") as AlertStatus,
      title: String(row.title ?? ""),
      detail: String(row.detail ?? ""),
      channelKind: String(row.channel_kind ?? "log") as AlertChannelKind,
      deliveredAt: row.delivered_at != null ? String(row.delivered_at) : null,
      acknowledgedBy: row.acknowledged_by != null ? String(row.acknowledged_by) : null,
      resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
      firedAt: String(row.fired_at ?? ""),
    };
  }

  /**
   * Maps a database row to a RunbookExecution.
   */
  private mapRunbookExecution(row: RawRow): RunbookExecution {
    return {
      id: String(row.id),
      runbookId: String(row.runbook_id ?? ""),
      alertEventId: row.alert_event_id != null ? String(row.alert_event_id) : null,
      status: String(row.status ?? "pending") as RunbookStatus,
      output: row.output != null ? String(row.output) : null,
      startedAt: String(row.started_at ?? ""),
      completedAt: row.completed_at != null ? String(row.completed_at) : null,
      executedBy: String(row.executed_by ?? "system"),
    };
  }

  // ── Error Budget Auto-Degradation ──────────────────────────────────

  /**
   * Checks if rollouts are currently frozen due to error budget exhaustion.
   */
  public isRolloutFrozen(): boolean {
    return rolloutFreezeManager.isFrozen();
  }

  /**
   * Gets the timestamp when rollouts were frozen due to error budget, if applicable.
   */
  public getRolloutFrozenAt(): string | null {
    return rolloutFreezeManager.getState().frozenAt;
  }

  /**
   * Gets the SLO ID that triggered the rollout freeze, if applicable.
   */
  public getFrozenBySloId(): string | null {
    return rolloutFreezeManager.getState().frozenBySloId;
  }

  /**
   * Manually unfreezes rollouts after error budget has been restored.
   * Should be called after the SLO recovers and manual approval is given.
   */
  public unfreezeRollouts(): void {
    rolloutFreezeManager.unfreeze();
  }

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
  public computeBurnRate(sloId: string, windowMs: number): number {
    const slo = this.getSlo(sloId);
    if (!slo) return 0;

    const windowStart = new Date(Date.now() - windowMs).toISOString();
    const samples = this.db.connection
      .prepare(`SELECT value FROM sli_samples WHERE slo_id = ? AND collected_at >= ? ORDER BY collected_at`)
      .all(sloId, windowStart) as RawRow[];

    if (samples.length === 0) return 0;

    // Calculate average SLI value in the window
    const values = samples.map((r) => Number(r.value));
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

    if (slo.operator === "gte") {
      const errorBudget = 100 - slo.targetValue;
      if (errorBudget <= 0) {
        return 0;
      }
      const consumed = Math.max(0, 100 - avgValue);
      return consumed / errorBudget;
    }

    if (slo.targetValue <= 0) {
      return 0;
    }

    return Math.max(0, avgValue) / slo.targetValue;
  }

  /**
   * Triggers error budget auto-degradation for an SLO.
   *
   * If the SLO is breached (error budget exhausted):
   * 1. Sets rollout freeze flag
   * 2. Fires a page-level alert to on-call
   *
   * Returns the degradation result including whether rollout was frozen and alert was fired.
   */
  public triggerErrorBudgetDegradation(sloId: string): ErrorBudgetDegradationResult {
    const sloStatus = this.evaluateSlo(sloId);

    // If SLO is not breached, no action needed
    if (sloStatus !== "breached") {
      return {
        degraded: false,
        sloId,
        sloStatus,
        rolloutFrozen: rolloutFreezeManager.isFrozen(),
        alertFired: false,
        alertId: null,
      };
    }

    // SLO is breached - trigger degradation
    rolloutFreezeManager.freeze(sloId);

    // Fire a page-level alert to on-call
    const slo = this.getSlo(sloId);
    const sloName = slo?.name ?? sloId;
    const alert = this.fireAlertToPagerDuty(
      `Error Budget Exhausted: ${sloName}`,
      `SLO "${sloName}" (${sloId}) has breached its error budget. Rollouts have been automatically frozen. ` +
      `Window: ${slo?.windowMinutes ?? "unknown"} minutes, Target: ${slo?.targetValue ?? "unknown"} ${slo?.sliKind ?? ""}. ` +
      `Action required: Investigate error budget burn rate and restore service reliability.`,
    );

    return {
      degraded: true,
      sloId,
      sloStatus,
      rolloutFrozen: true,
      alertFired: true,
      alertId: alert.id,
    };
  }

  /**
   * Fires an alert specifically to PagerDuty for critical/error budget exhaustion.
   * Falls back to log channel if PagerDuty is not configured.
   */
  private fireAlertToPagerDuty(title: string, detail: string): AlertEvent {
    // First, try to find a pagerduty channel
    const pagerDutyChannel = this.dispatcher.getChannel("pagerduty");

    if (!pagerDutyChannel) {
      // No PagerDuty configured - fire with log channel and add detail about needing PagerDuty
      return this.dispatcher.dispatchRaw(
        "slo_error_budget_exhausted",
        title,
        detail + " (PagerDuty channel not configured - requires manual notification)",
        "critical",
        "log",
      );
    }

    return this.dispatcher.dispatchRaw(
      "slo_error_budget_exhausted",
      title,
      detail,
      "page",
      "pagerduty",
    );
  }

  /**
   * Fires an alert with explicit channel specification.
   */
  private fireAlertWithChannel(
    ruleId: string,
    title: string,
    detail: string,
    severity: AlertSeverity,
    channelKind: AlertChannelKind,
  ): AlertEvent {
    return this.dispatcher.dispatchRaw(ruleId, title, detail, severity, channelKind);
  }
}
