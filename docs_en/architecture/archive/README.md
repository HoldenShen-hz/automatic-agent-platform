# Architecture Archive

`archive/` is used to retain historical architecture snapshots that were once official entry points, as well as current official architecture archived snapshots.

## Current Files

1. [00-platform-architecture-monolith-2026-05-14.md](./00-platform-architecture-monolith-2026-05-14.md)
   The full monolithic architecture document archive from 2026-05-14, retaining historical chapters, original narrative, and migration context.
2. [01-platform-architecture-current-snapshot-2026-05-26.md](./01-platform-architecture-current-snapshot-2026-05-26.md)
   The latest archived snapshot from 2026-05-26, reflecting the current "split documents + current implementation state" authoritative entry point.

## Usage Rules

1. To view the current system, first read `01-platform-architecture-current-snapshot-2026-05-26.md`, then jump to the corresponding official document under `../`.
2. To verify historical design, migration source, or review controversy background, then read `00-platform-architecture-monolith-2026-05-14.md`.
3. Documents in `archive/` do not replace the official `docs_zh/architecture/` directory, but must remain "traceable, comparable, and mappable to current implementation" state.
