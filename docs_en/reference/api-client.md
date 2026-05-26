# API Client Usage Guide

The API SDK for this repository's UI is located in `ui/packages/shared/api-client`, with the public entry point being `@aa/shared-api-client`.

## Public Capabilities

- `RESTClient`: Unified REST request handling, interceptors, idempotent retries, and error wrapping.
- `WSClient`: Unified browser WebSocket, SharedWorker WebSocket, and in-memory fallback.
- `WSEventRouter`: Routes events by channel and triggers UI refreshes for high-priority events.
- `interceptors`: Handles authentication headers, trace/correlation, and error normalization.

## Constraints

- Feature layers can only depend on public exports from the API client, and must not directly access Layer A/B internal endpoints.
- Planned backend capabilities must be exposed via typed mocks and feature gates, and must not be faked as production-ready in the UI.
- SharedWorker clients must remove message listeners, clear replay buffers, and close ports when `disconnect()` is called.
