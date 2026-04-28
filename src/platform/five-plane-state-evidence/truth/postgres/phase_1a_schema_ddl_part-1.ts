export const PHASE_1A_SCHEMA_DDL_PART_1 = `

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(255) PRIMARY KEY,
  parent_id VARCHAR(255) NULL,
  root_id VARCHAR(255) NOT NULL,
  division_id VARCHAR(255) NULL,
  title TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  input_json JSONB NOT NULL,
  normalized_input_json JSONB NULL,
`;
