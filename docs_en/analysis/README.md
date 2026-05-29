# Analysis

The `analysis/` directory contains auxiliary analysis documents that help assess coverage and consistency, but it is not the authoritative source of truth.

## File Order

1. [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md)
   Coverage matrix mapping architecture chapters to ADR / contract / src / tests.
2. [01-codebase-vs-design-review.md](./01-codebase-vs-design-review.md)
   Cross-reference review of the current codebase versus the design.

## Usage Principles

- `analysis/` is used only for auxiliary assessment and does not replace `architecture/`, `contracts/`, or `adr/`.
- If analysis conclusions conflict with the platform skeleton, `architecture/00-platform-architecture.md` takes precedence.