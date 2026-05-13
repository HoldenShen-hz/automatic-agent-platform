# Storage Schema Contract

## 1. Scope

This contract defines the core entities that Phase 1a platform must persist, minimum column sets, key indexes, foreign key strategies, and recovery semantics.

This version focuses on completing storage landing points for v4.3 runtime truth, including:

- `harness_runs`
- `plan_graph_bundles`
- `node_runs`
- `node_attempts`
- `node_attempt_receipts`
- `budget_ledgers`
- `budget_reservations`

It also defines OAPEFLIR closed-loop phase boundaries at the storage layer:

- phase1-4 authoritative: core tables that must be stable and able to support recovery, approval, event audit, and artifact/memory minimum persistence.
- transition / target-state extension: extension table families and column semantics required for feedback, learning, improvement, release, knowledge, and higher-order memory governance; allowed to evolve by phase, must not be miswritten as all currently persisted.

## 2. Storage Principles

- Phase 1a defaults to SQLite as single-machine authoritative store.
- Table structures prioritize task recovery, approval tracking, event audit, and runtime run reconstruction.
- Large-volume data prioritizes artifact storage, with indexes and references retained in DB.
- Phase 1a explicitly enables `PRAGMA foreign_keys = ON`.
- Phase 1a defaults to `WAL`, `busy_timeout`, and explicit transaction boundary control.
- High-frequency heartbeats and display-class traffic do not require heavy persistence row by row; should use sampled snapshots or latest state primarily.
- Migration, backup, recovery, `integrity_check`, and corruption detection are stable core database backing requirements.

## 3. Core Tables and Extension Tables

Authoritative schema must include at least the following core tables:

- `harness_runs`
- `plan_graph_bundles`
- `node_runs`
- `node_attempts`
- `node_attempt_receipts`
- `budget_ledgers`
- `budget_reservations`
- `tasks`
- `workflow_state`
- `workflow_step_outputs`
- `sessions`
- `messages`
- `events`
- `event_consumer_acks`
- `session_logs`
- `approvals`
- `file_locks`
- `memories`
- `tool_result_files`

Notes:

- The above defines v4.3 canonical truth + projection minimum core table set, not all tables an implementation may have.
- `tasks`, `workflow_state`, `workflow_step_outputs`, `sessions`, `messages` are retained as projection/interaction tables, no longer independently carrying runtime truth.
- Current implementation also allows and actually includes various extension tables, for example:
  - Organization and tenant domain: `organizations`, `workspaces`, `tenants`, `deployment_bindings`
  - Supply chain and governance domain: `skill_registry`, `skill_execution_policies`, `extension_packages`, `marketplace_*`
  - Security and key domain: `secret_registry`, `secret_leases`, `secret_usage_audits`, `secret_rotation_events`
  - Billing and data domain: `billing_accounts`, `usage_events`, `quota_counters`, `analytics_facts`, `archive_bundles`
  - Evolution and Observe-compatible domain: `evolution_*`, `perception_sources`, `intel_items`, `intel_briefs` (legacy table names preserved, semantics closed via Observe)
- Therefore, contracts use "minimum set" constraints on core tables; extension tables may continue to be added without breaking core constraints.

### 3B. Authoritative Schema Inventory

The current repository no longer uses static "total table count" from architecture documents as acceptance criteria, but rather authoritative inventory:

- Authoritative service: `src/platform/state-evidence/truth/schema-inventory-service.ts`
- Authoritative API surface: `GET /v1/admin/inventories/schema`
- Current inventory reconciliation baseline: `86` logical tables
- Classification summary:
  - `core_truth`: `55`
  - `runtime_extension`: `18`
  - `governance_extension`: `9`
  - `reliability_extension`: `4`

Constraints:

- Subsequent schema evolution must synchronize inventory service updates and corresponding tests, no longer manually maintaining numbers only in reviews.
- Table counts appearing in reviews/coverage-matrix/contracts should use inventory service exported numbers as authoritative source.

### 3A. OAPEFLIR Extension Table Families

The following table families belong to `§K` canonical extension directions for storage schema:

- `feedback_signals`
- `learning_objects`
- `improvement_candidates`
- `strategy_versions`
- `rollout_records`
- `knowledge_entries`
- `knowledge_semantic_vectors`

Constraints:

- These table families may land in `Current -> Transition -> Target` manner, not required to all become authoritative operational dependencies in one batch.
- But contracts, migration planning, diagnostics, and lineage documentation must reserve unified naming and minimum field semantics for these objects.

