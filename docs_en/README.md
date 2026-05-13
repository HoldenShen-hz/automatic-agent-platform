# Automatic Agent Platform Documentation Entry

`docs_zh/` is now organized by "purpose" rather than "historical origin". The top level only contains directory entries, and scattered overview files are no longer piled up.

## Recommended Reading Order

1. First read [architecture/00-platform-architecture.md](./architecture/00-platform-architecture.md)
2. Then read [migration/00-migration-guideline.md](./migration/00-migration-guideline.md)
3. Then read [migration/01-migration-scope.md](./migration/01-migration-scope.md)
4. For specifications, refer to [contracts/README.md](./contracts/README.md) and [adr/README.md](./adr/README.md)
5. For implementation guidance, refer to [operations/README.md](./operations/README.md)

## Directory Overview

| Directory | Purpose | Is Authoritative Source |
| --- | --- | --- |
| [architecture/](./architecture/README.md) | Platform skeleton, code structure, architecture references, timing diagrams | `Yes` |
| [migration/](./migration/README.md) | Migration principles, migration scope | `Yes` |
| [contracts/](./contracts/README.md) | Authoritative contracts, protocols, state machines, object boundaries | `Yes` |
| [adr/](./adr/README.md) | Architecture Decision Records | `Yes` |
| [governance/](./governance/README.md) | Long-term governance rules, terminology, naming and change rules | `Yes` |
| [guides/](./guides/quickstart.md) | Getting started and authoring guides | `Yes` |
| [operations/](./operations/README.md) | Current execution, validation, operations and maintenance documentation | `Yes` |
| [quality/](./quality/README.md) | Testing handbook, release checklist | `Yes` |
| [analysis/](./analysis/README.md) | Supplementary analysis such as coverage matrices, codebase cross-references | `No` |

## Naming and Numbering Rules

- Documentation intended as reading entry points uses sequential numbering: `00-`, `01-`, `02-`, etc.
- ADRs retain their original ADR numbers and are not mixed into top-level reading numbers.
- Contracts use semantic naming without additional sequence numbers.
- Analysis documents go into `analysis/` and are no longer mixed into formal entry points as `reviews/`.

## Current Constraints

- `architecture/00-platform-architecture.md` is the sole authoritative design source for the system skeleton.
- `analysis/` is for supplementary guidance only and does not replace architecture, contracts, or ADRs.
- Historical reviews, archived documents, and one-time gap documents are no longer treated as formal entry points.