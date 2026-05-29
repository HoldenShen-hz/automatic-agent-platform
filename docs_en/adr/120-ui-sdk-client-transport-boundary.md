# ADR-120 UI and SDK Client Transport Boundary

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Both UI client and SDK client access the same platform API, but they serve different runtime environments:

- UI runs in browser, needs to handle offline, token refresh, WebSocket interaction experience.
- SDK runs in automation/server-side environment, more emphasizing deterministic requests, explicit handshake, SSE streaming subscription.

These differences already exist in implementation, but previously lacked authoritative description, causing several reviews to误判 them as "inconsistent defects".

## Decision

### 1. Offline Writes

- Offline write queue is a UI-only capability.
- SDK does not承担 browser offline replay responsibility; network failure defaults to explicit error return.
- `ui-operator` in UI offline queue only represents local operation agent, not equivalent to server-side principal.

### 2. Version Negotiation

- UI expresses front-end acceptable API version set via `Accept-Version` header.
- SDK uses `/handshake` and `X-Platform-Version` / `X-SDK-Version` / `X-Contract-Version` for explicit version negotiation.
- The two can coexist; per-request header complete consistency is not required.

### 3. Authentication Refresh and Interceptors

- UI allows using interceptor chain for token injection, 401 refresh, and retry.
- SDK coalesces retry logic in request path, not exposing browser-style token-refresh interceptor pattern.
- These two paths share authentication contract, but do not share implementation form.

### 4. Real-time Subscription and Degradation

- UI's primary realtime transport is WebSocket.
- SDK's primary streaming transport is SSE.
- In UI, `sse-fallback` currently only represents degradation status, does not represent automatically establishing real SSE channel.

### 5. Resilience Strategy

- UI transport can use local circuit breaker to protect interaction experience and fail-fast quickly.
- SDK transport defaults to using limited retry and backoff, without built-in UI-style breaker.
- WebSocket reconnect and SSE reconnect can have different backoff/jitter/max-attempt strategies.

## Results

- UI and SDK client transport differences are viewed as intentional boundary, not requiring complete homogeneity.
- If sharing implementation later, should be基于 shared contract/telemetry as prerequisite, not forcibly merging transport mechanisms.