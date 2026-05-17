# Review Documentation Maintenance Guide

`docs_zh/reviews/` contains architecture reviews, implementation consistency audits, and issue tracking tables. Issue tables must reflect actual processing status and must not disguise governance items as completed code fixes.

## Maintenance Rules

- Each issue row must retain `Review Conclusion`, `Root Cause Classification`, and `Evidence`.
- Duplicate issues may be merged, but evidence must point to the same specific fix, verification command, or governance boundary.
- Large-scale items such as giant file splits, global `any` cleanup, global TODO cleanup, and directory scale governance should be marked as governance items.
- Named failed tests must be proven with targeted tests, not full test suite results as substitutes.
- `npm audit` issues are based on the current lockfile's audit output.

## This Round's Status Criteria

- `Resolved (This Round Landed)`: This round has clear file changes or targeted verification.
- `Processed (Merged)`: Reviewed and merged into fix clusters, duplicate issues, or governance boundaries.
- `Governance Item`: Structural transformation that cannot be completed with a single small patch and requires subsequent phased implementation.