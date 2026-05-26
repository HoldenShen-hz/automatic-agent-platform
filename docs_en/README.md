# Automatic Agent Platform Documentation Entry

`docs_en/` is now organized by "purpose" rather than "historical source", with top-level directory entries only, and no longer piles up scattered overview files.

## Recommended Reading Order

1. First read [architecture/00-platform-architecture.md](./architecture/00-platform-architecture.md)
2. Then read [migration/00-migration-guideline.md](./migration/00-migration-guideline.md)
3. Then read [migration/01-migration-scope.md](./migration/01-migration-scope.md)
4. When you need specifications, go to [contracts/README.md](./contracts/README.md) and [adr/README.md](./adr/README.md)
5. When you need execution guidance, go to [operations/README.md](./operations/README.md)

## Directory Description

| Directory | Purpose | Is Authoritative Source |
|-----------|---------|------------------------|
| [architecture/](./architecture/README.md) | Platform skeleton, code structure, architecture reference, timing and diagrams | `Yes` |
| [migration/](./migration/README.md) | Migration principles, migration scope | `Yes` |
| [contracts/](./contracts/README.md) | Authoritative contracts, protocols, state machines, object boundaries | `Yes` |
| [adr/](./adr/README.md) | Architecture Decision Records | `Yes` |
| [governance/](./governance/README.md) | Long-term governance rules, terminology, naming and change rules | `Yes` |
| [guides/](./guides/quickstart.md) | Getting started and authoring guides | `Yes` |
| [operations/](./operations/README.md) | Current execution, verification, operations and maintenance documentation | `Yes` |
| [quality/](./quality/README.md) | Testing handbook, release checklist | `Yes` |
| [analysis/](./analysis/README.md) | Coverage matrices, codebase cross-reference reviews and other auxiliary analysis | `No` |

## Naming and Numbering Rules

- Documents intended as reading entries use `00-`, `01-`, `02-` sequential numbering.
- ADRs retain their original ADR numbers and are not mixed into top-level reading numbers.
- Contracts keep semantic naming without additional sequence numbers.
- Analysis documents go into `analysis/`, no longer mixed into formal entries in the `reviews/` form.

## Current Constraints

- `architecture/00-platform-architecture.md` is the sole authoritative design source for the system skeleton.
- `analysis/` only provides auxiliary judgment and does not replace architecture, contracts, or ADRs.
- Historical reviews, archives, and one-time gap documents are no longer treated as formal entries.
