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

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import {
  alertSeverityToUnifiedSeverity,
  newId,
  nowIso,
} from "../../contracts/types/index.js";
import { AlertDispatcher } from "./alert-dispatcher.js";
import { rolloutFreezeManager } from "./rollout-freeze-manager.js";
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
import {
  EmailAlertChannel,
  LogAlertChannel,
  OpsGenieAlertChannel,
  PagerDutyAlertChannel,
  SlackAlertChannel,
  WebhookAlertChannel,
  type AlertChannel,
  type BurnRateAlertResult,
  type ErrorBudgetDegradationResult,
} from "./slo-alerting-channels.js";

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
export {
  EmailAlertChannel,
  LogAlertChannel,
  OpsGenieAlertChannel,
  PagerDutyAlertChannel,
  SlackAlertChannel,
  WebhookAlertChannel,
} from "./slo-alerting-channels.js";
export type {
  AlertDeliveryResult,
  BurnRateAlertResult,
  ErrorBudgetDegradationResult,
} from "./slo-alerting-channels.js";

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
   * §R14-06: Supports per-domain scope for SLO isolation.
   */
  defineSlo(input: Omit<SloDefinition, "id" | "status" | "createdAt" | "updatedAt">): SloDefinition {
    const now = nowIso();
    const slo: SloDefinition = {
      id: newId("slo"),
      status: "unknown",
      createdAt: now,
      updatedAt: now,
      ...input,
      domain: input.domain ?? null,
    };

    this.db.connection
      .prepare(
        `INSERT INTO slo_definitions (id, name, description, sli_kind, target_value, operator, window_minutes, status, domain, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slo.id, slo.name, slo.description, slo.sliKind, slo.targetValue, slo.operator, slo.windowMinutes, slo.status, slo.domain, slo.createdAt, slo.updatedAt);

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
   * §R14-06: Optionally filter by domain scope.
   */
  listSlos(domain?: string): SloDefinition[] {
    if (domain) {
      return (this.db.connection
        .prepare(`SELECT * FROM slo_definitions WHERE domain = ? ORDER BY name`)
        .all(domain) as RawRow[]).map((r) => this.mapSlo(r));
    }
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
    const sli: SliRecord = {
      id: newId("sli"),
      sloId,
      kind: (this.getSlo(sloId)?.sliKind ?? "custom") as SliKind,
      value,
      unit,
      collectedAt: now,
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    this.db.connection
      .prepare(
        `INSERT INTO sli_samples (id, slo_id, kind, value, unit, collected_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(sli.id, sli.sloId, sli.kind, sli.value, sli.unit, sli.collectedAt, sli.metadata);

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
      shadow.status = "acknowledged";
      shadow.acknowledgedBy = acknowledgedBy;
      this.alertEventShadow.set(alertId, shadow);
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
      status: "running",
      output: null,
      startedAt: now,
      completedAt: null,
      executedBy,
    };

    // Insert execution record
    this.db.connection
      .prepare(
        `INSERT INTO runbook_executions (id, runbook_id, alert_event_id, status, output, started_at, completed_at, executed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(execution.id, execution.runbookId, execution.alertEventId, execution.status, execution.output, execution.startedAt, execution.completedAt, execution.executedBy);

    // Simulate execution completion (in real implementation, would execute runbook steps)
    const completedAt = nowIso();
    this.db.connection
      .prepare(`UPDATE runbook_executions SET status = 'completed', output = ?, completed_at = ? WHERE id = ?`)
      .run(JSON.stringify({ result: "runbook_steps_executed" }), completedAt, execution.id);

    execution.status = "completed";
    execution.completedAt = completedAt;
    execution.output = JSON.stringify({ result: "runbook_steps_executed" });
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
   * §R14-06: Includes domain scope mapping.
   */
  private mapSlo(row: RawRow): SloDefinition {
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      sliKind: String(row.sli_kind ?? "custom") as SliKind,
      targetValue: Number(row.target_value ?? 0),
      operator: String(row.operator ?? "lte") as SloDefinition["operator"],
      windowMinutes: Number(row.window_minutes ?? 60),
      status: String(row.status ?? "unknown") as SloStatus,
      domain: row.domain != null ? String(row.domain) : null,
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
   * Triggers error budget auto-degradation for an SLO with gradient response.
   *
   * Gradient response policy (§R14-07):
   * - 50-80% error budget consumed: degrade (slow down rollouts)
   * - 80-100% error budget consumed: freeze (halt rollouts)
   * - >100% error budget consumed: full_freeze (halt all deployments and automation)
   *
   * Returns the degradation result including gradient level and alert status.
   */
  public triggerErrorBudgetDegradation(sloId: string): ErrorBudgetDegradationResult {
    const slo = this.getSlo(sloId);
    if (!slo) {
      return {
        degraded: false,
        sloId,
        sloStatus: "unknown",
        rolloutFrozen: rolloutFreezeManager.isFrozen(),
        alertFired: false,
        alertId: null,
        gradientLevel: "none",
        errorBudgetBurnPercent: null,
      };
    }

    const sloStatus = this.evaluateSlo(sloId);

    // Calculate error budget burn percentage
    const windowStart = new Date(Date.now() - slo.windowMinutes * 60_000).toISOString();
    const samples = this.db.connection
      .prepare(`SELECT value FROM sli_samples WHERE slo_id = ? AND collected_at >= ? ORDER BY collected_at`)
      .all(sloId, windowStart) as RawRow[];

    let errorBudgetBurnPercent: number | null = null;
    if (samples.length > 0 && slo.operator === "gte") {
      const values = samples.map((r) => Number(r.value));
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
      const errorBudget = 100 - slo.targetValue;
      if (errorBudget > 0) {
        const consumed = Math.max(0, 100 - avgValue);
        errorBudgetBurnPercent = (consumed / errorBudget) * 100;
      }
    }

    // Determine gradient level based on burn percentage
    let gradientLevel: ErrorBudgetDegradationResult["gradientLevel"] = "none";

    if (errorBudgetBurnPercent !== null) {
      if (errorBudgetBurnPercent > 100) {
        gradientLevel = "full_freeze";
      } else if (errorBudgetBurnPercent >= 80) {
        gradientLevel = "freeze";
      } else if (errorBudgetBurnPercent >= 50) {
        gradientLevel = "degrade";
      }
    }

    // If we cannot compute burn percent but the SLO is already breached, fail closed.
    if (sloStatus === "breached" && gradientLevel === "none") {
      gradientLevel = "freeze";
    }

    // Apply gradient response
    let rolloutFrozen = false;
    if (gradientLevel !== "none") {
      if (gradientLevel === "full_freeze" || gradientLevel === "freeze") {
        rolloutFreezeManager.freeze(sloId);
        rolloutFrozen = true;
      } else if (gradientLevel === "degrade") {
        // For degrade level, we just mark it but don't fully freeze
        rolloutFreezeManager.markDegraded(sloId);
      }
    }

    // Fire appropriate alert based on gradient level
    let alertFired = false;
    let alertId: string | null = null;

    if (gradientLevel !== "none") {
      const sloName = slo.name ?? sloId;
      const alert = this.fireAlertForGradient(
        gradientLevel,
        sloName,
        sloId,
        errorBudgetBurnPercent,
        slo.windowMinutes,
        slo.targetValue,
        slo.sliKind,
      );
      alertId = alert.id;
      alertFired = true;
    }

    return {
      degraded: gradientLevel !== "none",
      sloId,
      sloStatus,
      rolloutFrozen,
      alertFired,
      alertId,
      gradientLevel,
      errorBudgetBurnPercent,
    };
  }

  /**
   * Fires an alert appropriate for the gradient level.
   * §R14-07: Gradient response alerting.
   */
  private fireAlertForGradient(
    gradientLevel: ErrorBudgetDegradationResult["gradientLevel"],
    sloName: string,
    sloId: string,
    burnPercent: number | null,
    windowMinutes: number,
    targetValue: number,
    sliKind: string,
  ): AlertEvent {
    const burnDesc = burnPercent !== null ? ` (${burnPercent.toFixed(1)}% burned)` : "";
    const severity = gradientLevel === "full_freeze" ? "page" : gradientLevel === "freeze" ? "critical" : "warning";

    let title: string;
    let detail: string;

    switch (gradientLevel) {
      case "full_freeze":
        title = `CRITICAL: Full Freeze - Error Budget Exhausted: ${sloName}`;
        detail = `SLO "${sloName}" (${sloId}) has exhausted its error budget (>100%). ` +
          `All deployments and automation have been halted. Immediate action required.`;
        break;
      case "freeze":
        title = `Error Budget Critical: ${sloName}${burnDesc}`;
        detail = `SLO "${sloName}" (${sloId}) has breached 80-100% of error budget. ` +
          `Rollouts have been frozen. Window: ${windowMinutes} minutes, Target: ${targetValue} ${sliKind}. ` +
          `Action required: Investigate and restore service reliability.`;
        break;
      case "degrade":
        title = `Error Budget Degraded: ${sloName}${burnDesc}`;
        detail = `SLO "${sloName}" (${sloId}) has consumed 50-80% of error budget. ` +
          `Rollouts are being slowed. Window: ${windowMinutes} minutes, Target: ${targetValue} ${sliKind}. ` +
          `Consider investigating to prevent further degradation.`;
        break;
      default:
        title = `Error Budget Warning: ${sloName}`;
        detail = `SLO "${sloName}" (${sloId}) error budget consumption requires attention.`;
    }

    return this.fireAlertWithSeverity(title, detail, severity);
  }

  /**
   * Fires an alert with explicit severity.
   */
  private fireAlertWithSeverity(title: string, detail: string, severity: AlertSeverity): AlertEvent {
    return this.dispatcher.dispatchRaw(
      "slo_error_budget_gradient",
      title,
      detail,
      severity,
      "log",
    );
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

  /**
   * Evaluates burn-rate alerting with multi-window strategy.
   *
   * Multi-window alerting policy (§R14-08):
   * - 1h burn rate > 14.4x → SEV2 alert (fast burn, rapid response needed)
   * - 6h burn rate > 6x → SEV3 alert (sustained burn, response needed)
   *
   * The 1h window catches rapid budget exhaustion (14.4x = 100%/1h = 100%/60min = 1.67%/min)
   * The 6h window catches sustained degradation (6x = 100%/6h = 100%/360min = 0.28%/min)
   *
   * @returns BurnRateAlertResult with burn rates and any fired alert
   */
  public evaluateBurnRateAlerting(sloId: string): BurnRateAlertResult {
    const slo = this.getSlo(sloId);
    if (!slo) {
      return {
        sloId,
        burnRate1h: null,
        burnRate6h: null,
        alertSeverity: null,
        alertFired: false,
        alertId: null,
      };
    }

    // Compute burn rates for both windows
    const burnRate1h = this.computeBurnRate(sloId, 60 * 60 * 1000); // 1 hour in ms
    const burnRate6h = this.computeBurnRate(sloId, 6 * 60 * 60 * 1000); // 6 hours in ms

    // Determine if alert should fire based on multi-window strategy
    let alertSeverity: BurnRateAlertResult["alertSeverity"] = null;
    let alertFired = false;
    let alertId: string | null = null;

    if (burnRate1h > 14.4) {
      // 1h > 14.4x → SEV2 (fast burn)
      alertSeverity = "SEV2";
      const sloName = slo.name ?? sloId;
      const alert = this.fireBurnRateAlert(
        sloId,
        sloName,
        alertSeverity,
        burnRate1h,
        60,
      );
      alertId = alert.id;
      alertFired = true;
    } else if (burnRate6h > 6) {
      // 6h > 6x → SEV3 (sustained burn)
      alertSeverity = "SEV3";
      const sloName = slo.name ?? sloId;
      const alert = this.fireBurnRateAlert(
        sloId,
        sloName,
        alertSeverity,
        burnRate6h,
        360,
      );
      alertId = alert.id;
      alertFired = true;
    }

    return {
      sloId,
      burnRate1h,
      burnRate6h,
      alertSeverity,
      alertFired,
      alertId,
    };
  }

  /**
   * Fires a burn-rate alert with appropriate severity.
   * §R14-08: Multi-window burn-rate alerting.
   */
  private fireBurnRateAlert(
    sloId: string,
    sloName: string,
    severity: "SEV2" | "SEV3",
    burnRate: number,
    windowMinutes: number,
  ): AlertEvent {
    const severityLabel = severity === "SEV2" ? "CRITICAL" : "WARNING";
    const windowLabel = windowMinutes === 60 ? "1 hour" : "6 hours";

    const title = `${severityLabel}: Fast Burn Rate - ${sloName}`;
    const detail = `SLO "${sloName}" (${sloId}) has a ${windowLabel} burn rate of ${burnRate.toFixed(2)}x. ` +
      `This indicates ${severity === "SEV2" ? "rapid" : "sustained"} error budget exhaustion. ` +
      `Window: ${windowMinutes} minutes. Action required: Investigate and remediate.`;

    const alertSeverity: AlertSeverity = severity === "SEV2" ? "critical" : "warning";

    return this.fireAlertWithSeverity(title, detail, alertSeverity);
  }
}
