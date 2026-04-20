# Storage Schema Contract

## 1. Scope

This contract defines Phase 1a platform core entities that must be persisted, minimum column sets, key indexes, foreign key strategy, and recovery semantics.

This version focuses on supplementing storage landing points corresponding to runtime execution, including:

- `executions`
- `execution_prechecks`
- `dead_letters`
- `heartbeat_snapshots`

Also defines OAPEFLIR closed-loop phased boundaries at storage layer:

- phase1-4 authoritative: Current must stably exist and be able to support recovery, approval, event audit, artifact / memory minimum landing core tables.
- transition / target-state extension: Extension table families and column semantics required for feedback, learning, improvement, release, knowledge, and high-order memory governance; allowed to evolve by phase, must not mistakenly write as all currently landed in database.

## 2. Storage Principles

- Phase 1a defaults to using SQLite as single-machine authoritative store.
- Table structure prioritizes serving task recovery, approval tracking, event audit, and runtime run reconstruction.
- Large-volume data prioritizes landing to artifact, then retain index and reference in DB.
- Phase 1a explicitly enables `PRAGMA foreign_keys = ON`.
- Phase 1a defaults to enabling `WAL`, `busy_timeout`, and explicit transaction boundary control.
- High-frequency heartbeat and display traffic does not require heavy persistent per-record, should prioritize sampled snapshot or latest state.
- Migration, backup, recovery, `integrity_check`, and corruption detection belong to Stable Core database backing requirements.

## 3. Core Tables and Extension Tables

Authoritative schema at minimum contains the following core tables:

- `tasks`
- `workflow_state`
- `workflow_step_outputs`
- `executions`
- `execution_prechecks`
- `dead_letters`
- `heartbeat_snapshots`
- `sessions`
- `messages`
- `events`
- `event_consumer_acks`
- `session_logs`
- `approvals`
- `file_locks`
- `memories`
- `tool_result_files`

Explanation:

- Above table defines Phase 1a minimum stable core table set, not the total tables implementation can have.
- Current implementation also allows and actually contains multiple extension tables, for example:
  - Organization and tenant domain: `organizations`, `workspaces`, `tenants`, `deployment_bindings`
  - Supply chain and governance domain: `skill_registry`, `skill_execution_policies`, `extension_packages`, `marketplace_*`
  - Security and key domain: `secret_registry`, `secret_leases`, `secret_usage_audits`, `secret_rotation_events`
  - Billing and data domain: `billing_accounts`, `usage_events`, `quota_counters`, `analytics_facts`, `archive_bundles`
  - Evolution and perception domain: `evolution_*`, `perception_sources`, `intel_items`, `intel_briefs`
- Therefore contract uses "minimum set" constraint on core tables; extension tables can continue to increase without breaking core constraints.

## 4. `tasks` Table Minimum Columns

| Column | Type | Description |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | Task ID |
| `parent_id` | `TEXT NULL` | Parent task |
| `root_id` | `TEXT NOT NULL` | Root task |
| `division_id` | `TEXT NULL` | Target division |
| `title` | `TEXT NOT NULL` | Title |
| `status` | `TEXT NOT NULL` | Task status enum |
| `source` | `TEXT NOT NULL` | Source |
| `priority` | `TEXT NOT NULL` | Priority |
| `input_json` | `TEXT NOT NULL` | Original input JSON |
| `normalized_input_json` | `TEXT NULL` | Normalized input |
| `output_json` | `TEXT NULL` | Output summary |
| `estimated_cost_usd` | `REAL NULL` | Estimated cost |
| `actual_cost_usd` | `REAL NOT NULL DEFAULT 0` | Actual cost |
| `error_code` | `TEXT NULL` | Most recent error code |
| `created_at` | `TEXT NOT NULL` | Created at |
| `updated_at` | `TEXT NOT NULL` | Updated at |
| `completed_at` | `TEXT NULL` | Completed at |

Index requirements:

- `idx_tasks_root_id`
- `idx_tasks_parent_id`
- `idx_tasks_status_created_at`
- `idx_tasks_division_status`

## 5. `workflow_state` Table Minimum Columns

