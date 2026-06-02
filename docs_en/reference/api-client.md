# API Client Usage

The API SDK for the UI in this repository lives in `ui/packages/shared/api-client`; the public entry is `@aa/shared-api-client`.

## Public Capabilities

- `RESTClient`: unified REST request handling, interceptors, idempotent retry, and error wrapping.
- `WSClient`: unified browser WebSocket, SharedWorker WebSocket, and in-memory fallback.
- `WSEventRouter`: routes events by channel and triggers UI refreshes for high-priority events.
- `interceptors`: responsible for authentication headers, trace/correlation IDs, and error normalization.

## Constraints

- The Feature layer may only depend on the public exports of the API client and must not access Layer A/B internal endpoints directly.
- Planned backend capabilities must be exposed via typed mocks and feature gates, and must not be presented as production-ready inside the UI.
- When the SharedWorker client calls `disconnect()`, it must remove the message listener, clear the replay buffer, and close the port.

## Version Negotiation

- The real HTTP transport of the UI API client sends `Accept-Version` in the request headers.
- The server returns the negotiation result via the `x-api-version` response header.
- The Node/CLI SDK does not reuse the UI's per-request negotiation model by default; instead, it performs a handshake and uses the `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` headers.
- These two surfaces are intentionally different; see `docs_zh/adr/120-ui-sdk-client-transport-boundary.md` for the detailed boundary.
