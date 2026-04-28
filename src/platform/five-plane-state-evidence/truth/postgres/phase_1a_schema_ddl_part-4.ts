export const PHASE_1A_SCHEMA_DDL_PART_4 = `
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_division_status ON workflow_state(division_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_updated_at ON workflow_state(updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_step_outputs (
  id VARCHAR(255) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  step_id VARCHAR(255) NOT NULL,
  role_id VARCHAR(255) NOT NULL,
`;