| Column | Type | Description |
| --- | --- | --- |
| `task_id` | `TEXT PRIMARY KEY` | Associated task |
| `division_id` | `TEXT NOT NULL` | Owning division |
| `workflow_id` | `TEXT NOT NULL` | Workflow ID |
| `current_step_index` | `INTEGER NOT NULL` | Current step index |
| `status` | `TEXT NOT NULL` | Workflow status |
| `outputs_json` | `TEXT NOT NULL` | Output snapshot |
| `last_error_code` | `TEXT NULL` | Most recent error code |
| `retry_count` | `INTEGER NOT NULL DEFAULT 0` | Retry count |
| `resumable_from_step` | `TEXT NULL` | Resumable step |
| `started_at` | `TEXT NOT NULL` | Started at |
| `updated_at` | `TEXT NOT NULL` | Updated at |

Index requirements:

- `idx_workflow_state_division_status`
- `idx_workflow_state_updated_at`

## 6. `workflow_step_outputs` Table Minimum Columns

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `step_id TEXT NOT NULL`
- `role_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `data_json TEXT NOT NULL`
- `summary TEXT NULL`
- `artifacts_json TEXT NULL`
- `token_cost REAL NOT NULL DEFAULT 0`
- `duration_ms INTEGER NOT NULL DEFAULT 0`
- `validation_json TEXT NULL`
- `produced_at TEXT NOT NULL`

Index requirements:

- `idx_step_outputs_task_id`
- `idx_step_outputs_task_step UNIQUE(task_id, step_id)`

## 7. `executions` Table Minimum Columns

This table receives `ExecutionEnvelope` from `runtime_execution_contract.md`.

| Column | Type | Description |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | `execution_id` |
| `task_id` | `TEXT NOT NULL` | Associated task |
| `workflow_id` | `TEXT NULL` | Associated workflow |
| `parent_execution_id` | `TEXT NULL` | Previous execution or lineage upstream |
| `agent_id` | `TEXT NOT NULL` | Execution subject |
| `role_id` | `TEXT NULL` | Assuming role |
| `run_kind` | `TEXT NOT NULL` | `task_run / tool_call / approval_resume / replay` |
| `status` | `TEXT NOT NULL` | Aligned with `ExecutionStatus` (`runtime_state_machine_contract.md` §6) |
| `input_ref` | `TEXT NULL` | Input snapshot or artifact reference |
| `trace_id` | `TEXT NOT NULL` | Trace ID |
| `attempt` | `INTEGER NOT NULL` | Attempt number |
| `timeout_ms` | `INTEGER NOT NULL` | Max runtime |
| `budget_usd_limit` | `REAL NULL` | Budget upper limit |
| `requires_approval` | `INTEGER NOT NULL DEFAULT 0` | Whether approval required |
| `sandbox_mode` | `TEXT NULL` | Resolved sandbox mode |
| `allowed_tools_json` | `TEXT NULL` | Execution-level tool whitelist; runtime direct tool / skill must consume, illegal JSON or illegal array items default fail-closed |
| `allowed_paths_json` | `TEXT NULL` | Execution-level path whitelist; one of authoritative inputs for runtime tool path scope check, illegal JSON or illegal array items default fail-closed |
| `max_retries` | `INTEGER NOT NULL DEFAULT 0` | Max retry count |
| `retry_backoff` | `TEXT NOT NULL DEFAULT 'none'` | Retry strategy |
| `last_error_code` | `TEXT NULL` | Most recent error code |
| `last_error_message` | `TEXT NULL` | Most recent error message |
| `started_at` | `TEXT NULL` | Actual start time |
| `finished_at` | `TEXT NULL` | End time |
| `created_at` | `TEXT NOT NULL` | Created at |
| `updated_at` | `TEXT NOT NULL` | Updated at |

Index requirements:

- `idx_executions_task_created_at`
- `idx_executions_task_status`
- `idx_executions_trace_id`
- `idx_executions_parent_execution_id`
- `idx_executions_agent_status`
- `idx_executions_task_attempt UNIQUE(task_id, attempt, run_kind)`

## 8. `execution_prechecks` Table Minimum Columns

This table receives `ExecutionPrecheckResult`, used to retain authoritative result of each precheck.

- `id TEXT PRIMARY KEY`
- `execution_id TEXT NOT NULL`
- `allowed INTEGER NOT NULL`
- `reason_code TEXT NULL`
- `resolved_budget_usd REAL NULL`
- `resolved_timeout_ms INTEGER NOT NULL`
- `resolved_sandbox_mode TEXT NOT NULL`
- `resolved_tools_json TEXT NULL`
- `resolved_paths_json TEXT NULL`
- `checked_at TEXT NOT NULL`

Supplementary constraints:

- `resolved_paths_json` is not just audit trail; when execution carries path whitelist, runtime tool path scope check should directly consume this field and fail-close.

Index requirements:

- `idx_execution_prechecks_execution_id UNIQUE(execution_id)`
- `idx_execution_prechecks_checked_at`

## 9. `dead_letters` and `heartbeat_snapshots` Table Minimum Columns

`dead_letters`:

- `id TEXT PRIMARY KEY`
- `execution_id TEXT NOT NULL`
- `task_id TEXT NOT NULL`
- `final_reason_code TEXT NOT NULL`
- `retry_count INTEGER NOT NULL DEFAULT 0`
- `last_error_message TEXT NULL`
- `moved_at TEXT NOT NULL`

`heartbeat_snapshots`:

- `id TEXT PRIMARY KEY`
- `execution_id TEXT NOT NULL`
- `agent_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `progress_message TEXT NULL`
- `cpu_pct REAL NULL`
- `memory_mb REAL NULL`
- `sampled_at TEXT NOT NULL`

