export const PHASE_1A_SCHEMA_DDL_PART_3 = `
CREATE INDEX IF NOT EXISTS idx_tasks_division_status ON tasks(division_id, status);

CREATE TABLE IF NOT EXISTS workflow_state (
  task_id VARCHAR(255) PRIMARY KEY,
  division_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NOT NULL,
  current_step_index INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  outputs_json JSONB NOT NULL,
  last_error_code VARCHAR(100) NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resumable_from_step VARCHAR(255) NULL,
`;