Suggested minimum fields:

| Table | Minimum Fields |
| --- | --- |
| `feedback_signals` | `id`, `task_id?`, `workflow_id?`, `kind`, `sentiment?`, `source`, `evidence_ref?`, `created_at` |
| `learning_objects` | `id`, `source_refs_json`, `promotion_status`, `quality_score?`, `created_at` |
| `improvement_candidates` | `id`, `change_scope`, `strategy_version?`, `status`, `created_at` |
| `strategy_versions` | `id`, `version`, `diff_ref?`, `status`, `created_at` |
| `rollout_records` | `id`, `strategy_version`, `stage`, `status`, `metrics_json?`, `created_at` |
| `knowledge_entries` | `id`, `namespace`, `trust_tier`, `freshness_state`, `source_ref?`, `created_at` |
| `knowledge_semantic_vectors` | `knowledge_ref`, `chunk_id`, `document_id`, `namespace`, `embedding_id?`, `embedding_model`, `embedding`, `updated_at` |

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
| `input_json` | `TEXT NOT NULL` | Raw input JSON |
| `normalized_input_json` | `TEXT NULL` | Normalized input |
| `output_json` | `TEXT NULL` | Output summary |
| `estimated_cost_usd` | `REAL NULL` | Estimated cost |
| `actual_cost_usd` | `REAL NOT NULL DEFAULT 0` | Actual cost |
| `error_code` | `TEXT NULL` | Latest error code |
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
| `division_id` | `TEXT NOT NULL` | Division ownership |
| `workflow_id` | `TEXT NOT NULL` | Workflow ID |
| `current_step_index` | `INTEGER NOT NULL` | Current step index |
| `status` | `TEXT NOT NULL` | Workflow status |
| `outputs_json` | `TEXT NOT NULL` | Output snapshot |
| `last_error_code` | `TEXT NULL` | Latest error code |
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

## 7. `harness_runs` / `plan_graph_bundles` / `node_runs` / `node_attempts` / `node_attempt_receipts`

These tables carry v4.3 canonical runtime truth.

`harness_runs` minimum columns:

