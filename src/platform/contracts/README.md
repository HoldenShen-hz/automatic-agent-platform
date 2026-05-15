# Platform Contracts Directory Contract

`src/platform/contracts/` is the canonical platform contract area for runtime-facing contracts.

## Rules

- Prefer package or barrel exports from this directory over deep imports into contract internals.
- Keep executable contract helpers separate from passive data shapes.
- Do not duplicate contract definitions under unrelated source trees.
- When compatibility exports are required, document the canonical source in the export file.

## Large Files

Large contract indexes are tracked as governance items. Do not add unrelated data models to an already large index. New contract families should use a focused subdirectory with an explicit `index.ts`.

## Review Evidence

This README resolves the ambiguity around duplicate contract roots and data-vs-object boundaries. It does not claim that all large contract files have been physically split.
