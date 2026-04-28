export const PHASE_1A_SCHEMA_DDL_PART_5 = `
  status VARCHAR(50) NOT NULL,
  data_json JSONB NOT NULL,
  summary TEXT NULL,
  artifacts_json JSONB NULL,
  token_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  validation_json JSONB NULL,
  produced_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_step_outputs_task_id ON workflow_step_outputs(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_step_outputs_task_step ON workflow_step_outputs(task_id, step_id);
`;
