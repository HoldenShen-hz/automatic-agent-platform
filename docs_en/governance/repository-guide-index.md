# Repository Guide Index

This page uniformly indexes the repository root and governance entry documents, preventing `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `MEMORY.md` from drifting separately.

## Authoritative Order

1. [source_of_truth.md](./source_of_truth.md)
2. [naming_and_directory_conventions.md](./naming_and_directory_conventions.md)
3. [../../AGENTS.md](../../AGENTS.md)
4. [../../CLAUDE.md](../../CLAUDE.md)
5. [../../README.md](../../README.md)
6. [../../CONTRIBUTING.md](../../CONTRIBUTING.md)
7. [../../MEMORY.md](../../MEMORY.md)

## Responsibility Division

| Document | Purpose | When to Update |
|------|------|----------|
| [README.md](../../README.md) | Repository entry, common commands, main navigation | When command entry or main index changes |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Contribution process, environment setup, submission process | When development process or onboarding commands change |
| [AGENTS.md](../../AGENTS.md) | Code agent work constraints, directory boundaries | When directory boundaries, testing constraints, contract requirements change |
| [CLAUDE.md](../../CLAUDE.md) | Code agent quick context | When architecture entry or core boundaries change |
| [MEMORY.md](../../MEMORY.md) | Lightweight engineering memory, not authoritative source | When short-term working memory needs supplementing |

## Related Entries

- [../quality/buglist.md](../quality/buglist.md)
- [../adr/README.md](../adr/README.md)
- [../contracts/README.md](../contracts/README.md)
- [../reviews/README.md](../reviews/README.md)
