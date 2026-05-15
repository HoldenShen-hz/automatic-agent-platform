# Truth Store Boundary

This directory owns authoritative runtime truth stores, schemas, repositories, and SQLite/Postgres persistence adapters.

## Rules

- Schema changes must preserve auditability and replay requirements.
- SQL identifiers must be validated before interpolation.
- Repository decorators should not block the event loop.
- Cross-store migrations need targeted migration tests.
