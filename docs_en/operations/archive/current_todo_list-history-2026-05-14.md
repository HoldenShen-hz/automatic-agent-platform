# Current Todo List History (Archived 2026-05-14)

> This file is the historical archive of the full failure baseline from before 2026-05-14.
> It is retained for audit and reconciliation purposes. For current active items, see `current_todo_list.md`.

## Historical Status

The status below represents the state as of 2026-05-14 before the current todo list was restructured.

### Batch Status Summary

| Batch | Status | Archived Date | Notes |
| --- | --- | --- | --- |
| A1 | Archived | 2026-04-20 | First batch |
| A2 | Archived | 2026-04-20 | Second batch |
| A3 | Archived | 2026-04-21 | Third batch |
| A4 | Archived | 2026-04-22 | Fourth batch |
| A5 | Archived | 2026-04-23 | Fifth batch |
| A6 | Archived | 2026-04-24 | Sixth batch |
| A7 | Archived | 2026-04-25 | Seventh batch |
| A8 | Archived | 2026-04-26 | Eighth batch |
| A9 | Archived | 2026-04-28 | Ninth batch |
| B1 | Archived | 2026-04-28 | First B batch |
| B2 | Archived | 2026-04-28 | Second B batch |
| B3 | Archived | 2026-04-28 | Third B batch |
| B4 | Archived | 2026-04-28 | Fourth B batch |
| B5 | Archived | 2026-04-28 | Fifth B batch |
| B6 | Archived | 2026-04-28 | Sixth B batch |
| B7 | Archived | 2026-04-28 | Seventh B batch |

### Original Full Test Failure List (2026-04-25 Baseline)

For historical reference, the original failure counts by directory:

| Directory | Failures | Category |
|-----------|----------|----------|
| unit/platform/five-plane-state-evidence/truth | 84 | SQLite repositories |
| unit/platform/shared/observability | 55 | Observability |
| unit/platform/five-plane-interface/api | 52 | API interface |
| unit/platform/five-plane-orchestration/oapeflir | 50 | OAPEFLIR |
| unit/platform/shared/stability | 43 | Stability |
| unit/platform/shared/cache | 35 | Cache |
| unit/platform/five-plane-state-evidence/knowledge | 33 | Knowledge |
| unit/platform/five-plane-state-evidence/events | 30 | Events |
| unit/platform/five-plane-orchestration/harness | 30 | Harness |
| unit/platform/five-plane-state-evidence/memory | 24 | Memory |
| unit/platform/five-plane-execution/worker-pool | 22 | Worker pool |
| unit/platform/five-plane-interface/channel-gateway | 16 | Channel gateway |
| unit/platform/model-gateway/provider-registry | 15 | Provider registry |
| unit/platform/five-plane-orchestration/agent-delegation | 14 | Agent delegation |
| unit/platform/five-plane-state-evidence/artifacts | 13 | Artifacts |
| Other directories | ~50 | Various |

**Total: 354 failures**

### Test Result Summary (2026-04-25)

| Metric | Value |
|--------|-------|
| Total tests | 31,317 |
| Passed | 30,963 |
| Failed | 354 |
| Cancelled | 0 |

### Key Metrics

| Metric | Baseline |
|--------|----------|
| Unit test pass rate | 98.9% |
| Integration test status | Not run in this baseline |
| Build status | Passing |

## Migration Notes

This archive file documents the state before the migration to the current todo list structure. The current system uses `docs_zh/reviews/issues-table.md` as the authoritative row-by-row status for design review issue closure, and `current_todo_list.md` for active execution tracking.

## Historical Context

This archive represents:
- Historical batches A1-B7 completed before 2026-05-14
- Full test failure baseline from 2026-04-25
- State before implementation consistency audits A0-A6 and I0-I2

The closure of these batches and the resolution of failures documented here led to the current v4.3 Executable Specification Freeze state.

## Reference

For the current active todo list, see: `../current_todo_list.md`

For review issue tracking, see: `docs_zh/reviews/issues-table.md`