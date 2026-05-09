import type { UnifiedSeverity } from "../../../contracts/types/index.js";

/**
 * Types of SLIs (Service Level Indicators) that can be measured.
 */
export type SliKind = "availability" | "latency_p95" | "latency_p99" | "error_rate" | "throughput" | "saturation" | "custom";

/**
 * Status of an SLO evaluation.
 */
export type SloStatus = "met" | "at_risk" | "breached" | "unknown";

/**
 * Alert severity levels.
 */
export type AlertSeverity = "info" | "warning" | "critical" | "page";

/**
 * Status of an alert event.
 */
export type AlertStatus = "firing" | "resolved" | "acknowledged" | "silenced";

/**
 * Available alert delivery channels.
 */
export type AlertChannelKind = "log" | "webhook" | "pagerduty" | "slack" | "opsgenie" | "email";

/**
 * Status of a runbook execution.
 */
export type RunbookStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/**
 * A single SLI measurement sample.
 */
export interface SliRecord {
  id: string;
  sloId: string;
  kind: SliKind;
  value: number;
  unit: string;
  collectedAt: string;
  metadata: string | null;
}

/**
 * Definition of an SLO with target and evaluation parameters.
 * §R14-06: SLO includes per-domain scope for multi-tenant/multi-service isolation.
 */
export interface SloDefinition {
  id: string;
  name: string;
  description: string;
  sliKind: SliKind;
  targetValue: number;
  operator: "lte" | "gte" | "lt" | "gt";
  windowMinutes: number;
  status: SloStatus;
  domain: string | null; // Per-domain scope for SLO isolation
  createdAt: string;
  updatedAt: string;
}

/**
 * An alert rule that triggers notifications when conditions are met.
 */
export interface AlertRule {
  id: string;
  name: string;
  sloId: string | null;
  condition: string;
  severity: AlertSeverity;
  unifiedSeverity?: UnifiedSeverity;
  channelKind: AlertChannelKind;
  channelConfig: string;
  cooldownMinutes: number;
  enabled: boolean;
  createdAt: string;
}

/**
 * A fired alert event with delivery status.
 */
export interface AlertEvent {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  unifiedSeverity?: UnifiedSeverity;
  status: AlertStatus;
  title: string;
  detail: string;
  channelKind: AlertChannelKind;
  deliveredAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  firedAt: string;
}

/**
 * Definition of a runbook (response procedure).
 */
export interface RunbookDefinition {
  id: string;
  name: string;
  description: string;
  alertRuleId: string | null;
  steps: string;
  autoExecute: boolean;
  createdAt: string;
}

/**
 * Record of a runbook execution.
 */
export interface RunbookExecution {
  id: string;
  runbookId: string;
  alertEventId: string | null;
  status: RunbookStatus;
  output: string | null;
  startedAt: string;
  completedAt: string | null;
  executedBy: string;
}

/**
 * SQLite DDL for SLO alerting tables.
 */
export const SLO_ALERTING_DDL = `
CREATE TABLE IF NOT EXISTS sli_samples (
  id TEXT PRIMARY KEY,
  slo_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  collected_at TEXT NOT NULL,
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_sli_samples_slo_collected ON sli_samples(slo_id, collected_at);

CREATE TABLE IF NOT EXISTS slo_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sli_kind TEXT NOT NULL,
  target_value REAL NOT NULL,
  operator TEXT NOT NULL DEFAULT 'lte',
  window_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'unknown',
  domain TEXT NULL,  -- Per-domain scope for SLO isolation (§R14-06)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slo_id TEXT NULL,
  condition TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'warning',
  channel_kind TEXT NOT NULL DEFAULT 'log',
  channel_config TEXT NOT NULL DEFAULT '{}',
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'firing',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  channel_kind TEXT NOT NULL DEFAULT 'log',
  delivered_at TEXT NULL,
  acknowledged_by TEXT NULL,
  resolved_at TEXT NULL,
  fired_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status, fired_at);

CREATE TABLE IF NOT EXISTS runbook_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  alert_rule_id TEXT NULL,
  steps TEXT NOT NULL DEFAULT '[]',
  auto_execute INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runbook_executions (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL,
  alert_event_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  output TEXT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NULL,
  executed_by TEXT NOT NULL DEFAULT 'system'
);
CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(runbook_id, started_at);
`;

export type RawRow = Record<string, unknown>;
