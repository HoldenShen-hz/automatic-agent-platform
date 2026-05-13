# ADR-003 Seven-Layer Memory Model (Historical Alias)

- Status: Superseded by ADR-020
- Note: This file is retained only as a historical link compatibility page to avoid breaking old references.

## Background

The repository early on simultaneously had 003-memory-seven-layers.md and the six-layer memory model text mismatch. Current specification content has been unified to ADR-003 Six-Layer Memory Model and KV Cache Fixed Prefix.

## Migration Rules

When encountering any of the following historical references, you should directly jump to 003-memory-six-layers.md:

- ADR-003 in quickstart, migration, or ADR cross-references
- 003-memory-seven-layers.md in code audits, implementation notes, or internal wikis

## Current Authoritative Documents

- [ADR-003 Six-Layer Memory Model and KV Cache Fixed Prefix](./003-memory-six-layers.md)
- [ADR-020 Memory Six-Plane Model](./020-memory-six-plane-model.md)
