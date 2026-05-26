# API Versioning Strategy

This document defines the versioning scope for API documentation and implementation, to prevent long-term drift between `docs_zh` API documentation and actual routes.

## Version Layers

- Route prefix: Stable public APIs use `/api/v1`.
- OpenAPI: `openapi.json` serves as the machine-readable source of truth.
- Documentation: `docs_en/reference/` records human-readable explanations and migration notes.

## Change Rules

- Backward-compatible changes may retain the current major version, such as adding optional fields or new endpoints.
- Breaking changes must introduce a new major version or provide a migration compatibility layer.
- Removing fields, changing error codes, changing authentication semantics, and changing pagination defaults are all considered breaking changes.

## Release Requirements

- API changes must simultaneously update OpenAPI/golden evidence or clearly state that they do not affect the public contract.
- SDK changes must explain whether server routes, error categories, and authentication behavior have changed synchronously.
- Documentation updates must include version, effective time, and compatibility notes.

## Validation

- Run relevant OpenAPI golden tests by name.
- Run minimal targeted tests for SDK/API route changes.
- Do not use full test results as a substitute for API contract evidence.
