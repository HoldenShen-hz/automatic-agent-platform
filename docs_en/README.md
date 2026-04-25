# Automatic Agent Platform Documentation Portal

`docs_en/` is now organized by "purpose" rather than "historical source"; top-level directories only retain entry points, and scattered top-level overview documents are no longer accumulated.

## Recommended Reading Order

1. First read [architecture/00-platform-architecture.md](./architecture/00-platform-architecture.md)
2. Then read [migration/00-migration-guideline.md](./migration/00-migration-guideline.md)
3. Then read [migration/01-migration-scope.md](./migration/01-migration-scope.md)
4. When needing specifications, enter [contracts/README.md](./contracts/README.md) and [adr/README.md](./adr/README.md)
5. When needing to implement, enter [operations/README.md](./operations/README.md)

## Directory Description

| Directory | Purpose | Source of Truth |
| --- | --- | --- |
| [architecture/](./architecture/README.md) | Platform skeleton, code structure, architecture reference, timing and diagrams | `yes` |
| [migration/](./migration/README.md) | Migration principles, migration scope | `yes` |
| [contracts/](./contracts/README.md) | Authoritative contracts, protocols, state machines, object boundaries | `yes` |
| [adr/](./adr/README.md) | Architecture decision records | `yes` |
| [governance/](./governance/README.md) | Long-term governance rules, terminology, naming and change rules | `yes` |
| [guides/](./guides/quickstart.md) | Getting started and authoring guides | `yes` |
| [operations/](./operations/README.md) | Current execution, validation, operations and maintenance documents | `yes` |
| [quality/](./quality/README.md) | Testing handbook, release checklist | `yes` |
| [analysis/](./analysis/README.md) | Coverage matrix, codebase cross-reference analysis and other auxiliary analysis | `no` |

## Naming and Numbering Rules

- Documents oriented toward reading entry points use `00-`, `01-`, `02-` incremental numbering.
- ADRs continue to retain original ADR numbering, not mixed into top-level reading numbering.
- Contracts maintain semantic naming without introducing extra sequence numbers.
- Analysis documents enter `analysis/`, no longer mixed into formal entry points in `reviews/` form.

## Current Constraints

- `architecture/00-platform-architecture.md` is the sole upper-level design source for the system skeleton.
- `analysis/` only does auxiliary judgment, does not replace architecture, contracts, ADR.
- Historical reviews, archives, and one-off gap documents are no longer treated as formal entry points.
