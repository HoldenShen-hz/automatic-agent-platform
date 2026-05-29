# Full Cleanup Review

> Maintenance date: 2026-05-27
> This file describes the current governance boundaries for "full repository cleanup" type issues, no longer retaining expired personal scan reports.

## Current Governance Scope

| Category | Current Definition |
| --- | --- |
| Document cleanup | Closed via `audit-docs-sync`, review summary table, and thematic document index |
| Test artifact cleanup | Closed via `.gitignore`, quality audit documents, and targeted cleanup rules |
| Deploy/build artifact cleanup | Closed via `Dockerfile`, `docker-compose.yml`, and `deploy/` configuration sync |
| Historical archive | Retained in `docs_zh/operations/archive/` and `docs_zh/architecture/archive/`, not as current source of truth |

## No Longer Used Patterns

- Personal absolute paths
- Machine-specific disk usage statistics
- One-time `rm -rf` lists pretending to be long-term specifications

## Current Source of Truth

- [platforme-full-review-b.md](./platforme-full-review-b.md)
- [../operations/current_todo_list.md](../operations/current_todo_list.md)
- [../operations/review-closure-board.md](../operations/review-closure-board.md)