- `harness_run_id TEXT PRIMARY KEY`
- `tenant_id TEXT NOT NULL`
- `confirmed_task_spec_id TEXT NOT NULL`
- `request_envelope_id TEXT NOT NULL`
- `request_hash TEXT NOT NULL`
- `status TEXT NOT NULL`
- `constraint_pack_ref TEXT NOT NULL`
- `version_lock_id TEXT NOT NULL`
- `plan_graph_bundle_id TEXT NULL`
- `budget_ledger_id TEXT NOT NULL`
- `current_seq INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `terminal_at TEXT NULL`
- `terminal_reason TEXT NULL`

`plan_graph_bundles` minimum columns:

- `plan_graph_bundle_id TEXT PRIMARY KEY`
- `harness_run_id TEXT NOT NULL`
- `graph_version INTEGER NOT NULL`
- `graph_json TEXT NOT NULL`
- `scheduler_policy_json TEXT NOT NULL`
- `budget_json TEXT NOT NULL`
- `risk_profile_json TEXT NOT NULL`
- `validation_report_json TEXT NOT NULL`
- `artifact_refs_json TEXT NULL`
- `created_at TEXT NOT NULL`

`node_runs` minimum columns:

- `node_run_id TEXT PRIMARY KEY`
- `harness_run_id TEXT NOT NULL`
- `plan_graph_bundle_id TEXT NOT NULL`
- `graph_version INTEGER NOT NULL`
- `node_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `attempt_count INTEGER NOT NULL DEFAULT 0`
- `lease_id TEXT NULL`
- `fencing_token TEXT NULL`
- `current_seq INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `terminal_reason TEXT NULL`

`node_attempts` minimum columns:

- `node_attempt_id TEXT PRIMARY KEY`
- `node_run_id TEXT NOT NULL`
- `attempt_no INTEGER NOT NULL`
- `attempt_kind TEXT NOT NULL`
- `executor_ref TEXT NOT NULL`
- `input_snapshot_ref TEXT NOT NULL`
- `started_at TEXT NOT NULL`
- `completed_at TEXT NULL`
- `receipt_id TEXT NULL`

`node_attempt_receipts` minimum columns:

- `node_attempt_receipt_id TEXT PRIMARY KEY`
- `node_attempt_id TEXT NOT NULL`
- `node_run_id TEXT NOT NULL`
- `receipt_kind TEXT NOT NULL`
- `status TEXT NOT NULL`
- `output_ref TEXT NULL`
- `error_json TEXT NULL`
- `side_effect_refs_json TEXT NULL`
- `budget_settlement_refs_json TEXT NULL`
- `evidence_refs_json TEXT NULL`
- `produced_at TEXT NOT NULL`

Index requirements:

- `idx_harness_runs_request_hash UNIQUE(request_hash)`
- `idx_harness_runs_tenant_status`
- `idx_plan_graph_bundle_run_version UNIQUE(harness_run_id, graph_version)`
- `idx_node_runs_harness_status`
- `idx_node_runs_bundle_node UNIQUE(plan_graph_bundle_id, node_id, graph_version)`
- `idx_node_attempts_node_run_attempt UNIQUE(node_run_id, attempt_no)`
- `idx_node_attempt_receipts_attempt UNIQUE(node_attempt_id)`

## 8. `budget_ledgers` and `budget_reservations`

`budget_ledgers`:

- `budget_ledger_id TEXT PRIMARY KEY`
- `tenant_id TEXT NOT NULL`
- `harness_run_id TEXT NOT NULL`
- `currency TEXT NOT NULL`
- `hard_cap REAL NOT NULL`
- `soft_cap REAL NULL`
- `reserved_amount REAL NOT NULL DEFAULT 0`
- `settled_amount REAL NOT NULL DEFAULT 0`
- `released_amount REAL NOT NULL DEFAULT 0`
- `status TEXT NOT NULL`
- `version INTEGER NOT NULL`

`budget_reservations`:

- `budget_reservation_id TEXT PRIMARY KEY`
- `budget_ledger_id TEXT NOT NULL`
- `harness_run_id TEXT NOT NULL`
- `node_run_id TEXT NULL`
- `amount REAL NOT NULL`
- `resource_kind TEXT NOT NULL`
- `status TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`

Index requirements:

- `idx_budget_ledgers_harness_run UNIQUE(harness_run_id)`
- `idx_budget_reservations_ledger_status`
- `idx_budget_reservations_node_run`

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

`session_logs` (append-only audit/replay layer, Phase 2c/3 evolution target):

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
- `layer_level INTEGER NOT NULL`
- `content_json TEXT NOT NULL`
- `embedding_ref TEXT NULL`
- `token_budget INTEGER NULL`
- `freshness_state TEXT NOT NULL DEFAULT 'fresh'`
- `source_refs_json TEXT NULL`
- `created_at TEXT NOT NULL`

Supplementary constraints:

- `memory_layer` must be mappable to `L1-L6`.
- `layer_level` recommended to have one-to-one correspondence with `L1-L6` as `1-6` for easier sorting and migration.
- `source_refs_json` should prioritize storing `ArtifactRef / EvidenceRef / MemoryRef / KnowledgeRef`.

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
- `plan_graph_bundles.harness_run_id -> harness_runs.harness_run_id`
- `node_runs.harness_run_id -> harness_runs.harness_run_id`
- `node_runs.plan_graph_bundle_id -> plan_graph_bundles.plan_graph_bundle_id`
- `node_attempts.node_run_id -> node_runs.node_run_id`
- `node_attempt_receipts.node_attempt_id -> node_attempts.node_attempt_id`
- `node_attempt_receipts.node_run_id -> node_runs.node_run_id`
- `budget_ledgers.harness_run_id -> harness_runs.harness_run_id`
- `budget_reservations.budget_ledger_id -> budget_ledgers.budget_ledger_id`
- `budget_reservations.node_run_id -> node_runs.node_run_id`
- `sessions.task_id -> tasks.id`
- `messages.session_id -> sessions.id`
- `event_consumer_acks.event_id -> events.id`
- `approvals.task_id -> tasks.id`
- `approvals.harness_run_id -> harness_runs.harness_run_id`
- `approvals.node_run_id -> node_runs.node_run_id`
- `file_locks.node_run_id -> node_runs.node_run_id`
- `tool_result_files.node_run_id -> node_runs.node_run_id`

Notes:

- `events.task_id` and `events.execution_id` allow null, so not all events are required to be bound to tasks or executions.
- `memories` supports multi-source writes across task/session/agent/execution, Phase 1a does not enforce single foreign key.
- All data that must be bound to task main line or runtime run should be directly constrained by SQLite foreign keys, not relying only on application-layer discipline.

## 14A. Transition / Target-State Supplementary Notes

To maintain consistency with `runtime_repository_and_migration_contract.md`, the storage layer adopts three-state migration semantics:

- `Current`: `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_ledgers / budget_reservations` as runtime truth; `tasks / workflow / approvals / events / artifacts / memories` etc. as hybrid projection/evidence tables.
- `Transition`: extension table families may first be connected via append-only, shadow write, reporting-only, or evidence-only approaches.
- `Target`: `feedback / learning / improvement / rollout / knowledge / high-order memory` become stable governance objects fully aligned with typed ref/lineage.

Therefore:

- This contract allows current implementation to still focus on minimum core tables.
- But when designing new schema, migration, inspection, or audit, no longer introduce naming parallel to and conflicting with the above table families.

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
  layer_level INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  embedding_ref TEXT NULL,
  token_budget INTEGER NULL,
  freshness_state TEXT NOT NULL DEFAULT 'fresh',
  source_refs_json TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_result_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  execution_id NULL REFERENCES executions(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NULL,
  size_bytes INTEGER NULL,
  created_at TEXT NOT NULL
);
```

