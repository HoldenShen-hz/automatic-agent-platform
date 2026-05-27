# Changelog

## [Unreleased]

- Pending follow-up changes after `0.2.0`.

## [0.2.0] - 2026-05-27

- Hardened SQLite-to-Postgres migration and checkpoint/snapshot cleanup paths against identifier injection and file-system race windows.
- Removed pack publish fallback to placeholder registry domains and replaced legacy contract placeholder URLs with repository-local documentation pointers.
- Reclassified long-running script and governance tests into integration scope, removed fixture-local placeholder tests, and tightened Stryker to a dedicated non-UI tsconfig.
- Deleted unreferenced audit/curation scripts and advanced the repository release baseline.

## [0.1.0] - 2026-05-14

- Added repository hygiene documentation for review maintenance, scripts, golden tests, deployment runbooks, chaos experiments, data output, platform symlinks, legacy runtime compatibility, domains, contracts, configuration, docs synchronization, and npm scripts.
- Strengthened `.env.example` secret handling guidance and JWT production warning.
- Expanded `.dockerignore` to match generated evidence, runtime data, temporary databases, artifacts, and replay outputs already excluded from source control.
- Updated `docs_zh/reviews/issues-table.md` to distinguish landed fixes from governance items and to record per-row evidence.
