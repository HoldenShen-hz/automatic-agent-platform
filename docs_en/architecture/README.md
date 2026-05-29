# Architecture

`architecture/` contains formal documents that define "what the platform is", organized in reading order.

## File Order

1. [00-platform-architecture.md](./00-platform-architecture.md)
   System skeleton and overall design - the sole authoritative design source.
2. [01-code-structure.md](./01-code-structure.md)
   Code directory and module boundary design.
3. [02-code-architecture-reference.md](./02-code-architecture-reference.md)
   Code architecture reference migrated from the legacy system, retained as the structural baseline reference for the new platform.
4. [03-module-diagrams.md](./03-module-diagrams.md)
   Module diagrams, relationship diagrams, and structural illustrations.
5. [04-runtime-sequence.md](./04-runtime-sequence.md)
   Key runtime sequences and main chain diagrams.
6. [archive/README.md](./archive/README.md)
   Historical architecture snapshots and current archive snapshot index.

## Usage Principles

- Read `00` first, then `01`, then proceed to `02-04` as needed.
- If `02-04` conflicts with `00`, `00` takes precedence.
- This directory does not contain execution traces, one-time reviews, or temporary TODOs.
- When you need to reference historical large documents or an architecture snapshot, go to `archive/`. Do not treat archived content as the sole current authority.

## Recent Synchronizations

- 2026-05-14: Architecture/implementation consistency issues in `docs_zh/reviews/issues-table.md` have been re-anchored to this directory's README as the index entry. Specific code-level fix evidence is still recorded in the review table's corresponding rows and `scripts/ci/audit-review-batch-resource-contracts.mjs`.
- Large structural items (giant file splits, symlink migrations, global type escape cleanups) are not disguised as completed within `00-platform-architecture.md`. They continue to progress according to governance boundaries and subsequent splitting plans.
- 2026-05-26: Added `archive/README.md` and `archive/01-platform-architecture-current-snapshot-2026-05-26.md` so that archive simultaneously preserves the historical monolith and the current latest archive snapshot.
- 2026-05-26: Officially synchronized recent code and architecture closure. Key updates to `00-platform-architecture.md`, `01-code-structure.md`, `03-module-diagrams.md`, `04-runtime-sequence.md`, and `05-cross-platform-ui-architecture.md`. Layer C public interfaces, federation governance persistence, event reliability, and Electron/UI contract fixes have been written back to the main text.