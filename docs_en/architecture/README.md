# Architecture

`architecture/` contains formal documents that answer "what the platform is", numbered by reading order.

## File Order

1. [00-platform-architecture.md](./00-platform-architecture.md)
   System skeleton and overall design, the only upper-level design source.
2. [01-code-structure.md](./01-code-structure.md)
   Code directory and module boundary design.
3. [02-code-architecture-reference.md](./02-code-architecture-reference.md)
   Code architecture reference migrated from the old system, retained as structural baseline reference for the new platform.
4. [03-module-diagrams.md](./03-module-diagrams.md)
   Module diagrams, relationship diagrams, and structural illustrations.
5. [04-runtime-sequence.md](./04-runtime-sequence.md)
   Key runtime sequences and main chain diagrams.
6. [archive/README.md](./archive/README.md)
   Historical architecture snapshots and current archived snapshot index.

## Usage Principles

- Read `00` first, then `01`, then proceed to `02-04` as needed.
- If `02-04` conflicts with `00`, `00` takes precedence.
- This directory should not contain execution tracking, one-time reviews, or temporary TODOs.
- When verifying historical large documents or a certain architecture snapshot, go to `archive/`, do not treat archived content as the current sole authority.

## Recent Syncs

- 2026-05-14: Architecture/implementation consistency issues in `docs_zh/reviews/issues-table.md` have been re-attached using this directory README as the entry point; specific code-level fix evidence is still recorded in the review table's corresponding rows and `scripts/ci/audit-review-batch-resource-contracts.mjs`.
- Large structural items (giant file split, symlink migration, global type escape cleanup) are not falsely marked as completed within `00-platform-architecture.md`, and continue to advance according to governance boundaries and follow-up splitting plans.
- 2026-05-26: Added `archive/README.md` and `archive/01-platform-architecture-current-snapshot-2026-05-26.md`, allowing archive to simultaneously retain historical monolith and current latest archived snapshot.
- 2026-05-26: Formally synced the recent code and architecture closure; key updates to `00-platform-architecture.md`, `01-code-structure.md`, `03-module-diagrams.md`, `04-runtime-sequence.md`, `05-cross-platform-ui-architecture.md`, with Layer C public interfaces, federation governance persistence, event reliability, and Electron/UI contract fixes written back to the main text.
