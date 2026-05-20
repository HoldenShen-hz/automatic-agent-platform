export const ENTERPRISE_GOVERNANCE_DDL = `
CREATE TABLE IF NOT EXISTS incident_handoff_records (
  handoff_id TEXT PRIMARY KEY,
  incident_id TEXT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  shift_owner TEXT NOT NULL,
  primary_oncall TEXT NOT NULL,
  secondary_oncall TEXT NOT NULL,
  severity TEXT NULL,
  handoff_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incident_handoff_environment_created_at
  ON incident_handoff_records(environment, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_handoff_incident_created_at
  ON incident_handoff_records(incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS enterprise_governance_reports (
  report_id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  shift_owner TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(handoff_id) REFERENCES incident_handoff_records(handoff_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_enterprise_governance_environment_generated_at
  ON enterprise_governance_reports(environment, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_governance_status_generated_at
  ON enterprise_governance_reports(status, generated_at DESC);
`;
