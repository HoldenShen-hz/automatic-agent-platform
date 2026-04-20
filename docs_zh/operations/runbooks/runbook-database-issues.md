# Database Issues Runbook

## Symptoms

- `/healthz` reports database not writable
- migration or startup checks fail
- queue dispatch stalls with storage errors

## Diagnosis

1. Identify the active storage backend: SQLite or PostgreSQL.
2. For PostgreSQL, verify connectivity, credentials, and `schema_migrations` freshness.
3. For SQLite, inspect file ownership, disk space, WAL mode, and lock contention.
4. Review recent deployment or migration activity before making schema changes.

## Mitigation

1. Restore basic connectivity before retrying migrations or write traffic.
2. For SQLite contention, reduce concurrent writers and restart only after lock ownership is understood.
3. For PostgreSQL drift, run the approved migration path and validate `schema_migrations`.
4. If writes cannot be restored quickly, switch the system into read-only or paused non-critical mode.

## Verification

1. Re-run health checks until database writability stays green.
2. Confirm queued work drains and no new storage errors appear in logs.
3. Capture root cause, exact SQL/migration version, and recovery time in the incident record.
