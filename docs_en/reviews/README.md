# Review Documentation Maintenance Guide

`docs_zh/reviews/` contains architecture reviews, implementation consistency reviews, and issue tables. Issue tables can only express real processing status; governance items cannot be disguised as completed code fixes.

## Maintenance Rules

- Each issue line must retain `Review conclusion`, `Root cause classification`, and `Evidence`.
- Duplicate issues can be merged, but evidence must point to the same specific fix, verification command, or governance boundary.
- Long-term items such as large file splitting, global `any` cleanup, global TODO cleanup, and directory scale governance should be marked as governance items.
- Named failing tests must be proven with named targeted tests, not replaced with full test suite results.
- `npm audit` issues are based on current lockfile audit output.

## Current Round Status Definition

- `Resolved (implemented this round)`: This round has explicit file changes or targeted verification.
- `Reviewed and closed`: After review, confirmed to belong to boundary clarification, historical compatibility, or risk acceptance; cannot be falsely claimed as code fix.
- `Processed (merged)`: Reviewed and merged to a fix cluster, duplicate issue, or governance boundary.
- `Governance item`: Structural transformation that cannot be completed by a single patch; must be split and implemented subsequently.

## Current Entry Points

- `platforme-full-review-d.md`: Current main batch issue table
- `platforme-full-review-c.md`: Previous batch issue table
- `platforme-full-review-b.md`: Current ongoing large closure tracking table
- `platforme-full-review-a.md`: Previous batch issue summary table
- `platforme-full-review.md`: Historical long table and review conclusion archive
- `issues-table.md`: Design review line-level evidence table

Operations entry point is in `docs_zh/operations/review-closure-board.md`.