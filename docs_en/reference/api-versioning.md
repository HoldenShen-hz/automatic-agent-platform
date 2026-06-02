# API Versioning Policy

This document defines the version semantics used by the API documentation and implementation, in order to prevent long-term drift between the `docs_zh` API documentation and the actual routes.

## Version Layers

- Route prefix: stable public APIs keep the `/api/v1` prefix.
- OpenAPI: `openapi.json` is the machine-readable source of truth.
- Documentation: `docs_zh/reference/` records human-readable explanations and migration notes.
- Request negotiation: the UI transport sends its set of acceptable versions via `Accept-Version`.
- Response echo: the server exposes the version selected for the current request via the `x-api-version` response header.

## Change Rules

- Backward-compatible changes may remain on the current major version, for example adding optional fields or new endpoints.
- Breaking changes must introduce a new major version or provide a migration compatibility layer.
- Removing fields, changing error codes, changing authentication semantics, and changing pagination defaults are all considered breaking changes.

## Release Requirements

- API changes must simultaneously update the OpenAPI/golden evidence, or clearly state that the public contract is not affected.
- SDK changes must specify whether the server routes, error categories, and authentication behavior are updated in sync.
- The two client negotiation models must be kept distinct:
  - UI shared api-client: sends `Accept-Version` on every request.
  - SDK client: sends `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` and performs a handshake during initialization.
- The boundary between the two models is defined in `docs_zh/adr/120-ui-sdk-client-transport-boundary.md`; the documentation must not blend them into a single protocol.
- Documentation updates must include the version, effective time, and a compatibility note.

## Verification

- Run the relevant OpenAPI golden tests by name.
- Run the minimal targeted tests for SDK/API route changes.
- Do not use full-suite test results as a substitute for API contract evidence.
