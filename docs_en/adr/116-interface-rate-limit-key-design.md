# ADR-116 Interface Rate Limit Key Design

## Status
Accepted

## Background
Different entry points previously used different rate-limit keys, causing ops side unable to predict whether rate limits share buckets.

## Decision
- Rate-limit key design must explicitly define dimensions:
  - entryPoint
  - tenantId (if obtainable)
  - clientIp or service identity
  - endpoint / route id
- Whether different entry points share buckets must be explicitly defined, cannot rely on implementation coincidence.
- Any fallback key must be documented, avoid "one entry point by IP, another by inject prefix" implicit difference.

## Result
- Rate limit strategy becomes explicit ops interface, not implementation detail.

## Related Implementation
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-interface/api/http-server/*`