Index requirements:

- `idx_dead_letters_execution_id UNIQUE(execution_id)`
- `idx_dead_letters_task_id`
- `idx_dead_letters_reason_moved_at`
- `idx_heartbeat_execution_sampled_at`
- `idx_heartbeat_agent_sampled_at`

## 10. `sessions` and `messages` Table Minimum Columns

`sessions`:

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `channel TEXT NOT NULL`
- `status TEXT NOT NULL`
- `external_session_id TEXT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`messages`:

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `direction TEXT NOT NULL`
- `message_type TEXT NOT NULL`
- `content TEXT NOT NULL`
- `attachments_json TEXT NULL`
- `created_at TEXT NOT NULL`

Index requirements:

- `idx_sessions_task_id`
- `idx_messages_session_created_at`

`session_logs` (append-only audit/replay layer, Phase 2c / 3 evolution target):

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `sequence INTEGER NOT NULL`
- `entry_type TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `created_at TEXT NOT NULL`

Index requirements:

- `idx_session_logs_session_sequence UNIQUE(session_id, sequence)`

## 11. `events` and `approvals` Table Minimum Columns

`events`:

- `id TEXT PRIMARY KEY`
- `task_id TEXT NULL`
- `execution_id TEXT NULL`
- `event_type TEXT NOT NULL`
- `event_tier TEXT NOT NULL`
- `payload_json TEXT NOT NULL`
- `trace_id TEXT NULL`
- `created_at TEXT NOT NULL`

`event_consumer_acks`:

- `id TEXT PRIMARY KEY`
- `event_id TEXT NOT NULL`
- `consumer_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `last_attempt_at TEXT NULL`
- `acked_at TEXT NULL`
- `error_code TEXT NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`

`approvals`:

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `execution_id TEXT NULL`
- `status TEXT NOT NULL`
- `request_json TEXT NOT NULL`
- `response_json TEXT NULL`
- `timeout_policy TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `responded_at TEXT NULL`

Index requirements:

- `idx_events_task_created_at`
- `idx_events_execution_created_at`
- `idx_events_type_created_at`
- `idx_event_consumer_event_consumer UNIQUE(event_id, consumer_id)`
- `idx_approvals_task_status`

## 12. `file_locks` Table Minimum Columns

