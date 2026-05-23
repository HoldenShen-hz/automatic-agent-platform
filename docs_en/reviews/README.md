# Review Documents Maintenance Guide

`docs_zh/reviews/` contains architecture reviews, implementation consistency audits, and issue tables. Issue tables must reflect actual processing status; governance items cannot be disguised as completed code fixes.

## Maintenance Rules

- Each issue row must preserve `Review conclusion`, `Root cause classification`, and `Evidence`.
- Duplicate issues may be consolidated, but evidence must point to the same specific fix, verification command, or governance boundary.
- Large file splits, global `any` cleanup, global TODO cleanup, and directory-scale governance items should be marked as governance items.
- Failed tests must be proven with targeted tests, not full test result replacements.
- `npm audit` issues are based on the current lockfile's audit output.

## Current Round Status Definition

- `Resolved (this round落地)`: This round has explicit file changes or targeted verification.
- `Verified and closed`: After review, confirmed as boundary clarification, historical compatibility, or risk acceptance; cannot impersonate code fixes.
- `Processed (consolidated)`: Reviewed and consolidated into fix clusters, duplicate issues, or governance boundaries.
- `Governance item`: Not a single small patch; structural transformation that must be implemented in subsequent splits.

For operations entry, see `docs_zh/operations/review-closure-board.md`.
