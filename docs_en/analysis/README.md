# Analysis

`analysis/` contains supplementary analysis documents to help judge coverage and consistency, but they are not authoritative sources of truth.

## File Order

1. [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md)
   Architecture chapter to ADR / contract / src / tests coverage matrix.
2. [01-codebase-vs-design-review.md](./01-codebase-vs-design-review.md)
   Current codebase vs design alignment review.

## Usage Principles

- `analysis/` is only for auxiliary judgment and does not replace `architecture/`, `contracts/`, or `adr/`.
- If analysis conclusions conflict with the platform skeleton, `architecture/00-platform-architecture.md` takes precedence.
