# ADR-003 Seven-Layer Memory Model (Historical Alias)

- Status: Superseded by ADR-020
- Note: This file is only retained as a historical link compatibility page to prevent broken references.
- Compatibility redirect: For authoritative ADR-003 memory contract, please use `003-memory-six-layers.md`.

## Background

The repository once simultaneously had `003-memory-seven-layers.md` and "Six-Layer Memory Model" body mismatch.
Current specification content has been unified to [ADR-003 Six-Layer Memory Model with KV Cache Fixed Prefix](./003-memory-six-layers.md).

## Migration Rules

When encountering any of the following historical references, directly jump to `003-memory-six-layers.md`:

- ADR-003 in quickstart/migration/ADR cross-references
- `003-memory-seven-layers.md` in code audits, implementation notes, or internal wiki

## Current Authoritative Document

- [ADR-003 Six-Layer Memory Model with KV Cache Fixed Prefix](./003-memory-six-layers.md)
- [ADR-020 Memory Six-Plane Model](./020-memory-six-plane-model.md)