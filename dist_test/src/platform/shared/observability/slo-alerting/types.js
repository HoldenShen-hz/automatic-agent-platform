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
//# sourceMappingURL=types.js.map