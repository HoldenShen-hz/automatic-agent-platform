# Architecture

The `architecture/` directory consolidates formal documentation answering "what the platform is." Files are numbered by reading order.

## File Order

1. [00-platform-architecture.md](./00-platform-architecture.md)
   System skeleton and overall design. The sole authoritative design source.
2. [01-code-structure.md](./01-code-structure.md)
   Code directory and module boundary design.
3. [02-code-architecture-reference.md](./02-code-architecture-reference.md)
   Code architecture reference migrated from the legacy system. Preserved as the structural baseline for the new platform.
4. [03-module-diagrams.md](./03-module-diagrams.md)
   Module diagrams, relationship diagrams, and structural illustrations.
5. [04-runtime-sequence.md](./04-runtime-sequence.md)
   Key runtime sequences and main flow diagrams.

## Usage Principles

- Read `00` first, then `01`, then `02-04` as needed.
- If `02-04` conflicts with `00`, `00` takes precedence.
- This directory does not contain execution traces, one-time reviews, or temporary TODOs.