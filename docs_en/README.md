# Automatic Agent Platform Documentation Entry

`docs_zh/` is now organized by "purpose" rather than "historical origin". The top level only contains directory entries; scattered overview files are no longer piled up here.

## Recommended Reading Order

1. First, read [architecture/00-platform-architecture.md](./architecture/00-platform-architecture.md)
2. Then read [migration/00-migration-guideline.md](./migration/00-migration-guideline.md)
3. Next, read [migration/01-migration-scope.md](./migration/01-migration-scope.md)
4. When you need specifications, refer to [contracts/README.md](./contracts/README.md) and [adr/README.md](./adr/README.md)
5. When you need execution guidance, refer to [operations/README.md](./operations/README.md)

## Directory Overview

| Directory | Purpose | Is Source of Truth |
| --- | --- | --- |
| [architecture/](./architecture/README.md) | Platform skeleton, code structure, architecture references, timing diagrams | `Yes` |
| [migration/](./migration/README.md) | Migration principles, migration scope | `Yes` |
| [contracts/](./contracts/README.md) | Authoritative contracts, protocols, state machines, object boundaries | `Yes` |
| [adr/](./adr/README.md) | Architecture Decision Records | `Yes` |
| [governance/](./governance/README.md) | Long-term governance rules, terminology, naming and change rules | `Yes` |
| [guides/](./guides/quickstart.md) | Getting started and authoring guides | `Yes` |
| [operations/](./operations/README.md) | Current execution, validation, operations and maintenance docs | `Yes` |
| [quality/](./quality/README.md) | Testing handbook, release checklist | `Yes` |
| [analysis/](./analysis/README.md) | Coverage matrices, codebase cross-reference reviews, and auxiliary analysis | `No` |

## Naming and Numbering Rules

- Documents oriented toward reading entry points use sequential numbering: `00-`, `01-`, `02-`.
- ADRs retain their original ADR numbers and are not mixed into top-level reading numbers.
- Contracts keep semantic naming without additional sequence numbers.
- Analysis-class documents go into `analysis/` and are no longer mixed into formal entry points in the form of `reviews/`.

## Current Constraints

- `architecture/00-platform-architecture.md` is the sole upper-level design source for the system skeleton.
- `analysis/` only provides auxiliary judgments and does not replace architecture, contracts, or ADRs.
- Historical reviews, archives, and one-off gap documents are no longer treated as formal entry points.