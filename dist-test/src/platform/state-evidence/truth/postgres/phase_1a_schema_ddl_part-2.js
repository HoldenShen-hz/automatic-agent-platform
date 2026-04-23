export const PHASE_1A_SCHEMA_DDL_PART_2 = `
  output_json JSONB NULL,
  estimated_cost_usd DOUBLE PRECISION NULL,
  actual_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  error_code VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_root_id ON tasks(root_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks(status, created_at DESC);
`;
//# sourceMappingURL=phase_1a_schema_ddl_part-2.js.map