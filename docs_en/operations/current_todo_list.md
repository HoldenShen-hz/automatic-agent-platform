# Current Todo List

> 2026-05-14 Review: `docs_zh/reviews/issues-table.md` is the authoritative row-by-row status table for design review issue closure; this file only retains the current running batch entry, no longer承载历史全量失败清单.
> The historical long list has been archived to `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`; refer to the archive when tracing batch evidence for A1-A9.

## Current Authoritative Entry Points

- Review issue row-by-row status: `docs_zh/reviews/issues-table.md`
- Current round architecture sync entry: `docs_zh/architecture/README.md`
- Environment configuration description: `docs_zh/reference/environment-configuration.md`
- Operations runbook: `docs_zh/operations/`

## Historical Baseline Archive List

- `docs_zh/operations/archive/current_todo_list-history-2026-05-14.md`
- Historical baseline archived: Historical full failure baseline only serves as audit and reconciliation material, not as current active task queue.
- Historical unrun archived: Unrun batches retained in archive files; when re-validating, must produce new target logs and conclusions.

| Batch | Status | Archive Description |
| --- | --- | --- |
| A1 | Archived | See historical archive file |
| A2 | Archived | See historical archive file |
| A3 | Archived | See historical archive file |
| A4 | Archived | See historical archive file |
| A5 | Archived | See historical archive file |
| A6 | Archived | See historical archive file |
| A7 | Archived | See historical archive file |
| A8 | Archived | See historical archive file |
| A9 | Archived | See historical archive file |
| B1 | Archived | See historical archive file |
| B2 | Archived | See historical archive file |
| B3 | Archived | See historical archive file |
| B4 | Archived | See historical archive file |
| B5 | Archived | See historical archive file |
| B6 | Archived | See historical archive file |
| B7 | Archived | See historical archive file |

## Current Execution Rules

- New review fixes must write back status, conclusion, root cause and evidence columns to `docs_zh/reviews/issues-table.md`.
- Historical full test failure baseline only serves as reconciliation material, cannot replace current targeted verification evidence.
- Long-term batch records enter `docs_zh/operations/archive/`; main file remains as short index to avoid re-swelling.
- Governance documents added after 2026-05-26 (such as `docs_zh/architecture/sync-async-service-pairs.md`) belong to post-archive supplementary assets, uniformly enter current review/architecture index, not backfilled as historical A/B active batches.