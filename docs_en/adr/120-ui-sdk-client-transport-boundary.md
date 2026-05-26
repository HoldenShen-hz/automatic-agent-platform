# ADR-120 UI and SDK Client Transport Boundary

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Both the UI client and the SDK client talk to the same platform APIs, but they run in different environments:

- The UI runs in the browser and must handle offline behavior, token refresh, and WebSocket interaction ergonomics.
- The SDK runs in automation or server-side environments and prioritizes deterministic requests, explicit handshakes, and SSE streaming subscriptions.

These differences already exist in the implementation, but they were not previously documented as authoritative design choices. That caused several reviews to misclassify them as inconsistency defects.

## Decision

### 1. Offline writes

- The offline write queue is a UI-only capability.
- The SDK does not own browser-style offline replay; network failures return explicit errors by default.
- `ui-operator` in the UI offline queue represents a local operation agent, not a server-side principal.

### 2. Version negotiation

- The UI uses the `Accept-Version` header to express acceptable API versions.
- The SDK uses `/handshake` together with `X-Platform-Version`, `X-SDK-Version`, and `X-Contract-Version` for explicit negotiation.
- Both mechanisms may coexist; they do not need identical per-request headers.

### 3. Auth refresh and interceptors

- The UI may use an interceptor chain for token injection, `401` refresh, and retry.
- The SDK keeps retry logic inside the request path rather than exposing a browser-style token-refresh interceptor model.
- These paths share the authentication contract, but not the same implementation shape.

### 4. Realtime subscription and fallback

- The UI's primary realtime transport is WebSocket.
- The SDK's primary streaming transport is SSE.
- In the UI, `sse-fallback` currently represents a degraded state only; it does not mean a real SSE channel is automatically established.

### 5. Resilience strategy

- UI transport may use a local circuit breaker to protect interaction ergonomics and fail fast.
- SDK transport defaults to bounded retries and backoff, without a UI-style built-in breaker.
- WebSocket reconnect and SSE reconnect may use different backoff, jitter, and max-attempt policies.

## Consequences

- UI and SDK client transport differences are treated as an intentional boundary, not as something that must be fully isomorphic.
- If future implementation sharing is desired, it should start with shared contracts and telemetry rather than forcing the transport mechanisms to merge.
