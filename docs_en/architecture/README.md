# Architecture

The `architecture/` directory consolidates formal documentation covering "what the platform is," numbered by reading order.

## Document Order

1. [00-platform-architecture.md](./00-platform-architecture.md)
   System skeleton and overall design; the single authoritative top-level design source.
2. [01-code-structure.md](./01-code-structure.md)
   Code directory and module boundary design.
3. [02-code-architecture-reference.md](./02-code-architecture-reference.md)
   Code architecture reference migrated from the legacy system; retained as the structural baseline reference for the new platform.
4. [03-module-diagrams.md](./03-module-diagrams.md)
   Module diagrams, relationship diagrams, and structural illustrations.
5. [04-runtime-sequence.md](./04-runtime-sequence.md)
   Key runtime sequences and main execution path diagrams.

## Usage Principles

- Start with `00`, then move to `01`, and finally proceed to `02-04` as needed.
- If `02-04` conflicts with `00`, `00` takes precedence.
- This directory is not for execution traces, one-off reviews, or temporary TODOs.