## 16. Runtime Storage Boundaries

- `harness_runs / node_runs / node_attempts / node_attempt_receipts / budget_*` are v4.3 runtime truth main table families.
- `runtime_repository_and_migration_contract.md` defines how these tables are consumed by repositories and how migrations evolve.
- `events` is responsible for fact events and recovery chains, `event_consumer_acks` is responsible for consumer acknowledgment; survival observation is only a derived observation layer; the two must not be mixed.
- `file_locks` is authoritative storage for concurrent write protection, must not be retained only in process memory.

## 17. Artifact Index Boundaries

- Artifact main body is stored in filesystem or object storage.
- `tool_result_files` is responsible for Phase 1a minimum index.
- If artifact types expand in the future, a separate `artifacts` index table should be added, not backfilling BLOB into core task tables.

## 18. Recovery and Transaction Requirements

- `harness_runs.status`, `node_runs.status`, and related projection key updates should be completed within the same transaction as much as possible.
- When creating new `HarnessRun` / `NodeRun` / `NodeAttempt`, initial truth records should be written simultaneously; cannot run first then fill accounts later.
- When run enters `awaiting_hitl` or `policy_blocked`, approval records and wait state persistence must be reliable.
- When run enters terminal state, ensure latest error code, attempt count, budget settlement, and terminal time are recoverable.
- Tier 1 event writes cannot be bypassed by optional optimization paths.
- Expired file lock recovery must be determinable based on joint judgment of `file_locks` and `node_runs`.
- Recovery flow must at minimum be able to reconstruct execution context based on `harness_runs`, `plan_graph_bundles`, `node_runs`, `node_attempts`, `node_attempt_receipts`, `budget_reservations`, `events`, `file_locks`.

## 19. Supplementary Rules

- When migrating to PostgreSQL, primary key, unique constraints, foreign keys, and timestamp semantics must remain consistent; SQLite shortcuts must not be brought into PG fact sources.
- Complete artifact index table should at minimum split: artifact main record, artifact version, artifact access log.
- Heartbeat snapshots may be retained compressed by window, but latest snapshots and windows related to incidents must not be compressed.
- High-risk/critical risk without confirmation must reject generating `RequestEnvelope`.
- Same `idempotencyKey + requestHash` duplicate submission must not create multiple `HarnessRun`.
- `TaskDraft` must not be consumed by P4 dispatch.
- Old `/api/v1/tasks` compatibility entry must project to v4.3 intake chain.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-33: This document originally wrote `tasks / workflow_state / executions` as storage truth main chain. Root cause: storage contract directly reused v3 single-machine table model, without migrating along as `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt / BudgetLedger` became canonical runtime truth. Fix: This version changes core truth table families to `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_ledgers / budget_reservations`, and demotes old tables to projection/compatibility layer.
- T-34: This document declared `layer_level / token_budget / freshness_state / source_refs_json` in `memories` minimum columns in §13, but SQLite DDL appendix still lacked these columns. Root cause: body schema and appendix DDL were not synchronized after a memory contract expansion. Fix: Body and DDL are now aligned; `memories` table minimum columns and DDL synchronously include these four fields.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.