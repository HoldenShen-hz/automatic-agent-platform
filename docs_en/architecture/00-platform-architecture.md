# Platform Architecture Index

> **Review Date**: 2026-05-14: The historical 711KB monolithic architecture document has been archived to `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md`. This file is retained as a short index to prevent the architecture entry from continuing to carry unauditable oversized content.
>
> **2026-05-26 Sync**: Interface layer, federation governance, event reliability, and Electron/UI contracts have been written back to the official document based on current code; the latest system-level evidence is in `docs_zh/reviews/system-review-2026-05-26.md`.

## Current Reading Entry Points

- Architecture directory guide: `docs_zh/architecture/README.md`
- Design review issues table: `docs_zh/reviews/issues-table.md`
- Implementation consistency audit: `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`
- Contract documents: `docs_zh/contracts/`
- ADR: `docs_zh/adr/`

## Maintenance Rules

- New architecture content should preferentially fall into thematic documents or ADR, and should not expand this index into a monolithic document.
- When referencing historical full text, link to the archived file and record the reason in the review table.
- Architecture implementation closure is based on `issues-table.md` line-level evidence and `scripts/ci/audit-review-batch-resource-contracts.mjs` audit results.
- Historical `five-plane-*` directory names, old "CEO/VP/Division" narrative, and v2.x layered descriptions are only used as compatible search entry points; current engineering naming uses `P1-P5 + X1`, `DomainDescriptor`, `HarnessRun/NodeRun` as the standard.
- Current public UI data source uses Layer C `/v1/*` contract as the standard, and `/admin/*` is no longer treated as the default frontend public interface.