- `id TEXT PRIMARY KEY`
- `task_id TEXT NULL`
- `execution_id TEXT NULL`
- `lock_scope TEXT NOT NULL`
- `resource_path TEXT NOT NULL`
- `lock_mode TEXT NOT NULL`
- `owner_id TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Index requirements:

- `idx_file_locks_owner`
- `idx_file_locks_resource`

## 13. `memories` and `tool_result_files` Table Minimum Columns

`memories`:

- `id TEXT PRIMARY KEY`
- `task_id TEXT NULL`
- `session_id TEXT NULL`
- `agent_id TEXT NULL`
- `execution_id TEXT NULL`
- `memory_layer TEXT NOT NULL`
- `content_json TEXT NOT NULL`
- `embedding_ref TEXT NULL`
- `created_at TEXT NOT NULL`

`tool_result_files`:

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `execution_id TEXT NULL`
- `tool_name TEXT NOT NULL`
- `artifact_id TEXT NOT NULL`
- `file_path TEXT NOT NULL`
- `mime_type TEXT NULL`
- `size_bytes INTEGER NULL`
- `created_at TEXT NOT NULL`

## 14. Foreign Key Strategy

Phase 1a explicitly adopts the following strategy:

- `workflow_state.task_id -> tasks.id`
- `workflow_step_outputs.task_id -> tasks.id`
- `executions.task_id -> tasks.id`
- `executions.parent_execution_id -> executions.id`
- `execution_prechecks.execution_id -> executions.id`
- `dead_letters.execution_id -> executions.id`
- `dead_letters.task_id -> tasks.id`
- `heartbeat_snapshots.execution_id -> executions.id`
- `sessions.task_id -> tasks.id`
- `messages.session_id -> sessions.id`
- `event_consumer_acks.event_id -> events.id`
- `approvals.task_id -> tasks.id`
- `approvals.execution_id -> executions.id`
- `file_locks.task_id -> tasks.id`
- `file_locks.execution_id -> executions.id`
- `tool_result_files.task_id -> tasks.id`
- `tool_result_files.execution_id -> executions.id`

Explanation:

- `events.task_id` and `events.execution_id` allow NULL, so not all events are forced to be bound to task or execution.
- `memories` supports multi-source writes across task/session/agent/execution, Phase 1a does not force single foreign key.
- All data that must be bound to task main line or runtime run should be directly constrained by SQLite foreign keys, not just relying on application layer conscientiousness.

## 15. SQLite Initial Version DDL Appendix

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  parent_id TEXT NULL,
  root_id TEXT NOT NULL,
  division_id TEXT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  priority TEXT NOT NULL,
  input_json TEXT NOT NULL,
  normalized_input_json TEXT NULL,
  output_json TEXT NULL,
  estimated_cost_usd REAL NULL,
  actual_cost_usd REAL NOT NULL DEFAULT 0,
  error_code TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_root_id ON tasks(root_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_division_status ON tasks(division_id, status);

CREATE TABLE IF NOT EXISTS workflow_state (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  division_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  current_step_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  outputs_json TEXT NOT NULL,
  last_error_code TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resumable_from_step TEXT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_division_status
  ON workflow_state(division_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_updated_at
  ON workflow_state(updated_at);

CREATE TABLE IF NOT EXISTS workflow_step_outputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  summary TEXT NULL,
  artifacts_json TEXT NULL,
  token_cost REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  validation_json TEXT NULL,
  produced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_step_outputs_task_id
  ON workflow_step_outputs(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_step_outputs_task_step
  ON workflow_step_outputs(task_id, step_id);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workflow_id TEXT NULL,
  parent_execution_id TEXT NULL REFERENCES executions(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  role_id TEXT NULL,
  run_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  input_ref TEXT NULL,
  trace_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  timeout_ms INTEGER NOT NULL,
  budget_usd_limit REAL NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  sandbox_mode TEXT NULL,
  allowed_tools_json TEXT NULL,
  allowed_paths_json TEXT NULL,
  max_retries INTEGER NOT NULL DEFAULT 0,
  retry_backoff TEXT NOT NULL DEFAULT 'none',
  last_error_code TEXT NULL,
  last_error_message TEXT NULL,
  started_at TEXT NULL,
  finished_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executions_task_created_at
  ON executions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_executions_task_status
  ON executions(task_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_trace_id
  ON executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_executions_parent_execution_id
  ON executions(parent_execution_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_status
  ON executions(agent_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_task_attempt
  ON executions(task_id, attempt, run_kind);

CREATE TABLE IF NOT EXISTS execution_prechecks (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  allowed INTEGER NOT NULL,
  reason_code TEXT NULL,
  resolved_budget_usd REAL NULL,
  resolved_timeout_ms INTEGER NOT NULL,
  resolved_sandbox_mode TEXT NOT NULL,
  resolved_tools_json TEXT NULL,
  resolved_paths_json TEXT NULL,
  checked_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_prechecks_execution_id
  ON execution_prechecks(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_prechecks_checked_at
  ON execution_prechecks(checked_at);

CREATE TABLE IF NOT EXISTS dead_letters (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  final_reason_code TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  moved_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dead_letters_execution_id
  ON dead_letters(execution_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_task_id
  ON dead_letters(task_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_reason_moved_at
  ON dead_letters(final_reason_code, moved_at);

CREATE TABLE IF NOT EXISTS heartbeat_snapshots (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_message TEXT NULL,
  cpu_pct REAL NULL,
  memory_mb REAL NULL,
  sampled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_execution_sampled_at
  ON heartbeat_snapshots(execution_id, sampled_at);
CREATE INDEX IF NOT EXISTS idx_heartbeat_agent_sampled_at
  ON heartbeat_snapshots(agent_id, sampled_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  external_session_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_task_id
  ON sessions(task_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments_json TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created_at
  ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  event_type TEXT NOT NULL,
  event_tier TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  trace_id TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_task_created_at
  ON events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_execution_created_at
  ON events(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type_created_at
  ON events(event_type, created_at);

CREATE TABLE IF NOT EXISTS event_consumer_acks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  consumer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_attempt_at TEXT NULL,
  acked_at TEXT NULL,
  error_code TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_consumer_event_consumer
  ON event_consumer_acks(event_id, consumer_id);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_id TEXT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NULL,
  timeout_policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  responded_at TEXT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_task_status
  ON approvals(task_id, status);

CREATE TABLE IF NOT EXISTS file_locks (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  execution_id TEXT NULL,
  lock_scope TEXT NOT NULL,
  resource_path TEXT NOT NULL,
  lock_mode TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_locks_owner
  ON file_locks(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_locks_resource
  ON file_locks(resource_path);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  task_id TEXT NULL,
  session_id TEXT NULL,
  agent_id TEXT NULL,
  execution_id TEXT NULL,
  memory_layer TEXT NOT NULL,
  content_json TEXT NOT NULL,
  embedding_ref TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_result_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  execution_id TEXT NULL REFERENCES executions(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NULL,
  size_bytes INTEGER NULL,
  created_at TEXT NOT NULL
);
```

