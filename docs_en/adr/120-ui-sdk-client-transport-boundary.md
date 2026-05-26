# ADR-120 UI And SDK Client Transport Boundary

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Both UI client and SDK client access the same platform API, but they serve different runtime environments:

- UI runs in browser, needs to handle offline, token refresh, WebSocket interactive experience.
- SDK runs in automation/server environment, more emphasizes deterministic requests, explicit handshake, SSE streaming subscription.

These differences already exist in implementation, but previously lacked authoritative explanation, causing several reviews to misinterpret them as "inconsistent defects".

## Decision

### 1. Offline Write

- Offline write queue is UI-only capability.
- SDK does not承担浏览器offline replay responsibility; network failure defaults to explicit error return.
- `ui-operator` in UI offline queue only represents local operation agent, does not equal server-side principal.

### 2. Version Negotiation

- UI expresses frontend-acceptable API version set through `Accept-Version` header.
- SDK uses `/handshake` and `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` for explicit version negotiation.
- The two can coexist, not requiring per-request header to be completely consistent.

### 3. Authentication Refresh and Interceptor

- UI allows using interceptor chain for token injection, 401 refresh, and retry.
- SDK internalizes retry logic in request path, rather than exposing browser-style token-refresh interceptor pattern.
- These two paths share authentication contract, but do not share implementation forms.

### 4. Realtime Subscription and Degradation

- UI primary realtime transport is WebSocket.
- SDK primary streaming transport is SSE.
- In UI, `sse-fallback` currently only indicates degradation state, does not mean automatically establishing real SSE channel.

### 5. Resilience Strategy

- UI transport can use local circuit breaker to protect interactive experience and fast fail-fast.
- SDK transport defaults to limited retry and backoff, does not built-in UI-style breaker.
- WebSocket reconnect and SSE reconnect can have different backoff/jitter/max-attempt strategies.

## Result

- UI and SDK client transport differences are viewed as intentional boundary, not requiring complete isomorphism.
- If sharing implementation in the future, should be based on shared contract/telemetry as前提, rather than forcibly merging transport mechanisms.
