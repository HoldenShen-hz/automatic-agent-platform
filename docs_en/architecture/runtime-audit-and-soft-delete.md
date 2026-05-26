# Runtime Audit and Soft Delete Specification

## Goal

Establish unified audit fields and soft delete constraints for core business tables in the runtime physical schema, addressing the issue where only `mission_records` has a complete audit chain and other tables are difficult to trace for responsibility and state evolution.

## Standard Fields

The following fields are default requirements for core business tables:

- `created_at TEXT NOT NULL`
- `created_by TEXT NULL`
- `updated_at TEXT NULL`
- `updated_by TEXT NULL`
- `archived_at TEXT NULL`
- `archived_by TEXT NULL`
- `is_deleted INTEGER NOT NULL DEFAULT 0`
- `deleted_at TEXT NULL`
- `deleted_by TEXT NULL`

Field semantics:

- `created_*` records the first database write time and responsible subject.
- `updated_*` records the most recent state or content change.
- `archived_*` is for business archiving, not equivalent to deletion.
- `is_deleted` + `deleted_*` indicates soft delete; in SQLite, boolean values uniformly use `INTEGER 0/1`.

## Core Tables That Must Have Complete Fields

- `task_drafts`
- `confirmed_task_specs`
- `request_envelopes`
- `harness_runs`
- `plan_graph_bundles`
- `graph_patches`
- `node_runs`
- `node_attempts`
- `node_attempt_receipts`
- `side_effect_records`
- `budget_ledgers`
- `budget_reservations`
- `budget_settlements`
- `mission_records`
- `mission_memberships`
- `mission_context_snapshots`
- `run_version_locks`
- `artifact_version_lock_sets`
- `decision_input_bundles`
- `harness_decisions`
- `human_responsibility_records`

These tables all belong to business state that can be corrected, archived, replayed, reconciled, or manually traced, so they must have responsible subject and soft delete traces.

## System Tables Allowed for Exemption

The following tables are retained as append-only or system-type structures, and are not forced to have soft delete fields added:

- `mission_event_sequences`
- `runtime_event_log`
- `runtime_outbox`
- `runtime_audit_refs`

Exemption rules:

- Append-only event stream tables rely on immutability semantics; deletion would break event sequence or outbox delivery evidence.
- Pure system count/reference tables are maintained by runtime mechanisms; the focus is on immutability and primary key idempotency, not business archiving.

## Database Write Constraints

- When adding new runtime business tables, the default is to first include them in "core tables that must have complete fields".
- If exemption is needed, the append-only or system-type reason must be explained in design review, and this specification and corresponding audit script must be synchronized.
- When implementing soft delete read semantics in runtime queries, `is_deleted = 0` must be explicitly filtered, not relying on caller conventions.