## 16. Runtime Storage Boundaries

- `executions` is the authoritative main table for runtime run.
- `runtime_repository_and_migration_contract.md` defines how these tables are consumed by repository and how migration evolves.
- `execution_prechecks` records whether single execution truly passed precheck, not allowed to exist only in memory.
- `dead_letters` records failure classification and landing result, does not replace task main state.
- `heartbeat_snapshots` only retains sampled snapshot, does not pursue per-heartbeat full fact source.
- `events` is responsible for fact events and recovery chain, `event_consumer_acks` is responsible for consumer acknowledgment by consumer, `heartbeat_snapshots` is responsible for liveness observation, do not mix these two.
- `file_locks` is authoritative storage for concurrent write protection, must not be retained only in process memory.

## 17. Artifact Index Boundaries

- Artifact main body stores in filesystem or object storage.
- `tool_result_files` is responsible for Phase 1a minimum index.
- If artifact types expand in future, should add independent `artifacts` index table, rather than backfilling BLOB into core task table.

## 18. Recovery and Transaction Requirements

- Key updates to task status, workflow status, and `executions.status` should be completed within the same transaction as much as possible.
- When creating new execution, should simultaneously write initial `executions` record, cannot run first then fill account later.
- After precheck completes, `execution_prechecks` and `executions.status` advancement should remain consistent.
- When run enters `blocked` and reason is approval, approval record and wait state persistence must be reliable.
- When run enters terminal state or dead-letter, final error code, attempt count, and terminal time must be recoverable.
- Tier 1 event write cannot be bypassed by optional optimization path.
- Expired file lock recovery must be based on joint judgment of `file_locks` and `executions`.
- Recovery process at minimum must be able to reconstruct execution context based on `tasks`, `workflow_state`, `executions`, `execution_prechecks`, `events`, `file_locks`.

## 19. Supplementary Rules

- When migrating to PostgreSQL, primary key, unique constraint, foreign key, and timestamp semantics must remain consistent; SQLite shortcuts must not be brought into PG fact source.
- Complete artifact index table at minimum splits into: artifact main record, artifact version, artifact access log.
- Heartbeat snapshot can be retained compressed by window, but latest snapshot and window related to incident must not be compressed away.
