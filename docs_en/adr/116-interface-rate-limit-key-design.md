# ADR-116 Interface Rate Limit Key Design

## Status
Accepted

## Background
Different entry points previously used different rate-limit keys, causing operations side to be unable to predict whether rate limiting shares buckets.

## Decision
- Rate-limit key design must clearly define dimensions:
  - entryPoint
  - tenantId (if available)
  - clientIp or service identity
  - endpoint / route id
- Whether different entry points share buckets must be explicitly defined, not relying on accidental implementation consistency.
- Any fallback key must be documented to avoid implicit differences like "one entry point by IP, another entry point by inject prefix".

## Result
- Rate limiting strategy becomes an explicit operations interface, not an implementation detail.

## Related Implementation
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/http-server/*`