/**
 * Enterprise Governance Database Schema
 *
 * This module defines the DDL (Data Definition Language) for enterprise governance
 * tracking tables. These tables support incident handoff workflows between shifts
 * and store governance reports for audit and compliance purposes.
 *
 * ## Tables
 *
 * ### incident_handoff_records
 * Tracks the handover of incidents between on-call shifts. Each record captures
 * the incident context, assigned personnel (shift owner, primary/secondary oncall),
 * and a JSON blob with full handoff details. Indexed by environment and creation
 * time for efficient shift handoff queries.
 *
 * ### enterprise_governance_reports
 * Stores comprehensive governance reports that are generated periodically. Each
 * report references an incident handoff record and contains a summary of SLO
 * status, oncall readiness, and overall system health. Linked to tasks for
 * traceability.
 */
export declare const ENTERPRISE_GOVERNANCE_DDL = "\nCREATE TABLE IF NOT EXISTS incident_handoff_records (\n  handoff_id TEXT PRIMARY KEY,\n  incident_id TEXT NULL,\n  environment TEXT NOT NULL,\n  status TEXT NOT NULL,\n  shift_owner TEXT NOT NULL,\n  primary_oncall TEXT NOT NULL,\n  secondary_oncall TEXT NOT NULL,\n  severity TEXT NULL,\n  handoff_json TEXT NOT NULL,\n  created_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_incident_handoff_environment_created_at\n  ON incident_handoff_records(environment, created_at DESC);\nCREATE INDEX IF NOT EXISTS idx_incident_handoff_incident_created_at\n  ON incident_handoff_records(incident_id, created_at DESC);\n\nCREATE TABLE IF NOT EXISTS enterprise_governance_reports (\n  report_id TEXT PRIMARY KEY,\n  task_id TEXT NULL,\n  environment TEXT NOT NULL,\n  status TEXT NOT NULL,\n  shift_owner TEXT NOT NULL,\n  summary_json TEXT NOT NULL,\n  report_json TEXT NOT NULL,\n  generated_at TEXT NOT NULL,\n  handoff_id TEXT NOT NULL,\n  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,\n  FOREIGN KEY(handoff_id) REFERENCES incident_handoff_records(handoff_id) ON DELETE RESTRICT\n);\nCREATE INDEX IF NOT EXISTS idx_enterprise_governance_environment_generated_at\n  ON enterprise_governance_reports(environment, generated_at DESC);\nCREATE INDEX IF NOT EXISTS idx_enterprise_governance_status_generated_at\n  ON enterprise_governance_reports(status, generated_at DESC);\n";
