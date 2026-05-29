# Database Issues Runbook

## Symptoms

- `/healthz` reports database unwritable
- Migration or startup check fails
- Queue dispatch stuck due to storage error

## Diagnosis

1. First confirm whether current storage backend is SQLite or PostgreSQL.
2. For PostgreSQL, check connectivity, credentials and whether `schema_migrations` is latest.
3. For SQLite, check `AA_DB_PATH`, file owner, disk space, WAL mode and lock contention.
4. Before any schema changes, review recent deployment or migration activities.

SQLite path description:

- Common paths for local/dev are `./data/sqlite/automatic-agent-demo.db` or `./data/sqlite/automatic-agent-dev.db`
- Container/Helm default is usually `data/sqlite/automatic-agent.db`
- Do not assume only one hardcoded path; use actual `AA_DB_PATH` as the reference

## Resolution

1. First restore basic connectivity, then retry migration or write traffic.
2. For SQLite lock contention, first reduce concurrent writes, then after confirming lock holder decide whether to restart.
3. For PostgreSQL schema drift, go through approved migration path and verify `schema_migrations`.
4. If unable to restore writes in short time, switch to read-only or pause non-critical traffic.

## Verification

1. Repeatedly execute health checks until database writable status stably turns green.
2. Confirm backlog starts draining and no new storage errors appear in logs.
3. Record root cause, specific SQL/migration version and recovery duration in incident record.