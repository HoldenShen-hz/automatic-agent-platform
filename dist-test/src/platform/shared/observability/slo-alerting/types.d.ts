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
export declare const SLO_ALERTING_DDL = "\nCREATE TABLE IF NOT EXISTS sli_samples (\n  id TEXT PRIMARY KEY,\n  slo_id TEXT NOT NULL,\n  kind TEXT NOT NULL,\n  value REAL NOT NULL,\n  unit TEXT NOT NULL DEFAULT '',\n  collected_at TEXT NOT NULL,\n  metadata TEXT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_sli_samples_slo_collected ON sli_samples(slo_id, collected_at);\n\nCREATE TABLE IF NOT EXISTS slo_definitions (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL UNIQUE,\n  description TEXT NOT NULL DEFAULT '',\n  sli_kind TEXT NOT NULL,\n  target_value REAL NOT NULL,\n  operator TEXT NOT NULL DEFAULT 'lte',\n  window_minutes INTEGER NOT NULL DEFAULT 60,\n  status TEXT NOT NULL DEFAULT 'unknown',\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS alert_rules (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  slo_id TEXT NULL,\n  condition TEXT NOT NULL DEFAULT '',\n  severity TEXT NOT NULL DEFAULT 'warning',\n  channel_kind TEXT NOT NULL DEFAULT 'log',\n  channel_config TEXT NOT NULL DEFAULT '{}',\n  cooldown_minutes INTEGER NOT NULL DEFAULT 5,\n  enabled INTEGER NOT NULL DEFAULT 1,\n  created_at TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS alert_events (\n  id TEXT PRIMARY KEY,\n  rule_id TEXT NOT NULL,\n  severity TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'firing',\n  title TEXT NOT NULL,\n  detail TEXT NOT NULL DEFAULT '',\n  channel_kind TEXT NOT NULL DEFAULT 'log',\n  delivered_at TEXT NULL,\n  acknowledged_by TEXT NULL,\n  resolved_at TEXT NULL,\n  fired_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status, fired_at);\n\nCREATE TABLE IF NOT EXISTS runbook_definitions (\n  id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  description TEXT NOT NULL DEFAULT '',\n  alert_rule_id TEXT NULL,\n  steps TEXT NOT NULL DEFAULT '[]',\n  auto_execute INTEGER NOT NULL DEFAULT 0,\n  created_at TEXT NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS runbook_executions (\n  id TEXT PRIMARY KEY,\n  runbook_id TEXT NOT NULL,\n  alert_event_id TEXT NULL,\n  status TEXT NOT NULL DEFAULT 'pending',\n  output TEXT NULL,\n  started_at TEXT NOT NULL,\n  completed_at TEXT NULL,\n  executed_by TEXT NOT NULL DEFAULT 'system'\n);\nCREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(runbook_id, started_at);\n";
export type RawRow = Record<string, unknown>;
